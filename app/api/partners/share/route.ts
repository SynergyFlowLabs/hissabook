import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createWorkspaceNotification } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;
  let body: { changes?: Array<{ ownerId?: number; share?: number; effectiveAt?: string; note?: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const changes = body.changes;
  if (!Array.isArray(changes) || changes.length === 0) return NextResponse.json({ error: 'Choose at least one partner to update.' }, { status: 400 });
  if (changes.length > 50) return NextResponse.json({ error: 'Too many share changes in one request.' }, { status: 400 });

  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
  const normalized: Array<{ ownerId: number; share: number; effectiveAt: string; note: string }> = [];
  for (const change of changes) {
    const ownerId = Number(change.ownerId);
    const share = Number(change.share);
    const effectiveAt = change.effectiveAt ?? '';
    const note = (change.note ?? '').trim().slice(0, 200);
    if (!Number.isSafeInteger(ownerId)) return NextResponse.json({ error: 'Choose a valid partner.' }, { status: 400 });
    if (!Number.isFinite(share) || share < 0 || share > 100) return NextResponse.json({ error: 'Each share must be between 0 and 100.' }, { status: 400 });
    if (!isValidDate(effectiveAt)) return NextResponse.json({ error: 'Enter a valid effective date (YYYY-MM-DD).' }, { status: 400 });
    normalized.push({ ownerId, share, effectiveAt, note });
  }
  // Every partner must belong to this workspace.
  const validIds = new Set((await db.prepare('SELECT id FROM owners WHERE workspace_id = ?').all(workspaceId) as Array<{ id: number }>).map((row) => row.id));
  for (const change of normalized) {
    if (!validIds.has(change.ownerId)) return NextResponse.json({ error: 'A selected partner was not found in this business.' }, { status: 400 });
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  try {
    const apply = db.transaction(async () => {
      for (const change of normalized) {
        await db.prepare('INSERT INTO owner_share_changes (workspace_id, owner_id, share, effective_at, note, created_by) VALUES (?, ?, ?, ?, ?, ?)')
          .run(workspaceId, change.ownerId, change.share, change.effectiveAt, change.note, access.member.name);
        // Re-cache owners.share as the share effective on/before today only.
        // Future-dated rows take effect via getEffectiveShares once today reaches them; leave the cache at the last current value.
        const effective = await db.prepare(`SELECT share FROM owner_share_changes
          WHERE workspace_id = ? AND owner_id = ? AND substr(effective_at, 1, 10) <= ?
          ORDER BY substr(effective_at, 1, 10) DESC, id DESC LIMIT 1`).get(workspaceId, change.ownerId, todayIso) as { share: number } | undefined;
        if (effective) await db.prepare('UPDATE owners SET share = ? WHERE workspace_id = ? AND id = ?').run(Number(effective.share), workspaceId, change.ownerId);
      }
      await db.prepare('INSERT INTO audit_events (workspace_id, transaction_id, action, details, actor) VALUES (?, NULL, ?, ?, ?)')
        .run(workspaceId, 'PARTNER_SHARE_CHANGED', JSON.stringify({ changes: normalized }), access.member.name);
    });
    await apply();
    await createWorkspaceNotification({ workspaceId, actorUserId: access.member.userId, kind: 'member', title: 'Partner shares updated',
      body: `${normalized.length} share change${normalized.length === 1 ? '' : 's'} recorded`, href: '/partners' });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('Failed to update partner shares', error);
    return NextResponse.json({ error: 'Could not record the share change. Please try again.' }, { status: 500 });
  }
}
