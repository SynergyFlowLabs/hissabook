import { NextRequest, NextResponse } from 'next/server';
import { ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createWorkspaceNotification, money } from '@/lib/notifications';
import { DistributionError, postSettlement, type SettlementRevaluation } from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseRevaluations(raw: unknown): SettlementRevaluation[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 24).map((item) => {
    const line = item as { description?: unknown; delta?: unknown };
    return { description: String(line.description ?? ''), delta: Math.trunc(Number(line.delta) || 0) };
  });
}

/** Executes the exit settlement built up in the preview. OWNER/ADMIN only. */
export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;
  let body: {
    partnerId?: number; asOf?: string; goodwillValue?: number; goodwillMethod?: string; mode?: string;
    revaluations?: Array<{ description?: string; delta?: number }>; confirmShareMismatch?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const partnerId = Number(body.partnerId);
  if (!Number.isSafeInteger(partnerId)) return NextResponse.json({ error: 'Choose a valid partner.' }, { status: 400 });
  const asOf = (body.asOf ?? '').slice(0, 10);
  if (!isValidDate(asOf)) return NextResponse.json({ error: 'Enter a valid as-of date.' }, { status: 400 });
  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);

  try {
    const posted = await postSettlement(workspaceId, {
      partnerId,
      asOf,
      goodwillValue: Math.trunc(Number(body.goodwillValue) || 0),
      goodwillMethod: body.goodwillMethod === 'CASH_ADJUSTMENT' ? 'CASH_ADJUSTMENT' : 'RAISE_WRITEOFF',
      mode: body.mode === 'LOAN' ? 'LOAN' : 'PAY',
      revaluations: parseRevaluations(body.revaluations),
      confirmShareMismatch: body.confirmShareMismatch === true,
    }, { name: access.member.name, userId: access.member.userId });

    const { workings } = posted;
    const amount = workings.firmPays > 0 ? `${money(workings.firmPays)} payable to ${workings.partner.name}` : `${money(workings.partnerOwes)} receivable from ${workings.partner.name}`;
    await createWorkspaceNotification({ workspaceId, actorUserId: access.member.userId, kind: 'transaction',
      title: `Exit settlement posted - ${workings.partner.name}`,
      body: `${amount}. The partner ledger now shows them as exited. Open Partners for details.`,
      href: '/partners' });
    return NextResponse.json({ ok: true, firmPays: workings.firmPays, partnerOwes: workings.partnerOwes, loanCreated: posted.loanCreated, distributionId: workings.exitDistribution?.distributionId ?? null }, { status: 201 });
  } catch (error) {
    if (error instanceof DistributionError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Failed to post settlement', error);
    return NextResponse.json({ error: 'Could not post the settlement. Please try again.' }, { status: 500 });
  }
}
