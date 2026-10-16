/** Run against a disposable local MongoDB replica set:
 * THROTTLE_TEST_DATABASE_URL='mongodb://127.0.0.1:27017/studio_throttle_test?replicaSet=rs0' npx tsx scripts/test-throttles.ts
 * This script clears only its dedicated test database collections.
 */
import assert from 'node:assert/strict';

async function main() {
  const uri = process.env.THROTTLE_TEST_DATABASE_URL;
  assert(uri, 'Set THROTTLE_TEST_DATABASE_URL to a disposable local replica set.');
  const target = new URL(uri);
  assert(['localhost', '127.0.0.1'].includes(target.hostname) && target.pathname === '/studio_throttle_test',
    'Refusing to run outside the dedicated local studio_throttle_test database.');
  process.env.DATABASE_URL = uri;
  process.env.ADMIN_PIN = '835194';
  const { prisma, rawPrisma } = await import('../src/lib/prisma');
  const { checkAdminPin } = await import('../src/lib/admin-auth');
  const { throttleTransaction } = await import('../src/lib/throttle-transaction');
  const { POST: engagement } = await import('../src/app/api/engagements/route');
  const { importLinkedIn, parseLinkedInExport } = await import('../src/lib/linkedin-import');
  const { refreshGitHub } = await import('../src/lib/github-refresh');
  const { POST: contact } = await import('../src/app/api/contact/route');
  const { NextRequest } = await import('next/server');

  const clear = async () => {
    await rawPrisma.loginAttempt.deleteMany();
    await rawPrisma.contactMessage.deleteMany();
    await rawPrisma.engagement.deleteMany();
    await rawPrisma.gitHubSyncState.deleteMany();
    await rawPrisma.gitHubRepository.deleteMany();
    await rawPrisma.experience.deleteMany();
    await rawPrisma.skill.deleteMany();
    await rawPrisma.adminCredential.deleteMany();
    await rawPrisma.throttleGuard.deleteMany();
  };
  const failures = async (count: number, sameIp: boolean) => {
    await prisma.loginAttempt.createMany({ data: Array.from({ length: count }, (_, i) => ({
      ip: sameIp ? 'test-ip' : `seed-${i}`, success: false,
    })) });
  };
  const sendContact = (ip: string) => contact(new NextRequest('http://localhost/api/contact', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify({ name: 'Test User', email: 'test@example.com', subject: 'Testing', message: 'A concurrency regression test message.' }),
  }));
  try {
    await clear();
    await failures(4, true);
    const perIp = await Promise.allSettled(Array.from({ length: 12 }, () => checkAdminPin('wrong', 'test-ip', null)));
    assert.equal(await prisma.loginAttempt.count(), 5, 'concurrent guesses must stop at five failures');
    assert.equal(perIp.filter((r) => r.status === 'fulfilled' && r.value.ok === false).length, 1);
    assert.equal((await checkAdminPin('835194', 'test-ip', null)).ok, null, 'correct PIN must also respect lockout');

    await clear();
    await failures(39, false);
    await Promise.allSettled(Array.from({ length: 12 }, (_, i) => checkAdminPin('wrong', `parallel-${i}`, null)));
    assert.equal(await prisma.loginAttempt.count(), 40, 'global limit must hold across different IPs');

    await clear();
    await failures(4, true);
    assert.equal((await checkAdminPin('835194', 'test-ip', null)).ok, true);
    assert.equal((await checkAdminPin('wrong', 'test-ip', null)).throttle.remaining, 5, 'successful login resets per-IP failures');
    await prisma.loginAttempt.updateMany({ data: { createdAt: new Date(Date.now() - 31 * 60 * 1000) } });
    assert.equal((await checkAdminPin('wrong', 'test-ip', null)).throttle.remaining, 5, 'old attempts expire');

    await clear();
    const responses = await Promise.all(Array.from({ length: 12 }, () => sendContact('test-ip')));
    assert.equal(responses.filter((r) => r.status === 201).length, 5, 'only five same-IP contacts accepted');
    assert.equal(await prisma.contactMessage.count(), 5);
    assert(responses.every((r) => [201, 429, 503].includes(r.status)));

    await clear();
    await prisma.contactMessage.createMany({ data: Array.from({ length: 59 }, (_, i) => ({
      name: 'Test User', email: 'test@example.com', subject: 'Testing', message: 'seed', ipHash: `seed-${i}`,
    })) });
    const globalResponses = await Promise.all(Array.from({ length: 12 }, (_, i) => sendContact(`parallel-${i}`)));
    assert.equal(globalResponses.filter((r) => r.status === 201).length, 1, 'only one global contact slot remains');
    assert.equal(await prisma.contactMessage.count(), 60);

    await assert.rejects(throttleTransaction('contact', async (tx) => {
      await tx.contactMessage.deleteMany();
      throw new Error('rollback test');
    }), /rollback test/);
    assert.equal(await prisma.contactMessage.count(), 60, 'failed transactions must roll back');
    await clear();
    const sendEngagement = (ip: string) => engagement(new NextRequest('http://localhost/api/engagements', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip },
      body: JSON.stringify({ kind: 'bounty', name: 'Test User', email: 'test@example.com', company: 'Test Company', message: 'A concurrency test invite.' }),
    }));
    const invites = await Promise.all(Array.from({ length: 12 }, () => sendEngagement('test-ip')));
    assert.equal(invites.filter((r) => r.status === 201).length, 4, 'only four same-IP engagement requests accepted');
    assert.equal(await prisma.engagement.count(), 4);
    await clear();
    await prisma.engagement.createMany({ data: Array.from({ length: 39 }, (_, i) => ({
      kind: 'bounty', name: 'Test User', email: 'test@example.com', message: 'seed', services: [], ipHash: `seed-${i}`,
    })) });
    const globalInvites = await Promise.all(Array.from({ length: 12 }, (_, i) => sendEngagement(`parallel-${i}`)));
    assert.equal(globalInvites.filter((r) => r.status === 201).length, 1, 'only one global engagement slot remains');
    assert.equal(await prisma.engagement.count(), 40);

    await clear();
    const exported = parseLinkedInExport({
      'Positions.csv': 'Company Name,Title,Started On\nExample,Engineer,Jan 2023\nExample,Engineer,Jan 2023',
      'Skills.csv': 'Name\nPython (Programming Language)\nReact.js\nNetwork Security',
    });
    const preview = await importLinkedIn(prisma, exported, { dryRun: true });
    assert.equal(await prisma.experience.count(), 0, 'preview never writes');
    await assert.rejects(prisma.$transaction(async (tx) => {
      await importLinkedIn(tx, exported);
      throw new Error('import rollback test');
    }), /import rollback test/);
    assert.equal(await prisma.experience.count(), 0, 'failed imports roll back experience');
    assert.equal(await prisma.skill.count(), 0, 'failed imports roll back skills');
    const saved = await prisma.$transaction((tx) => importLinkedIn(tx, exported));
    assert.deepEqual(saved.experience, preview.experience);
    assert.equal(await prisma.experience.count(), 1, 'duplicate rows produce one role');
    await prisma.$transaction((tx) => importLinkedIn(tx, exported));
    assert.equal(await prisma.experience.count(), 1, 're-import does not duplicate roles');
    const skills = await prisma.skill.findFirst();
    assert.deepEqual(skills?.languages, ['Python']);
    assert.deepEqual(skills?.tools, ['React']);
    assert.deepEqual(skills?.areas, ['Network Security']);
    await clear();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/users/test-owner')) return new Response(JSON.stringify({ login: 'test-owner' }));
      if (url.includes('/users/test-owner/repos?')) return new Response(JSON.stringify([{
        id: 123, name: 'test-repo', full_name: 'test-owner/test-repo', description: 'Test repository description',
        html_url: 'https://github.com/test-owner/test-repo', clone_url: 'https://github.com/test-owner/test-repo.git',
        language: null, topics: [], stargazers_count: 0, forks_count: 0, created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z', pushed_at: '2024-01-01T00:00:00Z', size: 1, default_branch: 'main',
        visibility: 'public', private: false, archived: false, disabled: false, fork: false, homepage: null, license: null,
      }]));
      throw new Error(`Unexpected external request: ${url}`);
    };
    try {
      const refreshes = await Promise.all(Array.from({ length: 12 }, () => refreshGitHub(prisma, { username: 'test-owner', automatic: true })));
      assert.equal(refreshes.filter((r) => !r.skipped).length, 1, 'only one concurrent automatic sync runs');
      assert.equal(await prisma.gitHubRepository.count(), 1);
      const state = await prisma.gitHubSyncState.findUnique({ where: { id: 'github' } });
      assert(state?.lastSuccess, 'successful sync records freshness');
      assert.equal(state.lockToken, null, 'successful sync releases its lease');
      assert.equal((await refreshGitHub(prisma, { username: 'test-owner', automatic: true })).skipped, true, 'fresh data does not refetch');
      await prisma.gitHubSyncState.update({ where: { id: 'github' }, data: { lastSuccess: null, lastAttempt: null, lockToken: 'expired', lockedUntil: new Date(0) } });
      assert.equal((await refreshGitHub(prisma, { username: 'test-owner', automatic: true })).skipped, false, 'expired leases recover');
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log('PASS: concurrent per-IP/global login and contact limits, lockout, success reset, expiry, rollback; engagement limits, atomic LinkedIn imports, concurrent GitHub refresh, freshness and expired-lease recovery.');
  } finally {
    await clear();
    await prisma.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
