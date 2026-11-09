import { NextRequest, NextResponse } from 'next/server';
import { db, updateWorkspaceMember } from '@/lib/database';
import { createWorkspaceNotification } from '@/lib/notifications';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

const editableRoles = ['ADMIN', 'BOOKKEEPER', 'VIEWER', 'PAYROLL'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER]);
  if (access.response) return access.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid member id.' }, { status: 400 });
  let body: { role?: string; active?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  if (body.role !== undefined && !editableRoles.includes(body.role)) return NextResponse.json({ error: 'Choose an available non-owner role.' }, { status: 400 });
  if (body.active !== undefined && typeof body.active !== 'boolean') return NextResponse.json({ error: 'Active must be true or false.' }, { status: 400 });
  if (body.role === undefined && body.active === undefined) return NextResponse.json({ error: 'No membership changes were provided.' }, { status: 400 });
  try {
    const updated = await updateWorkspaceMember(id, body, access.member.name, access.member.workspaceId);
    const memberRow = await db.prepare('SELECT u.display_name FROM workspace_members wm JOIN users u ON u.id = wm.user_id WHERE wm.id = ?').get(id) as { display_name: string } | undefined;
    const change = body.role ? `role → ${body.role}` : body.active === false ? 'deactivated' : body.active === true ? 'reactivated' : 'updated';
    await createWorkspaceNotification({ workspaceId: access.member.workspaceId, actorUserId: access.member.userId, kind: 'member', title: 'Member updated', body: `${memberRow?.display_name ?? 'Member'} · ${change}`, href: '/' });
    return NextResponse.json(updated);
  }
  catch (error) {
    if (error instanceof Error && error.message === 'MEMBER_NOT_FOUND') return NextResponse.json({ error: 'Workspace member not found.' }, { status: 404 });
    if (error instanceof Error && error.message === 'OWNER_ACCESS_PROTECTED') return NextResponse.json({ error: 'Owner access cannot be changed here.' }, { status: 409 });
    console.error('Failed to update workspace member', error);
    return NextResponse.json({ error: 'Could not update workspace access.' }, { status: 500 });
  }
}
