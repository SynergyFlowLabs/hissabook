import InventoryClient from './inventory-client';
import { requirePageMember } from '@/lib/page-auth';

export const metadata = { title: 'Inventory: Hisaabook' };

export default async function InventoryPage() {
  const { session, member } = await requirePageMember();
  return <InventoryClient userName={session.user.name ?? 'Business owner'} role={member.role} />;
}
