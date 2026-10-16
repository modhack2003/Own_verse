import { NextRequest, NextResponse } from 'next/server';
import { rawPrisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';
import { jsonError, revalidatePublic } from '@/lib/api';
import { contentActor } from '@/lib/content-history';
import { exportBackup, importBackup, MAX_BACKUP_BYTES, validateBackup } from '@/lib/content-recovery';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const denied = await requireAdminSession(request); if (denied) return denied;
  try {
    const backup = await exportBackup(rawPrisma);
    return NextResponse.json(backup, { headers: { 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="own-verse-content-${new Date().toISOString().slice(0, 10)}.json"` } });
  } catch { return jsonError('Could not export content. Check the database connection and the 1,000-record / 3 MB backup limits.', 503); }
}
export async function POST(request: NextRequest) {
  const denied = await requireAdminSession(request); if (denied) return denied;
  if (Number(request.headers.get('content-length')) > MAX_BACKUP_BYTES) return jsonError('Backup too large (max 3 MB).', 413);
  let prepared;
  try {
    // Bound the stream as well as Content-Length; a client can omit that header.
    const reader = request.body?.getReader(); if (!reader) return jsonError('Backup required', 400);
    const chunks: Uint8Array[] = []; let bytes = 0;
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > MAX_BACKUP_BYTES) return jsonError('Backup too large (max 3 MB).', 413); chunks.push(value); } }
    finally { await reader.cancel(); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    // Dry-run validates every record before making the restore button available.
    prepared = validateBackup(body);
  } catch { return jsonError('Invalid content backup. No records were changed.', 400); }
  if (request.nextUrl.searchParams.get('preview') === 'true') return NextResponse.json({ records: prepared.count, collections: prepared.collections.map(({ model, rows }) => ({ model, count: rows.length })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const result = await importBackup(rawPrisma, prepared, await contentActor());
    revalidatePublic();
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return jsonError('Restore failed and was rolled back. Check for conflicting unique fields or database availability.', 409); }
}
