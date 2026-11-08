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
  let body: { name?: string; jobTitle?: string; employeeRef?: string; startDate?: string; monthlySalary?: number; rateEffectiveFrom?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const name = body.name?.trim();
  const startDate = body.startDate || new Date().toISOString().slice(0, 10);
  const salary = Number(body.monthlySalary);
  const effectiveFrom = body.rateEffectiveFrom || startDate;
  if (!name || name.length > 100) return NextResponse.json({ error: 'Enter an employee name (up to 100 characters).' }, { status: 400 });
  if (!validDate(startDate) || !validDate(effectiveFrom)) return NextResponse.json({ error: 'Enter a valid start date and salary effective date.' }, { status: 400 });
  if (!Number.isSafeInteger(salary) || salary < 1 || salary > 1_000_000_000) return NextResponse.json({ error: 'Enter a positive whole-PKR monthly salary.' }, { status: 400 });

  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    const createEmployee = db.transaction(async () => {
      const result = await db.prepare(`INSERT INTO employees (workspace_id, name, job_title, employee_ref, start_date)
        VALUES (?, ?, ?, ?, ?)`)
        .run(workspaceId, name, body.jobTitle?.trim().slice(0, 80) || '', body.employeeRef?.trim().slice(0, 40) || '', startDate);
      const employeeId = Number(result.lastInsertRowid);
      await db.prepare('INSERT INTO salary_rates (employee_id, amount, currency, effective_from) VALUES (?, ?, ?, ?)')
        .run(employeeId, salary, 'PKR', effectiveFrom);
      await db.prepare('INSERT INTO audit_events (workspace_id, action, details) VALUES (?, ?, ?)')
        .run(workspaceId, 'EMPLOYEE_CREATED', JSON.stringify({ employeeId, name, salary, effectiveFrom }));
      return employeeId;
    });
    await createEmployee();
    return NextResponse.json(await getTeamData(access.member.workspaceId), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'An employee with that name already exists.' }, { status: 409 });
    }
    console.error('Failed to create employee', error);
    return NextResponse.json({ error: 'Could not save this employee.' }, { status: 500 });
  }
}
