import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';
import { jsonError, readJson } from '@/lib/api';
import { DIALOGUES, parseAudioSettings } from '@/lib/site-audio-library';

export const dynamic = 'force-dynamic';
const schema = z.object({
  music: z.number().min(0).max(1), dialogue: z.number().min(0).max(1),
  effects: z.number().min(0).max(1), randomDialogue: z.boolean(),
  intervalSeconds: z.number().int().min(1).max(600), fadeSeconds: z.number().min(0).max(30),
  enabledDialogueIds: z.array(z.enum(DIALOGUES.map(q => q.id))).max(DIALOGUES.length)
    .refine(ids => new Set(ids).size === ids.length, 'Duplicate dialogue IDs.'),
}).strict();

/** Public, non-sensitive playback values only; no visitor write access. */
export async function GET() {
  try {
    const config = await prisma.siteAudioConfig.findUnique({ where: { id: 'site-audio' } });
    return NextResponse.json(parseAudioSettings(config), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return jsonError('Could not load audio settings.', 503); }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError('Invalid audio settings.', 400);
  try {
    const config = await prisma.siteAudioConfig.upsert({
      where: { id: 'site-audio' }, update: parsed.data,
      create: { id: 'site-audio', ...parsed.data },
    });
    return NextResponse.json(parseAudioSettings(config));
  } catch { return jsonError('Could not save audio settings.', 503); }
}
