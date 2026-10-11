/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { syncInsights } from '@/lib/security-insights';
import { revalidatePublic } from '@/lib/api';
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/security-insights', () => ({ syncInsights: jest.fn() }));
jest.mock('@/lib/api', () => ({ revalidatePublic: jest.fn(), jsonError: (error: string, status: number) => Response.json({ error }, { status }) }));
const originalSecret = process.env.CRON_SECRET;
afterAll(() => { if (originalSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = originalSecret; });
beforeEach(() => jest.clearAllMocks());
const request = (authorization?: string) => new NextRequest('http://localhost/api/cron/security-insights', { headers: authorization ? { authorization } : {} });
test('fails closed for missing or incorrect cron credentials', async () => {
  delete process.env.CRON_SECRET;
  expect((await GET(request('Bearer undefined'))).status).toBe(401);
  process.env.CRON_SECRET = 'test-secret';
  expect((await GET(request())).status).toBe(401);
  expect((await GET(request('Bearer wrong'))).status).toBe(401);
  expect(syncInsights).not.toHaveBeenCalled();
});
test('valid cron runs the automatic insights collector', async () => {
  process.env.CRON_SECRET = 'test-secret';
  jest.mocked(syncInsights).mockResolvedValue({ skipped: false, created: 3, published: 0, archived: 0, backfill: false });
  expect((await GET(request('Bearer test-secret'))).status).toBe(200);
  expect(syncInsights).toHaveBeenCalledWith({}, { automatic: true });
});

test('an archive-only cron run invalidates public pages', async () => {
  process.env.CRON_SECRET = 'test-secret';
  jest.mocked(syncInsights).mockResolvedValue({ skipped: false, created: 0, published: 0, archived: 2, backfill: false });
  expect((await GET(request('Bearer test-secret'))).status).toBe(200);
  expect(revalidatePublic).toHaveBeenCalled();
});
