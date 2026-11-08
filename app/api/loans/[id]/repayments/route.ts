import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace, getDashboardData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.BOOKKEEPER]);
  if (access.response) return access.response;
  const { id: rawId } = await params;
  const loanId = Number(rawId);
  if (!Number.isSafeInteger(loanId) || loanId <= 0) return NextResponse.json({ error: 'Invalid loan id.' }, { status: 400 });
  let body: { principalAmount?: number; feeAmount?: number; feeDescription?: string; accountId?: number; transactionDate?: string; note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const principalAmount = Number(body.principalAmount);
  const feeAmount = body.feeAmount === undefined || body.feeAmount === null ? 0 : Number(body.feeAmount);
  const accountId = Number(body.accountId);
  const transactionDate = body.transactionDate === undefined ? new Date().toISOString().slice(0, 10) : typeof body.transactionDate === 'string' ? body.transactionDate : '';
  const feeDescription = typeof body.feeDescription === 'string' ? body.feeDescription.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!Number.isSafeInteger(principalAmount) || principalAmount <= 0) return NextResponse.json({ error: 'Principal repayment must be a positive whole PKR amount.' }, { status: 400 });
  if (!Number.isSafeInteger(feeAmount) || feeAmount < 0) return NextResponse.json({ error: 'Fee or interest must be a whole PKR amount of zero or more.' }, { status: 400 });
  if (feeAmount > 0 && !feeDescription) return NextResponse.json({ error: 'Describe the separate interest or fee amount.' }, { status: 400 });
  if (feeDescription.length > 120 || note.length > 1000) return NextResponse.json({ error: 'Descriptions are too long.' }, { status: 400 });
  if (!Number.isSafeInteger(accountId) || accountId <= 0) return NextResponse.json({ error: 'Choose a valid business account.' }, { status: 400 });
  if (!isValidDate(transactionDate)) return NextResponse.json({ error: 'Enter a valid repayment date.' }, { status: 400 });

  const workspaceId = await ensureDemoWorkspace();
  const loan = await db.prepare(`SELECT id, direction, name, counterparty, outstanding FROM loans WHERE id = ? AND workspace_id = ?`).get(loanId, workspaceId) as
    { id: number; direction: 'PAYABLE' | 'RECEIVABLE'; name: string; counterparty: string; outstanding: number } | undefined;
  if (!loan) return NextResponse.json({ error: 'Loan not found in this business.' }, { status: 404 });
  if (loan.outstanding <= 0) return NextResponse.json({ error: 'This loan is already settled.' }, { status: 409 });
  if (principalAmount > loan.outstanding) return NextResponse.json({ error: `Principal repayment cannot exceed the remaining ${loan.outstanding} PKR.` }, { status: 400 });
  const account = await db.prepare('SELECT id FROM accounts WHERE id = ? AND workspace_id = ?').get(accountId, workspaceId);
  if (!account) return NextResponse.json({ error: 'The selected account was not found in this business.' }, { status: 400 });

  try {
    const saveRepayment = db.transaction(async () => {
      const updated = await db.prepare('UPDATE loans SET outstanding = outstanding - ? WHERE id = ? AND workspace_id = ? AND outstanding >= ?')
        .run(principalAmount, loanId, workspaceId, principalAmount);
      if (updated.changes !== 1) throw new Error('REPAYMENT_EXCEEDS_BALANCE');
      const repaymentId = Number((await db.prepare(`INSERT INTO loan_repayments
        (workspace_id, loan_id, account_id, principal_amount, fee_amount, fee_description, transaction_date, note, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(workspaceId, loanId, accountId, principalAmount, feeAmount, feeDescription, `${transactionDate}T12:00:00.000Z`, note, access.member.name)).lastInsertRowid);
      let feeTransactionId: number | null = null;
      if (feeAmount > 0) {
        const feeType = loan.direction === 'PAYABLE' ? 'EXPENSE' : 'INCOME';
        const feeLabel = loan.direction === 'PAYABLE' ? 'Loan interest & fees' : 'Loan interest received';
        const result = await db.prepare(`INSERT INTO transactions
          (workspace_id, account_id, loan_id, type, amount, description, category, counterparty, note, transaction_date, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(workspaceId, accountId, loanId, feeType, feeAmount, `${feeDescription} · ${loan.name}`.slice(0, 160), feeLabel, loan.counterparty, `Related to loan repayment #${repaymentId}`, `${transactionDate}T12:00:00.000Z`, access.member.name);
        feeTransactionId = Number(result.lastInsertRowid);
      }
      await db.prepare('INSERT INTO audit_events (workspace_id, transaction_id, action, details, actor) VALUES (?, ?, ?, ?, ?)')
        .run(workspaceId, feeTransactionId, 'LOAN_REPAYMENT_RECORDED', JSON.stringify({ repaymentId, loanId, direction: loan.direction, principalAmount, feeAmount, outstandingAfter: loan.outstanding - principalAmount }), access.member.name);
      return repaymentId;
    });
    const repaymentId = await saveRepayment();
    return NextResponse.json({ ...await getDashboardData(), createdRepaymentId: repaymentId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'REPAYMENT_EXCEEDS_BALANCE') return NextResponse.json({ error: 'The repayment exceeds the remaining loan balance.' }, { status: 409 });
    console.error('Failed to record loan repayment', error);
    return NextResponse.json({ error: 'Could not record this loan repayment.' }, { status: 500 });
  }
}
