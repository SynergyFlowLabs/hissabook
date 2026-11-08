import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getWorkspaceMember, isSetupComplete } from '@/lib/database';

export async function requirePageMember(roles?: string[]) {
  const session = await auth();
  if (!session?.user?.id) redirect(isSetupComplete() ? '/login' : '/setup');
  const member = getWorkspaceMember(Number(session.user.id));
  if (!member) redirect('/login');
  if (roles && !roles.includes(member.role)) redirect('/');
  return { session, member };
}
