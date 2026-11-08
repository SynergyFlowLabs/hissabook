import { requirePageMember } from '@/lib/page-auth';
import TransactionsClient from './transactions-client';

export default async function TransactionsPage() {
  const { session, member } = await requirePageMember();
  return <TransactionsClient userName={session.user.name ?? 'Business owner'} userRole={member.role} />;
}
