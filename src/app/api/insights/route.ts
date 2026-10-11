import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/admin-auth';
import { jsonError, readJson, revalidatePublic } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { insightState, syncInsights } from '@/lib/security-insights';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const settings = z.object({ enabled: z.boolean().optional() }).strict();
function publicState(state: Awaited<ReturnType<typeof insightState>>) {
  const { enabled, autoPublish, lastSuccess, lastAttempt, lastError, lastCreated, backfilledAt, lockedUntil } = state;
  return { enabled, autoPublish, lastSuccess, lastAttempt, lastError, lastCreated, backfilledAt, running: !!lockedUntil && lockedUntil > new Date() };
}
export async function GET(request: NextRequest) {
  const denied = await requireAdminSession(request); if (denied) return denied;
  try { return NextResponse.json(publicState(await insightState(prisma))); }
  catch { return jsonError('Could not load Security Insights settings.', 503); }
}
export async function PATCH(request: NextRequest) {
  const denied = await requireAdminSession(request); if (denied) return denied;
  const parsed = settings.safeParse(await readJson(request));
  if (!parsed.success) return jsonError('Invalid settings.', 400);
  try {
    await insightState(prisma);
    const state = await prisma.insightSyncState.update({ where: { id: 'security-insights' }, data: parsed.data });
    return NextResponse.json(publicState(state));
  } catch { return jsonError('Could not save settings.', 503); }
}
export async function POST(request: NextRequest) {
  const denied = await requireAdminSession(request); if (denied) return denied;
  const parsed = z.object({ backfill: z.boolean().optional() }).strict().safeParse(await readJson(request));
  if (!parsed.success) return jsonError('Invalid import request.', 400);
  try {
    const result = await syncInsights(prisma, parsed.data);
    if (result.created || result.published || result.archived) revalidatePublic();
    return NextResponse.json(result);
  } catch (error) { console.error('Security Insights import failed:', error); return jsonError('Import failed. Retry later.', 503); }
}
