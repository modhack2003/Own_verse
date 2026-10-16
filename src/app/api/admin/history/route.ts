import { NextRequest, NextResponse } from 'next/server';
import { rawPrisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';
import { handleError, jsonError, OBJECT_ID, readJson, revalidatePublic } from '@/lib/api';
import { contentActor, contentDelegate, isContentModel } from '@/lib/content-history';
import { checksum, RecoveryConflict, restoreRevision } from '@/lib/content-recovery';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  const denied = await requireAdminSession(request); if (denied) return denied;
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (id) {
      if (!OBJECT_ID.test(id)) return jsonError('Invalid revision id', 400);
      const revision = await rawPrisma.contentRevision.findUnique({ where: { id } });
      if (!revision || !isContentModel(revision.model)) return jsonError('Revision not found', 404);
      const current = await contentDelegate(rawPrisma, revision.model).findFirst({ where: { id: revision.recordId } });
      return NextResponse.json({ revision, current, expected: checksum(current) }, { headers });
    }
    const model = request.nextUrl.searchParams.get('model');
    if (model && !isContentModel(model)) return jsonError('Invalid collection', 400);
    const page = Math.max(1, Math.min(10000, Number(request.nextUrl.searchParams.get('page')) || 1));
    if (request.nextUrl.searchParams.get('trash') === 'true') {
      if (!model || !isContentModel(model)) return jsonError('Choose a trash collection', 400);
      const delegate = contentDelegate(rawPrisma, model);
      const where = { deletedAt: { not: null } };
      const [rows, total] = await Promise.all([delegate.findMany({ where, orderBy: { deletedAt: 'desc' }, skip: (Math.floor(page) - 1) * 30, take: 30 }), delegate.count({ where })]);
      const items = await Promise.all(rows.map(async row => {
        const revision = await rawPrisma.contentRevision.findFirst({ where: { model, recordId: row.id, action: 'deleted' }, orderBy: { createdAt: 'desc' }, select: { id: true } });
        return { id: revision?.id ?? '', model, recordId: row.id, action: 'deleted', actor: '', label: String(row.title ?? row.name ?? model), createdAt: row.deletedAt };
      }));
      return NextResponse.json({ items, total, page: Math.floor(page) }, { headers });
    }
    const where = model ? { model } : {};
    const [items, total] = await Promise.all([
      rawPrisma.contentRevision.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (Math.floor(page) - 1) * 30, take: 30, select: { id: true, model: true, recordId: true, action: true, actor: true, label: true, createdAt: true } }),
      rawPrisma.contentRevision.count({ where }),
    ]);
    return NextResponse.json({ items, total, page: Math.floor(page) }, { headers });
  } catch (error) { return handleError(error, 'Content history'); }
}
export async function POST(request: NextRequest) {
  const denied = await requireAdminSession(request); if (denied) return denied;
  const body = await readJson(request) as { id?: string; side?: string; expected?: string } | undefined;
  if (!body?.id || !OBJECT_ID.test(body.id) || !['before', 'after'].includes(body.side ?? '') || !/^[a-f0-9]{64}$/.test(body.expected ?? '')) return jsonError('Invalid restore request', 400);
  try {
    await restoreRevision(rawPrisma, body.id, body.side as 'before' | 'after', body.expected!, await contentActor());
    revalidatePublic();
    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    if (error instanceof RecoveryConflict) return jsonError(error.message, 409);
    return handleError(error, 'Content restore');
  }
}
