import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Dashboard from './dashboard';
import LandingPage from '@/components/landing-page';
import { getWorkspaceMember } from '@/lib/database';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) return <LandingPage />;

  const member = await getWorkspaceMember(Number(session.user.id));
  if (!member) redirect('/login');
  return <Dashboard userName={session.user.name ?? 'Business owner'} userRole={member.role} />;
}
