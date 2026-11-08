import { NextRequest, NextResponse } from 'next/server';
import { acceptWorkspaceInvitation, getCredentialRecord, getInvitationByHash } from '@/lib/database';
import { hashPassword, verifyPassword } from '@/lib/passwords';
import { hashInvitationToken } from '@/lib/invitation-tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const token = body.token ?? '';
  const password = body.password ?? '';
  if (token.length < 32 || token.length > 128) return NextResponse.json({ error: 'This invitation link is invalid or expired.' }, { status: 400 });
  if (password.length < 12 || password.length > 128) return NextResponse.json({ error: 'Use a password between 12 and 128 characters.' }, { status: 400 });
  const tokenHash = hashInvitationToken(token);
  const invite = getInvitationByHash(tokenHash);
  if (!invite || invite.acceptedAt || invite.revokedAt || new Date(invite.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This invitation link is invalid, expired, or has already been used.' }, { status: 400 });
  }
  const existing = getCredentialRecord(invite.email);
  if (existing && !verifyPassword(password, existing.passwordHash)) return NextResponse.json({ error: 'This email already has an account. Enter its current password to accept the invitation.' }, { status: 401 });
  try {
    const result = acceptWorkspaceInvitation(tokenHash, existing?.passwordHash ?? hashPassword(password));
    return NextResponse.json({ ok: true, email: result.email }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVITATION_INVALID') return NextResponse.json({ error: 'This invitation link is invalid, expired, or has already been used.' }, { status: 400 });
    if (error instanceof Error && error.message === 'ALREADY_A_MEMBER') return NextResponse.json({ error: 'This account already belongs to the workspace.' }, { status: 409 });
    console.error('Failed to accept workspace invitation', error);
    return NextResponse.json({ error: 'Could not accept this invitation.' }, { status: 500 });
  }
}
