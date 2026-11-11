import { requirePageMember } from '@/lib/page-auth';
import TransactionsClient from './transactions-client';

export default async function TransactionsPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const { session, member } = await requirePageMember();
  const { q } = (await searchParams) ?? {};
  return <TransactionsClient userName={session.user.name ?? 'Business owner'} userRole={member.role} initialQuery={(q ?? '').slice(0, 120)} />;
}
