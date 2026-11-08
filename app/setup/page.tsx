import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth-form';
import { auth } from '@/auth';
import { isSetupComplete } from '@/lib/database';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const session = await auth();
  if (session?.user) redirect('/');
  if (isSetupComplete()) redirect('/login');
  return <AuthForm mode="setup" />;
}
