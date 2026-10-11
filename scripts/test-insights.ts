// Uses the disposable CI database only; never production DATABASE_URL.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { syncInsights } from '../src/lib/security-insights';
const url = process.env.INSIGHTS_TEST_DATABASE_URL;
if (!url || !/^mongodb:\/\/127\.0\.0\.1:27017\/studio_insights_test\?replicaSet=rs0$/.test(url)) throw new Error('Disposable insights database URL required');
const db = new PrismaClient({ datasourceUrl: url });
const originalFetch = global.fetch;
async function main() {
  await db.blogPost.deleteMany(); await db.insightImport.deleteMany(); await db.insightSyncState.deleteMany();
  const date = new Date().toISOString().slice(0, 10);
  const entries = Array.from({ length: 20 }, (_, i) => ({ cveID: `CVE-2026-${90000 + i}`, vendorProject: 'Test', product: 'Product', dateAdded: date, shortDescription: 'Test only.', requiredAction: 'Test vendor update.', dueDate: date, knownRansomwareCampaignUse: 'Unknown' }));
  global.fetch = async () => new Response(JSON.stringify({ vulnerabilities: entries }));
  const first = await Promise.all([syncInsights(db, { automatic: true }), syncInsights(db, { automatic: true })]);
  assert.equal(first.filter(r => r.skipped).length, 1, 'shared Mongo lease must skip one overlapping request');
  assert.equal(await db.blogPost.count(), 8);
  assert.equal(await db.blogPost.count({ where: { published: true } }), 8);
  const edited = await db.blogPost.findFirstOrThrow();
  await db.blogPost.update({ where: { id: edited.id }, data: { title: 'Manual edit' } });
  assert.equal((await syncInsights(db)).created, 3);
  assert.equal((await syncInsights(db)).created, 0, 'daily cap persists across invocations');
  assert.equal((await db.blogPost.findUniqueOrThrow({ where: { id: edited.id } })).title, 'Manual edit');
  await db.blogPost.delete({ where: { id: edited.id } });
  await syncInsights(db, { backfill: true });
  assert.equal(await db.blogPost.findUnique({ where: { slug: edited.slug } }), null, 'deleted imports must stay deleted');
  // Legacy Mongo documents omit the new optional fields entirely.
  const oldDate = new Date(Date.now() - 91 * 86400000);
  await db.$runCommandRaw({ insert: 'BlogPost', documents: [{
    _id: { $oid: '000000000000000000000001' }, title: 'Old post', slug: 'old-post', excerpt: '', content: 'Retain me', tags: [],
    published: true, publishedAt: { $date: oldDate.toISOString() }, createdAt: { $date: oldDate.toISOString() }, updatedAt: { $date: oldDate.toISOString() },
  }] });
  const recent = await db.blogPost.findFirstOrThrow({ where: { published: true } });
  await db.blogPost.update({ where: { id: recent.id }, data: { published: false, publishedAt: null } });
  await db.insightSyncState.update({ where: { id: 'security-insights' }, data: { publishingMigratedAt: null, autoPublish: false } });
  const migration = await syncInsights(db);
  assert.equal(migration.archived, 1);
  assert.equal(migration.published, 1);
  const old = await db.blogPost.findUniqueOrThrow({ where: { slug: 'old-post' } });
  assert.equal(old.published, false);
  assert.ok(old.archivedAt);
  assert.equal(old.content, 'Retain me');
  assert.equal(await db.insightImport.count({ where: { postSlug: edited.slug } }), 1);
  await db.blogPost.update({ where: { id: recent.id }, data: { published: false } });
  assert.equal((await syncInsights(db)).published, 0, 'later syncs preserve editorial unpublishing');
  assert.equal((await db.blogPost.findUniqueOrThrow({ where: { id: recent.id } })).published, false);
  await db.insightSyncState.update({ where: { id: 'security-insights' }, data: { enabled: false } });
  assert.equal((await syncInsights(db, { automatic: true })).skipped, true);
  console.log('Security Insights Mongo integration passed: lease, auto-publishing, draft migration, reversible archiving, daily cap, edits, deletion and pause.');
}
main().finally(async () => { global.fetch = originalFetch; await db.$disconnect(); }).catch(error => { console.error(error); process.exitCode = 1; });
