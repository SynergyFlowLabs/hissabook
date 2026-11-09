import { getAccountsData } from '@/lib/database';
import { requirePageMember } from '@/lib/page-auth';
import { ROLE } from '@/lib/authorization';
import AccountsClient from './accounts-client';

export const metadata = { title: 'Accounts: Hisaabook' };

/**
 * Accounts management, on its own screen.
 *
 * The page fetches its payload on the server as well as in the client, and hands
 * the result down as the client's initial state. That way the account list is in
 * the first paint even before the client component's own fetch resolves: the
 * skeleton is for a route that has not arrived yet, not for data the server
 * already had in hand.
 *
 * Reading is open to every member of the workspace, including payroll. Only
 * owners and admins may write, so the role is passed down and the actions stay
 * hidden rather than being offered and then refused by the API.
 */
export default async function AccountsPage() {
  const { session, member } = await requirePageMember([ROLE.OWNER, ROLE.ADMIN, ROLE.BOOKKEEPER, ROLE.VIEWER]);
  const initial = await getAccountsData(member.workspaceId);
  return (
    <AccountsClient
      userName={session.user.name ?? 'Business owner'}
      userRole={member.role}
      initial={initial}
    />
  );
}
