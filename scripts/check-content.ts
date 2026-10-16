import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
async function main() {
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to build public content.');
  const active = { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] };
  const [profile, projects, repos] = await Promise.all([
    db.personalData.findFirst({ where: active, select: { name: true, title: true, bio: true } }),
    db.project.count({ where: active }),
    db.gitHubRepository.count({ where: { AND: [active, { displayInPortfolio: true }] } }),
  ]);
  if (!profile?.name.trim() || !profile.title.trim() || !profile.bio.trim() || projects + repos < 1) throw new Error('Public content is incomplete: a named profile, title, bio and at least one project/repository are required.');
  console.log(`Content check passed: profile and ${projects + repos} projects/repositories are available.`);
} catch {
  console.error('Content check failed. Build stopped to preserve the current deployment. Verify DATABASE_URL, database access, and a populated public profile with at least one project/repository.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }

}
void main();
