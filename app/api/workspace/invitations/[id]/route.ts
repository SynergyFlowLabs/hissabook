import { NextResponse } from 'next/server';
import { getWorkspaceAccessData, revokeWorkspaceInvitation } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER]);
  if (access.response) return access.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid invitation id.' }, { status: 400 });
  if (!await revokeWorkspaceInvitation(id, access.member.name)) return NextResponse.json({ error: 'Pending invitation not found.' }, { status: 404 });
  return NextResponse.json(await getWorkspaceAccessData());
}
