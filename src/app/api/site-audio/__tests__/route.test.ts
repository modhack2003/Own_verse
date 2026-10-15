/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET, PUT } from '../route';
import { requireAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { DEFAULT_AUDIO_SETTINGS } from '@/lib/site-audio-library';
jest.mock('@/lib/admin-auth', () => ({ requireAdminSession: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { siteAudioConfig: { findUnique: jest.fn(), upsert: jest.fn() } } }));
jest.mock('@/lib/api', () => ({ readJson: (r: Request) => r.json().catch(() => undefined), jsonError: (error: string, status: number) => Response.json({ error }, { status }) }));
const req = (body: unknown) => new NextRequest('http://localhost/api/site-audio', { method: 'PUT', body: JSON.stringify(body) });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireAdminSession).mockResolvedValue(null);
  jest.mocked(prisma.siteAudioConfig.findUnique).mockResolvedValue(null);
});
test('public read returns defaults before the first admin save; writes require admin', async () => {
  expect(await (await GET()).json()).toEqual(DEFAULT_AUDIO_SETTINGS);
  jest.mocked(requireAdminSession).mockResolvedValue(Response.json({}, { status: 401 }) as never);
  expect((await PUT(req(DEFAULT_AUDIO_SETTINGS))).status).toBe(401);
  expect(prisma.siteAudioConfig.upsert).not.toHaveBeenCalled();
});
test('admin saves a durable singleton; a separate public read receives the saved settings only', async () => {
  const config = { ...DEFAULT_AUDIO_SETTINGS, music: 0.3, intervalSeconds: 35, enabledDialogueIds: [] };
  jest.mocked(prisma.siteAudioConfig.upsert).mockResolvedValue({ id: 'site-audio', ...config });
  expect((await PUT(req(config))).status).toBe(200);
  expect(prisma.siteAudioConfig.upsert).toHaveBeenCalledWith({ where: { id: 'site-audio' }, update: config, create: { id: 'site-audio', ...config } });
  jest.mocked(prisma.siteAudioConfig.findUnique).mockResolvedValue({ id: 'site-audio', ...config });
  expect(await (await GET()).json()).toEqual(config);
});
test.each([{ music: 2 }, { intervalSeconds: 0 }, { fadeSeconds: -1 }, { enabledDialogueIds: ['external'] }, { enabledDialogueIds: ['pain', 'pain'] }, { src: 'https://example.com/file.mp3' }])('rejects malformed settings %o', async patch => {
  expect((await PUT(req({ ...DEFAULT_AUDIO_SETTINGS, ...patch }))).status).toBe(400);
  expect(prisma.siteAudioConfig.upsert).not.toHaveBeenCalled();
});
