import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

/** Only portfolio content. Credentials, sessions, messages and client requests never enter backups/history. */
export const CONTENT_MODELS = ['PersonalData', 'Project', 'Skill', 'Certificate', 'Education', 'Experience', 'CtfEvent', 'GitHubRepository', 'BlogPost', 'BountyFinding', 'SiteAudioConfig'] as const;
export type ContentModel = typeof CONTENT_MODELS[number];
export const activeContent = { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] };
export const isContentModel = (model: string): model is ContentModel => (CONTENT_MODELS as readonly string[]).includes(model);
type Row = Record<string, unknown> & { id: string };
export type ContentDelegate = {
  findMany(args?: object): Promise<Row[]>;
  count(args?: object): Promise<number>;
  findFirst(args: object): Promise<Row | null>;
  create(args: object): Promise<Row>;
  update(args: object): Promise<Row>;
  updateMany(args: object): Promise<{ count: number }>;
  upsert(args: object): Promise<Row>;
};
export function contentDelegate(db: object, model: ContentModel): ContentDelegate {
  return (db as Record<string, unknown>)[model[0].toLowerCase() + model.slice(1)] as ContentDelegate;
}
export const snapshot = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export async function contentActor() {
  try {
    const token = (await cookies()).get('admin_session')?.value;
    return token ? `session:${createHash('sha256').update(token).digest('hex').slice(0, 16)}` : 'automation';
  } catch { return 'automation'; }
}
export async function recordRevision(db: Prisma.TransactionClient, model: ContentModel, action: string, before: Row | null, after: Row | null, actor: string) {
  return db.contentRevision.create({ data: {
    model, recordId: (after ?? before)!.id, action, actor,
    label: String(after?.title ?? after?.name ?? before?.title ?? before?.name ?? model).slice(0, 200),
    before: before ? snapshot(before) : null, after: after ? snapshot(after) : null,
  } });
}
const reads = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy']);
const writes = new Set(['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany', 'createMany']);
function activeWhere(where: unknown) { return { ...(where as object ?? {}), AND: [where ?? {}, activeContent] }; }

/** One transaction contains the edit and its full revision. Failure never leaves an unrecorded edit. */
export function createContentClient(raw: PrismaClient): PrismaClient {
  const client = raw.$extends({ query: { $allModels: { async $allOperations({ model, operation, args, query }) {
    if (!isContentModel(model)) return query(args);
    const options = args as Record<string, unknown>;
    if (reads.has(operation)) return query({ ...args, where: activeWhere(options.where) } as typeof args);
    if (!writes.has(operation)) return query(args);
    const actor = await contentActor();
    return raw.$transaction(async tx => {
      return writeContent(tx, model, operation, options, actor);
    }, { timeout: 30000 });
  } } } }) as unknown as PrismaClient;
  // Interactive callers must use the same raw transaction for content and history.
  // Re-entering the standalone query hook here would commit edits independently.
  return new Proxy(client, { get(target, key) {
    if (key === '$transaction') return async (work: unknown, options?: { maxWait?: number; timeout?: number }) => {
      if (typeof work !== 'function') throw new Error('Use an interactive transaction callback for audited content.');
      const actor = await contentActor();
      return raw.$transaction(tx => work(contentTransaction(tx, actor)), options);
    };
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}

async function writeContent(tx: Prisma.TransactionClient, model: ContentModel, operation: string, options: Record<string, unknown>, actor: string) {
  const delegate = contentDelegate(tx, model);
  if (operation === 'createMany') {
    const list = Array.isArray(options.data) ? options.data : [options.data];
    for (const data of list) {
      const after = await delegate.create({ data });
      await recordRevision(tx, model, 'created', null, after, actor);
    }
    return { count: list.length };
  }
  const bulk = operation === 'updateMany' || operation === 'deleteMany';
  if (bulk) {
    const rows = await delegate.findMany({ where: activeWhere(options.where) });
    for (const before of rows) {
      const after = await delegate.update({ where: { id: before.id }, data: operation === 'deleteMany' ? { deletedAt: new Date() } : options.data });
      await recordRevision(tx, model, operation === 'deleteMany' ? 'deleted' : 'updated', before, after, actor);
    }
    return { count: rows.length };
  }
  const before = operation === 'create' ? null : await delegate.findFirst({ where: options.where });
  const after = operation === 'delete'
    ? await delegate.update({ where: options.where, data: { deletedAt: new Date() } })
    : await delegate[operation as 'create' | 'update' | 'upsert']({ ...options, select: undefined, include: undefined });
  // Ignore no-op sync upserts to keep history useful.
  if (JSON.stringify(before) !== JSON.stringify(after)) await recordRevision(tx, model, operation === 'delete' ? 'deleted' : before ? 'updated' : 'created', before, after, actor);
  const result = operation === 'delete' ? before : after;
  const select = options.select as Record<string, boolean> | undefined;
  return select && result ? Object.fromEntries(Object.entries(result).filter(([key]) => select[key])) : result;
}

/** Preserve a caller's existing transaction, for the atomic LinkedIn import. */
export function contentTransaction(tx: Prisma.TransactionClient, actor: string): Prisma.TransactionClient {
  return new Proxy(tx, { get(target, key) {
    const model = CONTENT_MODELS.find(name => name[0].toLowerCase() + name.slice(1) === key);
    if (!model) return Reflect.get(target, key);
    const delegate = contentDelegate(target, model);
    return new Proxy(delegate, { get(object, operation: string) {
      if (writes.has(operation)) return (options: Record<string, unknown>) => writeContent(tx, model, operation, options, actor);
      const method = Reflect.get(object, operation);
      if (reads.has(operation)) return (options: Record<string, unknown> = {}) => method.call(object, { ...options, where: activeWhere(options.where) });
      return typeof method === 'function' ? method.bind(object) : method;
    } });
  } });
}

/** Validate full records against generated model metadata before any restore writes. */
export function restoreData(model: ContentModel, value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid content record');
  const fields = Prisma.dmmf.datamodel.models.find(item => item.name === model)!.fields;
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) if (!fields.some(field => field.name === key)) throw new Error(`Unknown ${model} field: ${key}`);
  for (const field of fields) {
    const value = input[field.name];
    if (value === undefined) {
      if (field.isRequired && !field.hasDefaultValue && !field.isUpdatedAt) throw new Error(`Missing ${model}.${field.name}`);
      continue;
    }
    if (value === null && !field.isRequired) { out[field.name] = null; continue; }
    const valid = (item: unknown) => {
      if (field.type === 'DateTime') return typeof item === 'string' && !Number.isNaN(Date.parse(item));
      if (field.type === 'Int') return typeof item === 'number' && Number.isSafeInteger(item);
      if (field.type === 'Float') return typeof item === 'number' && Number.isFinite(item);
      return typeof item === ({ String: 'string', Boolean: 'boolean' }[field.type] ?? 'invalid');
    };
    if (field.isList ? !Array.isArray(value) || !value.every(valid) : !valid(value)) throw new Error(`Invalid ${model}.${field.name}`);
    if (typeof value === 'string' && value.length > (field.name === 'content' ? 100000 : 10000)) throw new Error(`Oversized ${model}.${field.name}`);
    const linkFields = ['github', 'linkedin', 'resumeUrl', 'avatarUrl', 'link', 'url', 'writeupUrl', 'htmlUrl', 'cloneUrl', 'homepage'];
    if (typeof value === 'string' && value && linkFields.includes(field.name)) {
      let validLink = value.startsWith('/') && !value.startsWith('//');
      try { validLink ||= ['http:', 'https:'].includes(new URL(value).protocol); } catch { /* Relative links checked above. */ }
      if (!validLink) throw new Error(`Invalid link: ${model}.${field.name}`);
    }
    if (model === 'BlogPost' && field.name === 'slug' && (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))) throw new Error('Invalid article slug');
    if (model === 'SiteAudioConfig') {
      if (['music', 'dialogue', 'effects'].includes(field.name) && (Number(value) < 0 || Number(value) > 1)) throw new Error('Invalid audio level');
      if (field.name === 'intervalSeconds' && (Number(value) < 1 || Number(value) > 600)) throw new Error('Invalid dialogue gap');
      if (field.name === 'fadeSeconds' && (Number(value) < 0 || Number(value) > 30)) throw new Error('Invalid theme fade');
    }
    out[field.name] = field.type === 'DateTime' ? new Date(value as string) : value;
  }
  const id = out.id;
  if (typeof id !== 'string' || (model === 'SiteAudioConfig' ? id !== 'site-audio' : !/^[a-f0-9]{24}$/i.test(id))) throw new Error('Invalid record id');
  return out as Row;
}
