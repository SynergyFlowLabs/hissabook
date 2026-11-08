import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getWorkspaceMember } from '@/lib/database';

export const ROLE = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  BOOKKEEPER: 'BOOKKEEPER',
  VIEWER: 'VIEWER',
  PAYROLL: 'PAYROLL',
} as const;

export type WorkspaceMember = NonNullable<ReturnType<typeof getWorkspaceMember>>;

type AuthorizationResult =
  | { member: WorkspaceMember; response: null }
  | { member: null; response: NextResponse };

export async function requireWorkspaceMember(roles?: string[]): Promise<AuthorizationResult> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return { member: null, response: NextResponse.json({ error: 'Sign in to access this business.' }, { status: 401 }) };
  }
  const member = getWorkspaceMember(userId);
  if (!member) return { member: null, response: NextResponse.json({ error: 'You do not have access to this business.' }, { status: 403 }) };
  if (roles && !roles.includes(member.role)) {
    return { member: null, response: NextResponse.json({ error: 'Your workspace role does not allow this action.' }, { status: 403 }) };
  }
  return { member, response: null };
}
