import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth-form';
import { auth } from '@/auth';
import { isSetupComplete } from '@/lib/database';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/');
  if (!await isSetupComplete()) redirect('/setup');
  return <AuthForm mode="login" />;
}
