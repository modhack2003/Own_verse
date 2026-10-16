import { Prisma, PrismaClient } from '@prisma/client';
import { testDatabase } from './test-database';

const db = new PrismaClient({ datasourceUrl: testDatabase('e2e') });
async function seed() {
  // Exact allowlisted localhost URL checked above, and only synthetic fixture data is written.
  for (const model of Prisma.dmmf.datamodel.models) await db.$runCommandRaw({ delete: model.name, deletes: [{ q: {}, limit: 0 }] });
  await db.personalData.create({ data: { name: 'Bikram Dey', title: 'Cybersecurity Analyst & Penetration Tester', bio: 'Synthetic browser test profile. Not production content.', github: 'https://github.com/modhack2003', linkedin: '', email: 'test@example.com', resumeUrl: '', bountyProfiles: [] } });
  await db.project.createMany({ data: [
    { title: 'Browser fixture scanner', description: 'A local-only test project.', tags: ['Security'], link: 'https://example.com/scanner' },
    { title: 'Browser fixture toolkit', description: 'Another test project.', tags: ['Testing'], link: 'https://example.com/toolkit' },
  ] });
  const now = new Date();
  await db.gitHubRepository.create({ data: { githubId: 1, name: 'fixture-repo', fullName: 'fixture/fixture-repo', description: 'Synthetic repository', htmlUrl: 'https://github.com/example/fixture', cloneUrl: 'https://github.com/example/fixture.git', language: 'TypeScript', topics: ['Security'], customTags: [], stargazersCount: 1, forksCount: 0, createdAt: now, updatedAt: now, pushedAt: now, size: 1, defaultBranch: 'main', visibility: 'public', displayInPortfolio: true, homepage: 'https://example.com/demo' } });
  await db.skill.create({ data: { languages: ['Python'], tools: ['Nmap'], areas: ['Web Security'] } });
  await db.blogPost.createMany({ data: Array.from({ length: 15 }, (_, i) => ({ title: `Browser article ${String(i + 1).padStart(2, '0')}`, slug: `browser-article-${i + 1}`, excerpt: i % 2 ? 'Cryptography field notes' : 'Web security field notes', content: `## Browser test\n\nSynthetic article ${i + 1}.`, tags: [i % 2 ? 'Crypto' : 'Web'], published: true, publishedAt: new Date(now.getTime() - i * 60000) })) });
  await db.blogPost.create({ data: { title: 'Private browser draft', slug: 'private-browser-draft', excerpt: 'Must not leak', content: 'Private draft text', tags: [], published: false } });
  await db.gitHubSyncState.create({ data: { id: 'github', username: 'modhack2003', lastSuccess: now, lastAttempt: now } });
  console.log('Synthetic browser fixtures seeded in disposable studio_e2e_test.');
}
seed().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
