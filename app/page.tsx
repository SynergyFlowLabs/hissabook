import Dashboard from './dashboard';
import { requirePageMember } from '@/lib/page-auth';

export default async function Home() {
  const { session, member } = await requirePageMember();
  return <Dashboard userName={session.user.name ?? 'Business owner'} userRole={member.role} />;
}
