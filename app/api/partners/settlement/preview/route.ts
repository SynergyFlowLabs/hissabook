import { NextRequest, NextResponse } from 'next/server';
import { ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { DistributionError, computeSettlementWorkings, type SettlementRevaluation } from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const today = () => new Date().toISOString().slice(0, 10);

function parseRevaluations(raw: string | null): SettlementRevaluation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 24).map((item) => {
      const line = item as { description?: unknown; delta?: unknown };
      return { description: String(line.description ?? ''), delta: Math.trunc(Number(line.delta) || 0) };
    });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;
  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
  const params = request.nextUrl.searchParams;

  const partnerId = Number(params.get('partnerId'));
  if (!Number.isSafeInteger(partnerId)) return NextResponse.json({ error: 'Choose a valid partner.' }, { status: 400 });
  const asOf = (params.get('asOf') ?? today()).slice(0, 10);
  if (!isValidDate(asOf)) return NextResponse.json({ error: 'Enter a valid as-of date.' }, { status: 400 });

  try {
    const workings = await computeSettlementWorkings(workspaceId, {
      partnerId,
      asOf,
      goodwillValue: Math.trunc(Number(params.get('goodwillValue') ?? '0') || 0),
      goodwillMethod: params.get('goodwillMethod') === 'CASH_ADJUSTMENT' ? 'CASH_ADJUSTMENT' : 'RAISE_WRITEOFF',
      mode: params.get('mode') === 'LOAN' ? 'LOAN' : 'PAY',
      revaluations: parseRevaluations(params.get('revaluations')),
    });
    return NextResponse.json({ workings }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof DistributionError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Settlement preview failed', error);
    return NextResponse.json({ error: 'Could not build the settlement preview. Please try again.' }, { status: 500 });
  }
}
