import TeamClient from './team-client';
import { requirePageMember } from '@/lib/page-auth';
import { ROLE } from '@/lib/authorization';

export const metadata = { title: 'Team & salaries: Hisaabook' };

export default async function TeamPage() {
  const { session, member } = await requirePageMember([ROLE.OWNER, ROLE.ADMIN, ROLE.PAYROLL]);
  return <TeamClient userName={session.user.name ?? 'Business owner'} role={member.role} />;
}
