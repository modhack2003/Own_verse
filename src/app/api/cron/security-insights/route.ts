import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncInsights } from '@/lib/security-insights';
import { jsonError, revalidatePublic } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return jsonError('Unauthorized', 401);
  try {
    const result = await syncInsights(prisma, { automatic: true });
    if (result.created || result.published || result.archived) revalidatePublic();
    return NextResponse.json({ success: true, ...result });
  } catch (error) { console.error('Scheduled Security Insights failed:', error); return jsonError('Security Insights sync failed.', 503); }
}
