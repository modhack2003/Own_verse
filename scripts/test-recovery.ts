import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createContentClient, contentTransaction, restoreData, CONTENT_MODELS } from '../src/lib/content-history';
import { checksum, exportBackup, importBackup, restoreRevision, validateBackup } from '../src/lib/content-recovery';
import { testDatabase } from './test-database';

const raw = new PrismaClient({ datasourceUrl: testDatabase('recovery') });
const db = createContentClient(raw);
async function main() {
  await raw.$runCommandRaw({ dropDatabase: 1 });
  // Create the revision collection/index before transactions (Mongo cannot create collections in all transaction contexts).
  await raw.$runCommandRaw({ create: 'ContentRevision' });
  await raw.$runCommandRaw({ createIndexes: 'BlogPost', indexes: [{ key: { slug: 1 }, name: 'BlogPost_slug_key', unique: true }] });
  const project = await db.project.create({ data: { title: 'Version one', description: 'Original', tags: [] } });
  await db.project.update({ where: { id: project.id }, data: { title: 'Version two' } });
  assert.equal(await raw.contentRevision.count(), 2);
  await db.project.deleteMany({ where: { id: project.id } });
  assert.equal(await db.project.count(), 0, 'trash must disappear from public/admin reads');
  assert.equal(await db.project.findUnique({ where: { id: project.id } }), null);
  assert.ok((await raw.project.findUniqueOrThrow({ where: { id: project.id } })).deletedAt, 'soft deletion must retain original content');
  const deletion = await raw.contentRevision.findFirstOrThrow({ where: { action: 'deleted' } });
  let current = await raw.project.findUnique({ where: { id: project.id } });
  await restoreRevision(raw, deletion.id, 'before', checksum(current), 'test-admin');
  assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).title, 'Version two');
  await assert.rejects(restoreRevision(raw, deletion.id, 'before', checksum(current), 'test-admin'), /changed/);
  // A failing audit insert must roll back its corresponding content edit.
  const failing = new Proxy(raw, { get(target, key) {
    if (key !== '$transaction') return Reflect.get(target, key);
    return (work: (tx: object) => unknown) => raw.$transaction(tx => work(new Proxy(tx, { get(inner, property) {
      if (property === 'contentRevision') return { create: () => { throw new Error('forced audit failure'); } };
      return Reflect.get(inner, property);
    } })) as never);
  } });
  await assert.rejects(createContentClient(failing).project.update({ where: { id: project.id }, data: { title: 'Must roll back' } }), /forced audit failure/);
  assert.equal((await raw.project.findUniqueOrThrow({ where: { id: project.id } })).title, 'Version two');
  // The LinkedIn path shares its existing transaction and logs each write once.
  await raw.$transaction(async tx => { const client = contentTransaction(tx, 'test-import'); await client.project.create({ data: { title: 'Imported', description: '', tags: [] } }); });
  assert.equal(await raw.contentRevision.count({ where: { actor: 'test-import' } }), 1);
  await db.personalData.create({ data: { name: 'Test Operator', title: 'Test', bio: 'Fixture', github: '', linkedin: '', email: 'test@example.com', resumeUrl: '', bountyProfiles: [] } });
  await db.skill.create({ data: { languages: ['Python'], tools: [], areas: [] } });
  await db.blogPost.create({ data: { title: 'Published test', slug: 'published-test', excerpt: '', content: 'Safe content', tags: ['Test'], published: true, publishedAt: new Date() } });
  await db.bountyFinding.create({ data: { title: 'Private finding', program: 'Hidden Program', privateProgram: true } });
  await db.siteAudioConfig.create({ data: { id: 'site-audio', enabledDialogueIds: [] } });
  await raw.insightImport.create({ data: { id: 'CVE-2026-12345', postSlug: 'published-test', sourceDate: new Date() } });
  await db.certificate.create({ data: { name: 'Test certificate', issuer: 'Fixture', year: 2026 } });
  await db.education.create({ data: { institution: 'Fixture university', degree: 'Test degree', duration: '2026' } });
  await db.experience.create({ data: { company: 'Fixture company', role: 'Test role', startDate: new Date() } });
  await db.ctfEvent.create({ data: { name: 'Fixture CTF', organizer: 'Fixture', date: new Date(), categories: ['Web'] } });
  await db.gitHubRepository.create({ data: { githubId: 1, name: 'fixture', fullName: 'fixture/test', htmlUrl: 'https://github.com/example/test', cloneUrl: 'https://github.com/example/test.git', topics: [], customTags: [], createdAt: new Date(), updatedAt: new Date(), pushedAt: new Date(), size: 1, defaultBranch: 'main', visibility: 'public' } });
  const backup = await exportBackup(raw);
  const prepared = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.throws(() => validateBackup({ ...backup, collections: { ...backup.collections, AdminCredential: [] } }), /supported/);
  assert.throws(() => restoreData('Project', { id: project.id, title: 'Bad', description: '', tags: [], deletedAt: 'not-a-date' }), /Invalid/);
  const beforeRows = await raw.project.findMany();
  // Simulate a fresh content database by removing only the exact test collections.
  for (const model of CONTENT_MODELS) {
    const collection = model;
    await raw.$runCommandRaw({ delete: collection, deletes: [{ q: {}, limit: 0 }] });
  }
  await raw.insightImport.deleteMany();
  await importBackup(raw, prepared, 'test-recovery');
  assert.equal(await raw.project.count(), beforeRows.length);
  for (const model of CONTENT_MODELS) {
    const delegate = (raw as unknown as Record<string, { count(): Promise<number> }>)[model[0].toLowerCase() + model.slice(1)];
    assert.ok(await delegate.count(), `${model} must round-trip`);
  }
  current = await raw.project.findUnique({ where: { id: project.id } });
  assert.equal(current?.title, 'Version two');
  assert.equal(await raw.insightImport.count(), 1);
  assert.equal((await db.bountyFinding.findFirstOrThrow()).privateProgram, true);
  assert.equal((await db.siteAudioConfig.findUniqueOrThrow({ where: { id: 'site-audio' } })).music, 0.75);
  assert.ok(await raw.contentRevision.count({ where: { action: 'backup-restored' } }));
  assert.equal(await raw.adminCredential.count(), 0);
  // A conflicting slug rolls back every earlier row from the same backup.
  const copy = JSON.parse(JSON.stringify(backup));
  copy.collections.Project[0].title = 'Must not persist';
  copy.collections.BlogPost[0].id = '000000000000000000000099';
  await assert.rejects(importBackup(raw, validateBackup(copy), 'test-conflict'));
  assert.equal((await raw.project.findUniqueOrThrow({ where: { id: project.id } })).title, 'Version two');
  console.log('Content recovery Mongo integration passed: atomic history, audit failure rollback, soft delete, stale restore rejection, import history, backup round trip, private content, ledger, and conflicting restore rollback.');
}
main().finally(() => raw.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
