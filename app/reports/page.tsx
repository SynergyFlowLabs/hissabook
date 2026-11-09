import ReportsClient from './reports-client';
import { requirePageMember } from '@/lib/page-auth';

export const metadata = { title: 'Reports: Hisaabook' };

export default async function ReportsPage() {
  const { session, member } = await requirePageMember();
  return <ReportsClient userName={session.user.name ?? 'Business owner'} userRole={member.role} />;
}
