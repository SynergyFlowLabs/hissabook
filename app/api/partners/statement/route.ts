import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { csvAttachment, csvNum } from '@/lib/csv';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const TYPE_LABEL: Record<string, string> = {
  CAPITAL_CONTRIBUTION: 'Capital added',
  CAPITAL_RETURN: 'Capital returned',
  EXPENSE_PAID: 'Fronted business expense',
  ADVANCE_REIMBURSED: 'Expense reimbursed',
  CASH_WITHDRAWAL: 'Counter drawing',
  INTEREST_ON_CAPITAL: 'Interest on capital',
  INTEREST_ON_DRAWINGS: 'Interest on drawings',
  PARTNER_SALARY: 'Partner salary',
  PARTNER_COMMISSION: 'Partner commission',
  PROFIT_SHARE: 'Share of profit',
  LOSS_SHARE: 'Share of loss',
  SETTLEMENT: 'Settlement',
  CORRECTION: 'Correction',
};
const CAPITAL_TYPES = new Set(['CAPITAL_CONTRIBUTION', 'CAPITAL_RETURN']);

export async function GET(request: NextRequest) {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
  const params = request.nextUrl.searchParams;
  const ownerId = Number(params.get('ownerId'));
  if (!Number.isSafeInteger(ownerId)) return NextResponse.json({ error: 'Choose a valid partner.' }, { status: 400 });
  const todayIso = new Date().toISOString().slice(0, 10);
  const from = params.get('from') ?? `${todayIso.slice(0, 7)}-01`;
  const to = params.get('to') ?? todayIso;
  if (!isValidDate(from) || !isValidDate(to)) return NextResponse.json({ error: 'Enter valid start and end dates.' }, { status: 400 });
  if (from > to) return NextResponse.json({ error: 'The start date must be on or before the end date.' }, { status: 400 });
  const csv = params.get('format') === 'csv';

  const partner = await db.prepare('SELECT id, name, role, user_id AS userId FROM owners WHERE id = ? AND workspace_id = ?').get(ownerId, workspaceId) as { id: number; name: string; role: string; userId: number | null } | undefined;
  if (!partner) return NextResponse.json({ error: 'The selected partner was not found in this business.' }, { status: 404 });
  // Privacy: OWNER/ADMIN always; other members only if the partner links to them.
  const privileged = ([ROLE.OWNER, ROLE.ADMIN] as string[]).includes(access.member.role);
  const self = partner.userId !== null && Number(partner.userId) === access.member.userId;
  if (!privileged && !self) return NextResponse.json({ error: 'Partner statements are restricted to owners and the partner themself.' }, { status: 403 });

  const openingRows = await db.prepare(`SELECT entry_type AS entryType, direction, SUM(amount) AS total FROM partner_entries
    WHERE workspace_id = ? AND owner_id = ? AND substr(transaction_date, 1, 10) < ? GROUP BY entry_type, direction`)
    .all(workspaceId, ownerId, from) as Array<{ entryType: string; direction: 'CREDIT' | 'DEBIT'; total: number }>;
  const opening = { capital: 0, current: 0 };
  for (const row of openingRows) {
    const sign = row.direction === 'CREDIT' ? 1 : -1;
    if (CAPITAL_TYPES.has(row.entryType)) opening.capital += sign * Number(row.total);
    else opening.current += sign * Number(row.total);
  }

  const rows = await db.prepare(`SELECT id, entry_type AS entryType, direction, amount, note, transaction_id AS transactionId,
      substr(transaction_date, 1, 10) AS date FROM partner_entries
    WHERE workspace_id = ? AND owner_id = ? AND substr(transaction_date, 1, 10) BETWEEN ? AND ?
    ORDER BY substr(transaction_date, 1, 10) ASC, id ASC`)
    .all(workspaceId, ownerId, from, to) as Array<{ id: number; entryType: string; direction: 'CREDIT' | 'DEBIT'; amount: number; note: string; transactionId: number | null; date: string }>;

  let capital = opening.capital;
  let current = opening.current;
  const ledger = rows.map((row) => {
    const sign = row.direction === 'CREDIT' ? 1 : -1;
    if (CAPITAL_TYPES.has(row.entryType)) capital += sign * Number(row.amount);
    else current += sign * Number(row.amount);
    return { ...row, amount: Number(row.amount), bucket: CAPITAL_TYPES.has(row.entryType) ? 'capital' as const : 'current' as const,
      label: TYPE_LABEL[row.entryType] ?? row.entryType, runningCurrent: current, runningCapital: capital };
  });

  if (csv) {
    const headers = ['Date', 'Type', 'Bucket', 'Direction', 'Amount (PKR)', 'Current account balance (PKR)', 'Capital balance (PKR)', 'Note'];
    const body = ledger.map((row) => [row.date, row.label, row.bucket, row.direction === 'CREDIT' ? 'In (firm owes partner)' : 'Out (partner takes)',
      csvNum(row.amount), csvNum(row.runningCurrent), csvNum(row.runningCapital), row.note]);
    const meta = [
      `Partner statement - ${partner.name} (${partner.role})`,
      `Period ${from} to ${to}`,
      `Opening balance - current ${opening.current}, capital ${opening.capital}`,
      `Closing balance - current ${current}, capital ${capital}`,
      `Prepared by Hisaabook · ${new Date().toISOString()}`,
    ];
    const file = csvAttachment(meta, headers, body);
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="partner-statement-${partner.id}-${from}-to-${to}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return NextResponse.json({
    partner: { id: partner.id, name: partner.name, role: partner.role },
    from, to,
    opening,
    rows: ledger,
    closing: { capital, current },
    summary: {
      fronted: ledger.filter((r) => r.entryType === 'EXPENSE_PAID').reduce((s, r) => s + r.amount, 0),
      reimbursed: ledger.filter((r) => r.entryType === 'ADVANCE_REIMBURSED').reduce((s, r) => s + r.amount, 0),
      drawings: ledger.filter((r) => r.entryType === 'CASH_WITHDRAWAL').reduce((s, r) => s + r.amount, 0),
    },
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
