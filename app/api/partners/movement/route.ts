import { NextRequest, NextResponse } from 'next/server';
import { ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createWorkspaceNotification } from '@/lib/notifications';
import { postPartnerMovement, MovementError, type PostMovementInput } from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.BOOKKEEPER]);
  if (access.response) return access.response;
  let body: PostMovementInput;
  try {
    body = await request.json() as PostMovementInput;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || typeof (body as { kind?: unknown }).kind !== 'string') {
    return NextResponse.json({ error: 'Choose a movement kind.' }, { status: 400 });
  }
  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
  try {
    const result = await postPartnerMovement(workspaceId, body, { name: access.member.name, userId: access.member.userId });
    await createWorkspaceNotification({ workspaceId, actorUserId: access.member.userId, kind: 'transaction',
      title: result.title, body: result.body, href: '/partners' });
    return NextResponse.json({ ok: true, transactionId: result.transactionId }, { status: 201 });
  } catch (error) {
    if (error instanceof MovementError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to post partner movement', error);
    return NextResponse.json({ error: 'Could not save this movement. Please try again.' }, { status: 500 });
  }
}


