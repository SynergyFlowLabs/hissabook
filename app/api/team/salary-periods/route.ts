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

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.PAYROLL]);
  if (access.response) return access.response;
  let body: { employeeId?: number; periodStart?: string; periodEnd?: string; dueDate?: string; amountDue?: number; note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const employeeId = Number(body.employeeId);
  const periodStart = body.periodStart ?? '';
  const periodEnd = body.periodEnd ?? '';
  const dueDate = body.dueDate ?? '';
  const specifiedAmount = body.amountDue === undefined || body.amountDue === null ? null : Number(body.amountDue);
  if (!Number.isSafeInteger(employeeId)) return NextResponse.json({ error: 'Choose an employee.' }, { status: 400 });
  if (!validDate(periodStart) || !validDate(periodEnd) || periodEnd < periodStart || !validDate(dueDate)) return NextResponse.json({ error: 'Enter a valid salary period and due date.' }, { status: 400 });
  if (specifiedAmount !== null && (!Number.isSafeInteger(specifiedAmount) || specifiedAmount < 1 || specifiedAmount > 1_000_000_000)) return NextResponse.json({ error: 'Salary due must be a positive whole-PKR amount.' }, { status: 400 });

  try {
    const workspaceId = await ensureDemoWorkspace();
    const employee = await db.prepare('SELECT id FROM employees WHERE id = ? AND workspace_id = ? AND active = 1').get(employeeId, workspaceId);
    if (!employee) return NextResponse.json({ error: 'The selected active employee was not found.' }, { status: 404 });
    const rate = await db.prepare(`SELECT id, amount FROM salary_rates WHERE employee_id = ? AND effective_from <= ?
      ORDER BY effective_from DESC LIMIT 1`).get(employeeId, periodEnd) as { id: number; amount: number } | undefined;
    const amountDue = specifiedAmount ?? rate?.amount;
    if (!amountDue) return NextResponse.json({ error: 'No salary rate is effective for this period. Add a rate or enter the amount due.' }, { status: 400 });
    await db.prepare(`INSERT INTO salary_periods
      (workspace_id, employee_id, salary_rate_id, period_start, period_end, due_date, amount_due, currency, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PKR', ?)`)
      .run(workspaceId, employeeId, rate?.id ?? null, periodStart, periodEnd, dueDate, amountDue, body.note?.trim().slice(0, 500) || '');
    await db.prepare('INSERT INTO audit_events (workspace_id, action, details) VALUES (?, ?, ?)')
      .run(workspaceId, 'SALARY_PERIOD_CREATED', JSON.stringify({ employeeId, periodStart, periodEnd, amountDue }));
    return NextResponse.json(await getTeamData(), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'A salary period already exists for this employee and date range.' }, { status: 409 });
    }
    console.error('Failed to create salary period', error);
    return NextResponse.json({ error: 'Could not save this salary period.' }, { status: 500 });
  }
}
