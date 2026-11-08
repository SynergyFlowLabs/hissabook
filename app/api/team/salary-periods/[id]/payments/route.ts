import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace, getTeamData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.PAYROLL]);
  if (access.response) return access.response;
  let body: { amount?: number; accountId?: number; paidAt?: string; note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const { id: rawId } = await params;
  const periodId = Number(rawId);
  const amount = Number(body.amount);
  const accountId = Number(body.accountId);
  const paidAt = body.paidAt || new Date().toISOString().slice(0, 10);
  if (!Number.isSafeInteger(periodId) || periodId <= 0) return NextResponse.json({ error: 'Choose a valid salary period.' }, { status: 400 });
  if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: 'Payment must be a positive whole-PKR amount.' }, { status: 400 });
  if (!Number.isSafeInteger(accountId)) return NextResponse.json({ error: 'Choose a business account.' }, { status: 400 });
  if (!validDate(paidAt)) return NextResponse.json({ error: 'Enter a valid payment date.' }, { status: 400 });

  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    const period = await db.prepare(`SELECT p.id, p.employee_id AS employeeId, p.amount_due AS amountDue,
      p.period_start AS periodStart, p.period_end AS periodEnd, e.name AS employeeName
      FROM salary_periods p JOIN employees e ON e.id = p.employee_id
      WHERE p.id = ? AND p.workspace_id = ?`).get(periodId, workspaceId) as {
        id: number; employeeId: number; amountDue: number; periodStart: string; periodEnd: string; employeeName: string;
      } | undefined;
    if (!period) return NextResponse.json({ error: 'Salary period not found.' }, { status: 404 });
    const account = await db.prepare('SELECT id FROM accounts WHERE id = ? AND workspace_id = ?').get(accountId, workspaceId);
    if (!account) return NextResponse.json({ error: 'Choose a valid business account.' }, { status: 400 });
    const paid = await db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM salary_payments WHERE salary_period_id = ?').get(periodId) as { total: number };
    const remaining = period.amountDue - paid.total;
    if (remaining <= 0) return NextResponse.json({ error: 'This salary period is already fully paid.' }, { status: 409 });
    if (amount > remaining) return NextResponse.json({ error: `Payment is more than the remaining salary due (${remaining.toLocaleString()} PKR).` }, { status: 400 });

    const recordPayment = db.transaction(async () => {
      const description = `Salary payment · ${period.employeeName} (${period.periodStart} – ${period.periodEnd})`;
      const transactionResult = await db.prepare(`INSERT INTO transactions
        (workspace_id, account_id, type, amount, description, category, note, transaction_date, status, created_by)
        VALUES (?, ?, 'EXPENSE', ?, ?, 'Salaries & wages', ?, ?, 'CLEARED', ?)`)
        .run(workspaceId, accountId, amount, description, body.note?.trim().slice(0, 1000) || '', `${paidAt}T12:00:00.000Z`, access.member.name);
      const transactionId = Number(transactionResult.lastInsertRowid);
      await db.prepare(`INSERT INTO salary_payments (salary_period_id, transaction_id, amount, paid_at, note)
        VALUES (?, ?, ?, ?, ?)`)
        .run(periodId, transactionId, amount, `${paidAt}T12:00:00.000Z`, body.note?.trim().slice(0, 1000) || '');
      await db.prepare('INSERT INTO audit_events (workspace_id, transaction_id, action, details, actor) VALUES (?, ?, ?, ?, ?)')
        .run(workspaceId, transactionId, 'SALARY_PAYMENT_RECORDED', JSON.stringify({ periodId, employeeId: period.employeeId, amount }), access.member.name);
    });
    await recordPayment();
    return NextResponse.json(await getTeamData(access.member.workspaceId), { status: 201 });
  } catch (error) {
    console.error('Failed to record salary payment', error);
    return NextResponse.json({ error: 'Could not record this salary payment.' }, { status: 500 });
  }
}
