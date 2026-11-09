import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDashboardData } from '@/lib/database';
import { requireWorkspaceMember } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Just enough workspace identity for the persistent shell: name, business type,
 * role and the loan badge. Deliberately small.
 *
 * The shell is mounted once in the root layout so navigation does not tear it
 * down, which means it can no longer receive these from a page's props. Calling
 * the full dashboard endpoint here would pull the whole ledger on every route
 * change, which is the cost this change exists to remove.
 */
export async function GET() {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;

  const data = (await getDashboardData(access.member.workspaceId)) as {
    workspace: { name: string; businessType: string };
    loans: Array<{ outstanding: number }>;
  };
  const session = await auth();
  return NextResponse.json({
    userName: session?.user?.name ?? 'Business owner',
    workspaceName: data.workspace.name,
    businessType: data.workspace.businessType,
    role: access.member.role,
    loanCount: data.loans.filter((loan) => Number(loan.outstanding) > 0).length,
  });
}
