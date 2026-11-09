import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { createWorkspaceNotification, money } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily smart-reminders batch. Vercel Hobby runs crons at most once per day and
 * only on production deployments; locally, invoke with the shared secret:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const now = new Date();
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const today = day(now);
  const plus3 = day(new Date(now.getTime() + 3 * 86_400_000));
  const plus24hIso = new Date(now.getTime() + 86_400_000).toISOString();
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - 180 * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

  const workspaces = await db.prepare('SELECT id FROM workspaces').all() as unknown as Array<{ id: number }>;
  let created = 0;

  for (const { id: workspaceId } of workspaces) {
    // 1) Loans due (or overdue): payable → payment due; receivable → collection due
    const loans = await db.prepare(`
      SELECT id, direction, name, counterparty, outstanding, due_at
      FROM loans
      WHERE workspace_id = ? AND outstanding > 0 AND due_at IS NOT NULL AND due_at <= ?`).all(workspaceId, plus3) as unknown as Array<{
        id: number; direction: string; name: string; counterparty: string; outstanding: number; due_at: string;
      }>;
    for (const loan of loans) {
      const overdue = loan.due_at < today;
      const verb = loan.direction === 'PAYABLE' ? 'Loan payment' : 'Loan collection';
      const id = await createWorkspaceNotification({
        workspaceId, kind: 'reminder',
        title: overdue ? `${verb} overdue` : `${verb} due soon`,
        body: `${money(loan.outstanding)} · ${loan.counterparty || loan.name} · due ${loan.due_at}`,
        href: '/#loans',
        dedupeKey: `loan:${loan.id}:${today}`,
      });
      if (id) created += 1;
    }

    // 2) Salary periods due within 3 days and not yet fully paid
    const periods = await db.prepare(`
      SELECT p.id, p.amount_due, p.due_date, e.name AS employee_name
      FROM salary_periods p
      JOIN employees e ON e.id = p.employee_id
      WHERE p.workspace_id = ? AND p.due_date <= ?
        AND NOT EXISTS (SELECT 1 FROM salary_payments sp WHERE sp.salary_period_id = p.id)`).all(workspaceId, plus3) as unknown as Array<{
        id: number; amount_due: number; due_date: string; employee_name: string;
      }>;
    for (const period of periods) {
      const overdue = period.due_date < today;
      const id = await createWorkspaceNotification({
        workspaceId, kind: 'reminder',
        title: overdue ? 'Salary overdue' : 'Salary due soon',
        body: `${period.employee_name} · ${money(period.amount_due)} · due ${period.due_date}`,
        href: '/team',
        dedupeKey: `salary:${period.id}:${today}`,
      });
      if (id) created += 1;
    }

    // 3) Low stock vs per-item reorder level
    const lowStock = await db.prepare(`
      SELECT i.id, i.name, i.unit, i.reorder_level, COALESCE(SUM(m.quantity_delta), 0) AS stock
      FROM inventory_items i
      LEFT JOIN inventory_movements m ON m.item_id = i.id
      WHERE i.workspace_id = ? AND i.active = 1 AND i.reorder_level > 0
      GROUP BY i.id, i.name, i.unit, i.reorder_level
      HAVING COALESCE(SUM(m.quantity_delta), 0) < i.reorder_level`).all(workspaceId) as unknown as Array<{
        id: number; name: string; unit: string; reorder_level: number; stock: number;
      }>;
    for (const item of lowStock) {
      const id = await createWorkspaceNotification({
        workspaceId, kind: 'reminder',
        title: `Low stock: ${item.name}`,
        body: `${item.stock} ${item.unit} left · reorder at ${item.reorder_level}`,
        href: '/inventory',
        dedupeKey: `stock:${item.id}:${today}`,
      });
      if (id) created += 1;
    }

    // 4) Pending invitations expiring within 24h
    const invites = await db.prepare(`
      SELECT id, email, role, expires_at
      FROM workspace_invitations
      WHERE workspace_id = ? AND accepted_at IS NULL AND revoked_at IS NULL
        AND expires_at <= ? AND expires_at >= ?`).all(workspaceId, plus24hIso, nowIso) as unknown as Array<{
        id: number; email: string; role: string; expires_at: string;
      }>;
    for (const invite of invites) {
      const id = await createWorkspaceNotification({
        workspaceId, kind: 'invitation',
        title: 'Invitation expiring',
        body: `${invite.email} · ${invite.role} · link expires within 24h`,
        href: '/',
        dedupeKey: `invite:${invite.id}:${today}`,
      });
      if (id) created += 1;
    }

    // Retention: keep 180 days of notifications
    await db.prepare('DELETE FROM notifications WHERE created_at < ?').run(cutoff);
  }

  return NextResponse.json({ ranAt: nowIso, workspaces: workspaces.length, created });
}
