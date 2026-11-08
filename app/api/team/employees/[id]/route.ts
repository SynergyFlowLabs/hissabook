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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.PAYROLL]);
  if (access.response) return access.response;
  let body: { name?: string; jobTitle?: string; employeeRef?: string; startDate?: string; active?: boolean; monthlySalary?: number; rateEffectiveFrom?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid employee.' }, { status: 400 });
  if (body.name !== undefined && (!body.name.trim() || body.name.trim().length > 100)) return NextResponse.json({ error: 'Enter an employee name (up to 100 characters).' }, { status: 400 });
  if (body.startDate && !validDate(body.startDate)) return NextResponse.json({ error: 'Enter a valid start date.' }, { status: 400 });
  if (body.monthlySalary !== undefined && (!Number.isSafeInteger(Number(body.monthlySalary)) || Number(body.monthlySalary) <= 0)) return NextResponse.json({ error: 'Monthly salary must be a positive whole-PKR amount.' }, { status: 400 });
  if (body.monthlySalary !== undefined && (!body.rateEffectiveFrom || !validDate(body.rateEffectiveFrom))) return NextResponse.json({ error: 'Choose an effective date for the new salary rate.' }, { status: 400 });
  if (body.active !== undefined && typeof body.active !== 'boolean') return NextResponse.json({ error: 'Employee status must be active or inactive.' }, { status: 400 });

  try {
    const workspaceId = ensureDemoWorkspace();
    const current = db.prepare('SELECT id, name, job_title AS jobTitle, employee_ref AS employeeRef, start_date AS startDate, active FROM employees WHERE id = ? AND workspace_id = ?').get(id, workspaceId) as { id: number; name: string; jobTitle: string; employeeRef: string; startDate: string; active: number } | undefined;
    if (!current) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    const name = body.name?.trim() ?? current.name;
    const jobTitle = body.jobTitle?.trim().slice(0, 80) ?? current.jobTitle;
    const employeeRef = body.employeeRef?.trim().slice(0, 40) ?? current.employeeRef;
    const startDate = body.startDate ?? current.startDate;
    if (body.monthlySalary !== undefined) {
      const existingRate = db.prepare('SELECT amount FROM salary_rates WHERE employee_id = ? AND effective_from = ?').get(id, body.rateEffectiveFrom) as { amount: number } | undefined;
      if (existingRate) {
        if (existingRate.amount !== Number(body.monthlySalary)) return NextResponse.json({ error: 'A salary rate already exists on that date. Choose a different effective date to preserve rate history.' }, { status: 409 });
        return NextResponse.json({ error: 'That salary rate is already recorded.' }, { status: 409 });
      }
    }
    const updateEmployee = db.transaction(() => {
      const active = body.active === undefined ? Boolean(current.active) : body.active;
      db.prepare(`UPDATE employees SET name = ?, job_title = ?, employee_ref = ?, start_date = ?, active = ?, end_date = ?
        WHERE id = ? AND workspace_id = ?`)
        .run(name, jobTitle, employeeRef, startDate, active ? 1 : 0, active ? null : new Date().toISOString().slice(0, 10), id, workspaceId);
      if (body.monthlySalary !== undefined && body.rateEffectiveFrom) {
        db.prepare('INSERT INTO salary_rates (employee_id, amount, currency, effective_from) VALUES (?, ?, ?, ?)')
          .run(id, Number(body.monthlySalary), 'PKR', body.rateEffectiveFrom);
      }
      db.prepare('INSERT INTO audit_events (workspace_id, action, details) VALUES (?, ?, ?)')
        .run(workspaceId, body.active === false ? 'EMPLOYEE_DEACTIVATED' : body.active === true ? 'EMPLOYEE_REACTIVATED' : 'EMPLOYEE_UPDATED', JSON.stringify({ employeeId: id, name, jobTitle, active: body.active ?? Boolean(current.active), salaryChanged: body.monthlySalary !== undefined }));
    });
    updateEmployee();
    return NextResponse.json(getTeamData());
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) return NextResponse.json({ error: 'Another employee already uses that name or salary effective date.' }, { status: 409 });
    console.error('Failed to update employee', error);
    return NextResponse.json({ error: 'Could not update this employee.' }, { status: 500 });
  }
}
