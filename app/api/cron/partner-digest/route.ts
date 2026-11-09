import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { createWorkspaceNotification, money } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Monthly partner digest. Vercel Hobby runs crons at most once per day and only
 * on production; schedule in vercel.json on the 1st. Locally:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/partner-digest
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const now = new Date();
  const monthStart = `${now.toISOString().slice(0, 7)}-01`;
  const monthLabel = now.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
  const dedupeSuffix = now.toISOString().slice(0, 7);

  const workspaces = await db.prepare(`SELECT DISTINCT workspace_id AS id FROM partner_entries`).all() as unknown as Array<{ id: number }>;
  let created = 0;

  for (const { id: workspaceId } of workspaces) {
    const lines = await db.prepare(`SELECT o.name AS name,
        COALESCE(SUM(CASE WHEN pe.entry_type = 'EXPENSE_PAID' THEN pe.amount ELSE 0 END), 0) AS fronts,
        COALESCE(SUM(CASE WHEN pe.entry_type = 'ADVANCE_REIMBURSED' THEN pe.amount ELSE 0 END), 0) AS reimbursed,
        COALESCE(SUM(CASE WHEN pe.entry_type = 'CASH_WITHDRAWAL' THEN pe.amount ELSE 0 END), 0) AS drawings
      FROM owners o JOIN partner_entries pe ON pe.owner_id = o.id AND pe.workspace_id = o.workspace_id
      WHERE o.workspace_id = ? AND substr(pe.transaction_date, 1, 10) >= ? AND o.status = 'active'
      GROUP BY o.id, o.name ORDER BY o.id`).all(workspaceId, monthStart) as unknown as Array<{ name: string; fronts: number; reimbursed: number; drawings: number }>;
    if (lines.length === 0) continue;
    const body = lines.slice(0, 6).map((line) => `${line.name}: fronted ${money(Number(line.fronts))} · reimbursed ${money(Number(line.reimbursed))} · drawn ${money(Number(line.drawings))}`).join(' | ').slice(0, 280);
    const id = await createWorkspaceNotification({
      workspaceId, kind: 'reminder',
      title: `Partner digest · ${monthLabel}`,
      body,
      href: '/partners',
      dedupeKey: `partner-digest:${workspaceId}:${dedupeSuffix}`,
    });
    if (id) created += 1;
  }

  return NextResponse.json({ ok: true, created });
}
