/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET, POST, PATCH } from '../route';
import { requireAdminSession } from '@/lib/admin-auth';
import { syncInsights } from '@/lib/security-insights';
jest.mock('@/lib/admin-auth', () => ({ requireAdminSession: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { insightSyncState: { update: jest.fn() } } }));
jest.mock('@/lib/security-insights', () => ({ insightState: jest.fn().mockResolvedValue({ enabled: true, autoPublish: true, lockToken: 'private', lockedUntil: null }), syncInsights: jest.fn().mockResolvedValue({ created: 2, skipped: false }) }));
jest.mock('@/lib/api', () => ({ readJson: (r: Request) => r.json(), revalidatePublic: jest.fn(), jsonError: (error: string, status: number) => Response.json({ error }, { status }) }));
const req = (method: string, body?: object) => new NextRequest('http://localhost/api/insights', { method, ...(body ? { body: JSON.stringify(body) } : {}) });
beforeEach(() => { jest.clearAllMocks(); jest.mocked(requireAdminSession).mockResolvedValue(null); });
test('every admin handler rejects unauthenticated requests', async () => {
  jest.mocked(requireAdminSession).mockResolvedValue(Response.json({}, { status: 401 }) as never);
  for (const [handler, method] of [[GET, 'GET'], [POST, 'POST'], [PATCH, 'PATCH']] as const) expect((await handler(req(method))).status).toBe(401);
  expect(syncInsights).not.toHaveBeenCalled();
});
test('status omits lease token and import validates arguments', async () => {
  expect(await (await GET(req('GET'))).json()).not.toHaveProperty('lockToken');
  expect((await POST(req('POST', { backfill: true }))).status).toBe(200);
  expect(syncInsights).toHaveBeenCalledWith(expect.anything(), { backfill: true });
  expect((await POST(req('POST', { source: 'http://localhost/' }))).status).toBe(400);
  expect((await PATCH(req('PATCH', { autoPublish: 'true' }))).status).toBe(400);
});

test('rejects attempts to reintroduce the publishing approval gate', async () => {
  expect((await PATCH(req('PATCH', { autoPublish: false }))).status).toBe(400);
});
