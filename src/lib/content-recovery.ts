import { createHash } from 'node:crypto';
import { type PrismaClient } from '@prisma/client';
import { CONTENT_MODELS, activeContent, contentDelegate, isContentModel, recordRevision, restoreData, type ContentModel } from './content-history';

export const MAX_BACKUP_BYTES = 3_000_000;
export const MAX_BACKUP_RECORDS = 1000;
export const checksum = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class RecoveryConflict extends Error {}
async function ensureSingleton(db: object, model: ContentModel, data: ReturnType<typeof restoreData>) {
  if (!['PersonalData', 'Skill', 'SiteAudioConfig'].includes(model) || data.deletedAt) return;
  const other = await contentDelegate(db, model).findFirst({ where: { AND: [activeContent, { id: { not: data.id } }] } });
  if (other) throw new RecoveryConflict('Another active singleton exists. Review current content before restoring.');
}

export async function restoreRevision(db: PrismaClient, revisionId: string, side: 'before' | 'after', expected: string, actor: string) {
  return db.$transaction(async tx => {
    const revision = await tx.contentRevision.findUnique({ where: { id: revisionId } });
    if (!revision || !isContentModel(revision.model) || !revision[side]) throw new Error('Revision unavailable');
    const data = restoreData(revision.model, revision[side]);
    if (data.id !== revision.recordId) throw new Error('Revision identity mismatch');
    const delegate = contentDelegate(tx, revision.model);
    const before = await delegate.findFirst({ where: { id: data.id } });
    if (checksum(before) !== expected) throw new RecoveryConflict('This record changed. Review the latest version before restoring.');
    await ensureSingleton(tx, revision.model, data);
    const { id, ...update } = data;
    const after = await delegate.upsert({ where: { id }, create: data, update });
    await recordRevision(tx, revision.model, 'restored', before, after, actor);
    return after;
  }, { timeout: 30000 });
}
export async function exportBackup(db: PrismaClient) {
  return db.$transaction(async tx => {
    const collections: Record<string, unknown[]> = {};
    let count = 0;
    for (const model of CONTENT_MODELS) {
      const rows = await contentDelegate(tx, model).findMany({ take: MAX_BACKUP_RECORDS + 1 });
      collections[model] = rows;
      count += rows.length;
    }
    const imports = await tx.insightImport.findMany({ take: MAX_BACKUP_RECORDS + 1 });
    count += imports.length;
    if (count > MAX_BACKUP_RECORDS) throw new Error('Backup exceeds the 1,000-record limit. Use a database-level backup.');
    const backup = { format: 'own-verse-content', version: 1, exportedAt: new Date().toISOString(), collections, imports };
    if (Buffer.byteLength(JSON.stringify(backup)) > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 3 MB. Use a database-level backup.');
    return backup;
  }, { timeout: 30000 });
}
type PreparedBackup = { collections: { model: ContentModel; rows: ReturnType<typeof restoreData>[] }[]; imports: { id: string; postSlug: string; sourceDate: Date; importedAt: Date; backfill: boolean }[]; count: number };
export function validateBackup(value: unknown): PreparedBackup {
  if (Buffer.byteLength(JSON.stringify(value) ?? '') > MAX_BACKUP_BYTES) throw new Error('Backup too large (max 3 MB).');
  const backup = value as Record<string, unknown>;
  if (!backup || backup.format !== 'own-verse-content' || backup.version !== 1 || !backup.collections || typeof backup.collections !== 'object' || Array.isArray(backup.collections)) throw new Error('Unsupported backup format');
  const collections = backup.collections as Record<string, unknown>;
  if (Object.keys(collections).length !== CONTENT_MODELS.length || Object.keys(collections).some(name => !isContentModel(name))) throw new Error('Backup must contain exactly the supported content collections');
  let count = 0;
  const prepared = CONTENT_MODELS.map(model => {
    const source = collections[model];
    if (!Array.isArray(source)) throw new Error(`Missing collection: ${model}`);
    const rows = source.map(row => restoreData(model, row));
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate record id');
    if (['PersonalData', 'Skill', 'SiteAudioConfig'].includes(model) && rows.filter(row => !row.deletedAt).length > 1) throw new Error('Duplicate singleton');
    count += rows.length;
    return { model, rows };
  });
  if (!Array.isArray(backup.imports)) throw new Error('Missing import ledger');
  const imports = backup.imports.map((row: unknown) => {
    const item = row as Record<string, unknown>;
    if (!item || Object.keys(item).some(key => !['id', 'postSlug', 'sourceDate', 'importedAt', 'backfill'].includes(key)) || typeof item.id !== 'string' || !/^CVE-\d{4}-\d{4,}$/.test(item.id) || typeof item.postSlug !== 'string' || item.postSlug.length > 250 || typeof item.sourceDate !== 'string' || !Number.isFinite(Date.parse(item.sourceDate)) || typeof item.importedAt !== 'string' || !Number.isFinite(Date.parse(item.importedAt)) || typeof item.backfill !== 'boolean') throw new Error('Invalid import ledger');
    return { id: item.id, postSlug: item.postSlug, sourceDate: new Date(item.sourceDate), importedAt: new Date(item.importedAt), backfill: item.backfill };
  });
  if (new Set(imports.map(row => row.id)).size !== imports.length) throw new Error('Duplicate import id');
  count += imports.length;
  if (count > MAX_BACKUP_RECORDS) throw new Error('Backup exceeds 1,000 records');
  return { collections: prepared, imports, count };
}
/** Merge by durable ID; never erase records absent from a file. Every overwrite gets an undo revision. */
export async function importBackup(db: PrismaClient, backup: PreparedBackup, actor: string) {
  return db.$transaction(async tx => {
    for (const { model, rows } of backup.collections) for (const data of rows) {
      const delegate = contentDelegate(tx, model);
      const before = await delegate.findFirst({ where: { id: data.id } });
      await ensureSingleton(tx, model, data);
      const { id, ...update } = data;
      const after = await delegate.upsert({ where: { id }, create: data, update });
      await recordRevision(tx, model, 'backup-restored', before, after, actor);
    }
    for (const item of backup.imports) await tx.insightImport.upsert({ where: { id: item.id }, update: {}, create: item });
    return { restored: backup.count };
  }, { timeout: 60000 });
}
