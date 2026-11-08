import { NextRequest, NextResponse } from 'next/server';
import { createWorkspaceInvitation, getWorkspaceAccessData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createInvitationToken, hashInvitationToken } from '@/lib/invitation-tokens';
import { DEMO_EMAIL } from '@/lib/demo-account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireWorkspaceMember([ROLE.OWNER]);
  if (access.response) return access.response;
  return NextResponse.json(await getWorkspaceAccessData(access.member.workspaceId));
}

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER]);
  if (access.response) return access.response;
  let body: { name?: string; email?: string; role?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? '';
  if (!name || name.length > 100) return NextResponse.json({ error: 'Enter a name up to 100 characters.' }, { status: 400 });
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (email === DEMO_EMAIL) return NextResponse.json({ error: 'That email is reserved for the shared demo account.' }, { status: 400 });
  if (!['ADMIN', 'BOOKKEEPER', 'VIEWER', 'PAYROLL'].includes(role)) return NextResponse.json({ error: 'Choose an available workspace role.' }, { status: 400 });
  const token = createInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const id = await createWorkspaceInvitation({ workspaceId: access.member.workspaceId, email, name, role, tokenHash: hashInvitationToken(token), expiresAt, createdBy: access.member.userId, actor: access.member.name });
    return NextResponse.json({ id, token, expiresAt }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_A_MEMBER') return NextResponse.json({ error: 'This person already has a workspace membership. Update or reactivate them from the member list.' }, { status: 409 });
    if (error instanceof Error && error.message === 'INVITATION_ALREADY_PENDING') return NextResponse.json({ error: 'An invitation for this email is already pending.' }, { status: 409 });
    console.error('Failed to create workspace invitation', error);
    return NextResponse.json({ error: 'Could not create the invitation.' }, { status: 500 });
  }
}
