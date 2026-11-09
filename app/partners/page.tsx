import PartnersClient from './partners-client';
import { requirePageMember } from '@/lib/page-auth';

export const metadata = { title: 'Partners & shares: Hisaabook' };

export default async function PartnersPage() {
  const { session, member } = await requirePageMember();
  return <PartnersClient userName={session.user.name ?? 'Business owner'} role={member.role} />;
}
