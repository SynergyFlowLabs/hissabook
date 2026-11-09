import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace, getAccountsData, getDashboardData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createWorkspaceNotification } from '@/lib/notifications';

/**
 * Add a business account (cash box, bank account, mobile wallet).
 *
 * The opening balance is accepted here because a new account genuinely starts
 * somewhere, and a business that opens a bank account with money already in it
 * should not have to invent a fake income transaction to say so.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = ['CASH', 'BANK', 'MOBILE'] as const;

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;

  let body: { name?: string; accountType?: string; openingBalance?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const name = body.name?.trim();
  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'Enter an account name (up to 80 characters).' }, { status: 400 });
  }

  const accountType = String(body.accountType ?? 'CASH').toUpperCase();
  if (!TYPES.includes(accountType as (typeof TYPES)[number])) {
    return NextResponse.json({ error: 'Choose cash, bank, or mobile wallet.' }, { status: 400 });
  }

  const openingBalance = Math.round(Number(body.openingBalance ?? 0));
  if (!Number.isFinite(openingBalance) || Math.abs(openingBalance) > 1_000_000_000_000) {
    return NextResponse.json({ error: 'Enter a valid opening balance.' }, { status: 400 });
  }

  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    const result = await db
      .prepare(`INSERT INTO accounts (workspace_id, name, account_type, currency, opening_balance)
        VALUES (?, ?, ?, 'PKR', ?)`)
      .run(workspaceId, name, accountType, openingBalance);

    await db
      .prepare('INSERT INTO audit_events (workspace_id, transaction_id, action, details, actor) VALUES (?, NULL, ?, ?, ?)')
      .run(workspaceId, 'ACCOUNT_CREATED', `Added ${accountType.toLowerCase()} account "${name}"`, access.member.userId);

    await createWorkspaceNotification({
      workspaceId,
      actorUserId: access.member.userId,
      kind: 'transaction',
      title: 'Business account added',
      body: name,
      href: '/#accounts',
    });

    return NextResponse.json(await getDashboardData(access.member.workspaceId), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'An account with that name already exists.' }, { status: 409 });
    }
    console.error('Failed to create account', error);
    return NextResponse.json({ error: 'Could not add this account.' }, { status: 500 });
  }
}

/**
 * The accounts page payload: every account with its balance and the context the
 * page needs to decide what may be changed (see `hasHistory`).
 */
export async function GET() {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  return NextResponse.json(await getAccountsData(access.member.workspaceId));
}
