import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace, getDashboardData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createWorkspaceNotification } from '@/lib/notifications';

/**
 * Rename an account or change its type.
 *
 * Deliberately narrow: the balance is derived from the ledger, so it is not
 * editable here. Letting someone type a balance would invent money that no
 * transaction explains, and the whole point of the book is that every rupee is
 * attributable. The opening balance is only editable while the account has no
 * transactions, which is the one moment it is genuinely a starting fact rather
 * than a rewrite of history.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = ['CASH', 'BANK', 'MOBILE'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;

  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: 'Unknown account.' }, { status: 400 });
  }

  let body: { name?: string; accountType?: string; openingBalance?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    const current = await db
      .prepare('SELECT id, name, account_type AS accountType, opening_balance AS openingBalance FROM accounts WHERE id = ? AND workspace_id = ?')
      .get(accountId, workspaceId) as { id: number; name: string; accountType: string; openingBalance: number } | undefined;
    if (!current) return NextResponse.json({ error: 'That account no longer exists.' }, { status: 404 });

    const nextName = body.name === undefined ? current.name : body.name.trim();
    if (!nextName || nextName.length > 80) return NextResponse.json({ error: 'Enter an account name (up to 80 characters).' }, { status: 400 });

    const nextType = body.accountType === undefined ? current.accountType : String(body.accountType).toUpperCase();
    if (!TYPES.includes(nextType as (typeof TYPES)[number])) {
      return NextResponse.json({ error: 'Choose cash, bank, or mobile wallet.' }, { status: 400 });
    }

    let nextOpening = current.openingBalance;
    if (body.openingBalance !== undefined) {
      nextOpening = Math.round(Number(body.openingBalance));
      if (!Number.isFinite(nextOpening) || Math.abs(nextOpening) > 1_000_000_000_000) {
        return NextResponse.json({ error: 'Enter a valid opening balance.' }, { status: 400 });
      }
      if (nextOpening !== current.openingBalance) {
        const used = await db
          .prepare('SELECT COUNT(*) AS count FROM transactions WHERE workspace_id = ? AND (account_id = ? OR destination_account_id = ?)')
          .get(workspaceId, accountId, accountId) as { count: number };
        if (used.count > 0) {
          return NextResponse.json(
            { error: 'This account already has transactions. Its opening balance is now historical, so it cannot be changed.' },
            { status: 409 },
          );
        }
      }
    }

    if (nextName === current.name && nextType === current.accountType && nextOpening === current.openingBalance) {
      return NextResponse.json(await getDashboardData(access.member.workspaceId));
    }

    await db
      .prepare('UPDATE accounts SET name = ?, account_type = ?, opening_balance = ? WHERE id = ? AND workspace_id = ?')
      .run(nextName, nextType, nextOpening, accountId, workspaceId);

    const description = nextName !== current.name
      ? `Renamed "${current.name}" to "${nextName}"`
      : `Updated "${nextName}"`;
    await db
      .prepare('INSERT INTO audit_events (workspace_id, action, details, actor) VALUES (?, ?, ?, ?)')
      .run(workspaceId, 'ACCOUNT_UPDATED', description, access.member.userId);

    await createWorkspaceNotification({
      workspaceId,
      actorUserId: access.member.userId,
      kind: 'transaction',
      title: 'Business account updated',
      body: description,
      href: '/#accounts',
    });

    return NextResponse.json(await getDashboardData(access.member.workspaceId));
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'An account with that name already exists.' }, { status: 409 });
    }
    console.error('Failed to update account', error);
    return NextResponse.json({ error: 'Could not save this account.' }, { status: 500 });
  }
}

/** Accounts can only be removed while nothing references them. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;

  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: 'Unknown account.' }, { status: 400 });
  }

  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    const current = await db
      .prepare('SELECT name FROM accounts WHERE id = ? AND workspace_id = ?')
      .get(accountId, workspaceId) as { name: string } | undefined;
    if (!current) return NextResponse.json({ error: 'That account no longer exists.' }, { status: 404 });

    const remaining = await db
      .prepare('SELECT COUNT(*) AS count FROM accounts WHERE workspace_id = ?')
      .get(workspaceId) as { count: number };
    if (remaining.count <= 1) {
      return NextResponse.json({ error: 'Keep at least one account so the book has somewhere to post.' }, { status: 409 });
    }

    const used = await db
      .prepare('SELECT COUNT(*) AS count FROM transactions WHERE workspace_id = ? AND (account_id = ? OR destination_account_id = ?)')
      .get(workspaceId, accountId, accountId) as { count: number };
    if (used.count > 0) {
      return NextResponse.json(
        { error: 'This account has transactions. Rename it instead, so the history stays readable.' },
        { status: 409 },
      );
    }

    await db.prepare('DELETE FROM accounts WHERE id = ? AND workspace_id = ?').run(accountId, workspaceId);
    await db
      .prepare('INSERT INTO audit_events (workspace_id, action, details, actor) VALUES (?, ?, ?, ?)')
      .run(workspaceId, 'ACCOUNT_DELETED', `Removed unused account "${current.name}"`, access.member.userId);

    return NextResponse.json(await getDashboardData(access.member.workspaceId));
  } catch (error) {
    console.error('Failed to delete account', error);
    return NextResponse.json({ error: 'Could not remove this account.' }, { status: 500 });
  }
}
