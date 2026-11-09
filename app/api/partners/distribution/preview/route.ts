import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { DistributionError, computeDistributionWorkings } from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

export async function GET(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;
  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
  const params = request.nextUrl.searchParams;

  // Default period: since the day after the latest POSTED distribution, else this month.
  const latest = await db.prepare(`SELECT MAX(period_to) AS periodTo FROM profit_distributions WHERE workspace_id = ? AND status = 'POSTED'`).get(workspaceId) as { periodTo: string | null } | undefined;
  const sinceDefault = latest?.periodTo
    ? new Date(Date.parse(`${String(latest.periodTo).slice(0, 10)}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10)
    : monthStart();
  const from = params.get('from') ?? sinceDefault;
  const to = params.get('to') ?? today();
  if (!isValidDate(from) || !isValidDate(to)) return NextResponse.json({ error: 'Enter valid start and end dates.' }, { status: 400 });
  if (from > to) return NextResponse.json({ error: 'The start date must be on or before the end date.' }, { status: 400 });

  // salaries=4:20000,5:15000 — optional per-partner deed salaries for this period.
  const salaries = (params.get('salaries') ?? '').split(',').map((chunk) => chunk.trim()).filter(Boolean).slice(0, 50).map((chunk) => {
    const [ownerId, amount] = chunk.split(':');
    return { ownerId: Number(ownerId), amount: Number(amount) };
  }).filter((item) => Number.isSafeInteger(item.ownerId) && Number.isFinite(item.amount));

  try {
    const workings = await computeDistributionWorkings(workspaceId, from, to, salaries);
    const overlap = await db.prepare(`SELECT id FROM profit_distributions WHERE workspace_id = ? AND status = 'POSTED' AND NOT (period_to < ? OR period_from > ?) LIMIT 1`)
      .get(workspaceId, from, to) as { id: number } | undefined;
    return NextResponse.json({ workings, overlapDistributionId: overlap?.id ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof DistributionError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Distribution preview failed', error);
    return NextResponse.json({ error: 'Could not build the preview. Please try again.' }, { status: 500 });
  }
}
