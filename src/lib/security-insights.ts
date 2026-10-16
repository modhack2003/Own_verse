import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

export const KEV_URL = 'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json';
export const KEV_PAGE = 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog';
const DAY = 86400000;
export const BLOG_RETENTION_DAYS = 90;
const entrySchema = z.object({
  cveID: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
  vendorProject: z.string().min(1).max(200), product: z.string().min(1).max(200),
  dateAdded: z.iso.date(), shortDescription: z.string().min(1).max(5000),
  requiredAction: z.string().min(1).max(5000), dueDate: z.iso.date(),
  knownRansomwareCampaignUse: z.enum(['Known', 'Unknown']),
});
const catalogSchema = z.object({ vulnerabilities: z.array(entrySchema).max(10000) });
export type KevEntry = z.infer<typeof entrySchema>;
// Feed strings are plain text, never executable Markdown or HTML.
const plain = (s: string) => s.replace(/[<>\[\]()*_`#!\\]/g, '').replace(/\s+/g, ' ').trim();
export function makeInsight(entry: KevEntry) {
  const product = plain(`${entry.vendorProject} ${entry.product}`);
  return {
    title: `${entry.cveID}: ${product} exploitation alert`.slice(0, 200),
    slug: `security-insight-${entry.cveID.toLowerCase()}`,
    excerpt: `CISA added ${entry.cveID} to its Known Exploited Vulnerabilities catalog on ${entry.dateAdded}. Review affected ${product} deployments and vendor mitigation guidance.`.slice(0, 600),
    content: [
      `## ${entry.cveID}: what changed`,
      `CISA added this vulnerability to its Known Exploited Vulnerabilities catalog on ${entry.dateAdded}. Inclusion indicates evidence of exploitation; it does not establish that your own systems have been compromised.`,
      `### Affected product\n${product}. Confirm affected versions against the vendor advisory.`,
      `### CISA description\n${plain(entry.shortDescription).slice(0, 600)}`,
      `### Recommended response\nInventory affected deployments, check vendor guidance for fixes or mitigations, and verify the update was applied. Review available logs and incident-response guidance when exploitation is suspected.`,
      `### Catalog context\nCISA lists a remediation due date of ${entry.dueDate}. Federal directive deadlines have a defined scope; other organizations should prioritize according to their exposure and risk. Ransomware campaign use is listed as ${entry.knownRansomwareCampaignUse.toLowerCase()}; “unknown” does not mean exploitation is absent.`,
      `### Sources\n- [CISA Known Exploited Vulnerabilities catalog](${KEV_PAGE})\n- [${entry.cveID} reference](https://www.cve.org/CVERecord?id=${entry.cveID})`,
      `Automated security brief based on CISA catalog data. Catalog addition date: ${entry.dateAdded}.`,
    ].join('\n\n'),
    tags: ['Security Insights', 'CISA KEV', entry.cveID],
  };
}
export function selectEntries(entries: KevEntry[], now: Date, backfill: boolean) {
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 30 * DAY).toISOString().slice(0, 10);
  const sorted = entries.filter(e => e.dateAdded >= start && e.dateAdded <= end)
    .sort((a,b) => b.dateAdded.localeCompare(a.dateAdded) || a.cveID.localeCompare(b.cveID));
  if (!backfill) return sorted;
  // Round-robin weeks, so the initial collection covers the month rather than one news cycle.
  const buckets: KevEntry[][] = [[], [], [], []];
  for (const e of sorted) buckets[Math.min(3, Math.floor((now.getTime() - Date.parse(e.dateAdded)) / (7 * DAY)))].push(e);
  const result: KevEntry[] = [];
  while (buckets.some(b => b.length)) for (const b of buckets) { const e = b.shift(); if (e) result.push(e); }
  return result;
}
export async function fetchCatalog(): Promise<KevEntry[]> {
  const response = await fetch(KEV_URL, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('CISA catalog unavailable');
  if (Number(response.headers.get('content-length')) > 8000000) throw new Error('Catalog too large');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty catalog');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 8000000) throw new Error('Catalog too large'); chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return catalogSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8'))).vulnerabilities;
}
export async function insightState(db: PrismaClient) {
  try {
    return await db.insightSyncState.upsert({ where: { id: 'security-insights' }, update: { autoPublish: true }, create: {
      id: 'security-insights', enabled: true, autoPublish: true, lastSuccess: null, lastAttempt: null,
      lastError: null, lockedUntil: null, lockToken: null, backfilledAt: null, lastCreated: 0,
    } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') throw e;
    return await db.insightSyncState.findUniqueOrThrow({ where: { id: 'security-insights' } });
  }
}
export async function syncInsights(db: PrismaClient, options: { automatic?: boolean; backfill?: boolean } = {}) {
  const state = await insightState(db); const now = new Date(); const lockToken = randomUUID();
  const backfill = options.backfill || !state.backfilledAt;
  const claim = await db.insightSyncState.updateMany({ where: { id: state.id,
    ...(options.automatic ? { enabled: true } : {}),
    AND: [
      { OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
      ...(options.automatic ? [{ OR: [{ lastAttempt: null }, { lastAttempt: { lte: new Date(now.getTime() - 20 * 60 * 1000) } }] }] : []),
    ],
  }, data: { lockToken, lockedUntil: new Date(now.getTime() + 10 * 60 * 1000), lastAttempt: now } });
  if (!claim.count) return { skipped: true, created: 0, published: 0, archived: 0, backfill };
  let created = 0;
  let published = 0;
  let archived = 0;
  try {
    const cutoff = new Date(now.getTime() - BLOG_RETENTION_DAYS * DAY);
    const unarchived = { OR: [{ archivedAt: null }, { archivedAt: { isSet: false } }] };
    // Only ledger-backed imports belong to retention. A manual write-up may
    // mention the same CVE, so never infer ownership from its title or tags.
    const retainedImports = await db.insightImport.findMany({ select: { postSlug: true } });
    // Reversible archive: retain the content, dates and durable import ledger.
    archived = (await db.blogPost.updateMany({ where: {
      slug: { in: retainedImports.map(i => i.postSlug) },
      AND: [unarchived, { OR: [
        { publishedAt: { lt: cutoff, not: null } },
        { AND: [{ OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }] }, { createdAt: { lt: cutoff } }] },
      ] }],
    }, data: { published: false, archivedAt: now } })).count;
    // One-time release of drafts left by the old approval policy. Subsequent
    // syncs preserve an editor's decision to unpublish an existing brief.
    if (!state.publishingMigratedAt) {
      const recentImports = await db.insightImport.findMany({ where: { sourceDate: { gte: cutoff } }, select: { postSlug: true } });
      published = (await db.blogPost.updateMany({ where: {
        slug: { in: recentImports.map(i => i.postSlug) }, published: false, ...unarchived,
      }, data: { published: true, publishedAt: now } })).count;
      await db.insightSyncState.updateMany({ where: { id: state.id, lockToken }, data: { publishingMigratedAt: now } });
    }
    const dailyCount = backfill ? 0 : await db.insightImport.count({ where: { backfill: false, importedAt: { gte: new Date(now.toISOString().slice(0, 10)) } } });
    const budget = backfill ? 8 : Math.max(0, 3 - dailyCount);
    const entries = budget ? selectEntries(await fetchCatalog(), now, backfill) : [];
    const [existing, imported] = await Promise.all([
      db.blogPost.findMany({ select: { slug: true, content: true, title: true } }),
      db.insightImport.findMany({ select: { id: true } }),
    ]);
    const imports = new Set(imported.map(i => i.id));
    const existingSlugs = new Set(existing.map(p => p.slug));
    const existingCves = new Set(existing.flatMap(p => (`${p.title} ${p.content}`).match(/\bCVE-\d{4}-\d{4,}\b/g) ?? []));
    for (const entry of entries) {
      if (imports.has(entry.cveID)) continue;
      const post = makeInsight(entry);
      const legacy = existingSlugs.has(post.slug) || existingCves.has(entry.cveID);
      if (!legacy) {
        // Empty update preserves all editorial changes after a crash/retry.
        await db.blogPost.upsert({ where: { slug: post.slug }, update: {}, create: {
          ...post, published: true, publishedAt: now,
        } });
        created++;
      }
      await db.insightImport.upsert({ where: { id: entry.cveID }, update: {}, create: { id: entry.cveID, postSlug: post.slug, sourceDate: new Date(entry.dateAdded), backfill: !!backfill } });
      if (created >= budget) break;
    }
    await db.insightSyncState.updateMany({ where: { id: state.id, lockToken }, data: {
      lastSuccess: new Date(), lastError: null, lastCreated: created, ...(backfill ? { backfilledAt: now } : {}),
    } });
    return { skipped: false, created, published, archived, backfill };
  } catch (error) {
    await db.insightSyncState.updateMany({ where: { id: state.id, lockToken }, data: { lastError: 'Import failed. Retry Sync now or check server logs.', lastCreated: created } }).catch(() => {});
    throw error;
  } finally {
    await db.insightSyncState.updateMany({ where: { id: state.id, lockToken }, data: { lockedUntil: null, lockToken: null } });
  }
}
