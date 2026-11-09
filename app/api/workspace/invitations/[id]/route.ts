import { NextResponse } from 'next/server';
import { db, getWorkspaceAccessData, revokeWorkspaceInvitation } from '@/lib/database';
import { createWorkspaceNotification } from '@/lib/notifications';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER]);
  if (access.response) return access.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid invitation id.' }, { status: 400 });
  if (!await revokeWorkspaceInvitation(id, access.member.name, access.member.workspaceId)) return NextResponse.json({ error: 'Pending invitation not found.' }, { status: 404 });
  {
    const pendingRow = await db.prepare('SELECT email FROM workspace_invitations WHERE id = ?').get(id) as { email: string } | undefined;
    await createWorkspaceNotification({ workspaceId: access.member.workspaceId, actorUserId: access.member.userId, kind: 'invitation', title: 'Invitation revoked', body: pendingRow?.email ?? 'A pending invitation was revoked.', href: '/' });
  }
  return NextResponse.json(await getWorkspaceAccessData(access.member.workspaceId));
}
