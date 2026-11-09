import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember } from '@/lib/authorization';
import { csvAttachment, csvNum } from '@/lib/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
const today = () => new Date().toISOString().slice(0, 10);

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
  SETTLEMENT: 'Exit settlement',
  CORRECTION: 'Correction',
};

/**
 * Workspace-wide partner sub-ledger export (member-gated).
 * JSON by default; `?format=csv` returns an Excel-safe attachment.
 */
export async function GET(request: NextRequest) {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
  const params = request.nextUrl.searchParams;
  const fromParam = params.get('from') ?? '1970-01-01'; // default: full history
  const toParam = params.get('to') ?? today();
  const from = fromParam.slice(0, 10);
  const to = toParam.slice(0, 10);
  if (!isValidDate(from) || !isValidDate(to)) return NextResponse.json({ error: 'Enter valid start and end dates.' }, { status: 400 });
  if (from > to) return NextResponse.json({ error: 'The start date must be on or before the end date.' }, { status: 400 });

  const rows = await db.prepare(`SELECT pe.id, o.name AS partner, pe.entry_type AS entryType, pe.direction,
      pe.amount, pe.note, substr(pe.transaction_date, 1, 10) AS date, pe.created_by AS createdBy
    FROM partner_entries pe JOIN owners o ON o.id = pe.owner_id
    WHERE pe.workspace_id = ? AND substr(pe.transaction_date, 1, 10) BETWEEN ? AND ?
    ORDER BY substr(pe.transaction_date, 1, 10) ASC, pe.id ASC LIMIT 5000`)
    .all(workspaceId, from, to) as Array<{ id: number; partner: string; entryType: string; direction: 'CREDIT' | 'DEBIT'; amount: number; note: string; date: string; createdBy: string }>;

  const movements = rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    label: TYPE_LABEL[row.entryType] ?? row.entryType,
  }));

  if (params.get('format') === 'csv') {
    const headers = ['Date', 'Partner', 'Entry type', 'Direction', 'Amount (PKR)', 'Note', 'Posted by'];
    const body = movements.map((row) => [row.date, row.partner, row.label,
      row.direction === 'CREDIT' ? 'In (firm owes partner)' : 'Out (partner takes)',
      csvNum(row.amount), row.note, row.createdBy]);
    const meta = [
      'Hisaabook partner ledger movements',
      `Period ${from} to ${to} · ${movements.length} row(s)`,
      `Prepared by Hisaabook · ${new Date().toISOString()}`,
    ];
    const file = csvAttachment(meta, headers, body);
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="partner-movements-${from}-to-${to}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return NextResponse.json({ from, to, movements, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'private, no-store' } });
}
