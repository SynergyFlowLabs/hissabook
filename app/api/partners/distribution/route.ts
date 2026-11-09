import { NextRequest, NextResponse } from 'next/server';
import { ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createWorkspaceNotification, money } from '@/lib/notifications';
import { DistributionError, listDistributions, postDistribution } from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    return NextResponse.json({ distributions: await listDistributions(workspaceId) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Failed to load distributions', error);
    return NextResponse.json({ error: 'Could not load the distribution history.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;
  let body: { from?: string; to?: string; salaries?: Array<{ ownerId?: number; amount?: number }>; note?: string; confirmShareMismatch?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const from = (body.from ?? '').slice(0, 10);
  const to = (body.to ?? '').slice(0, 10);
  const salaries = Array.isArray(body.salaries) ? body.salaries.slice(0, 50).map((item) => ({ ownerId: Number(item.ownerId), amount: Math.trunc(Number(item.amount)) })) : [];
  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);

  try {
    const posted = await postDistribution(workspaceId, { from, to, salaries, note: body.note ?? '', confirmShareMismatch: body.confirmShareMismatch === true },
      { name: access.member.name, userId: access.member.userId });
    const monthLabel = new Date(`${to.slice(0, 7)}-02T00:00:00.000Z`).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
    await createWorkspaceNotification({ workspaceId, actorUserId: access.member.userId, kind: 'transaction',
      title: `Profit for ${monthLabel} distributed`,
      body: `${money(posted.workings.residual)} appropriated across ${posted.workings.lines.length} partner(s). Open Partners for your statement.`,
      href: '/partners' });
    return NextResponse.json({ ok: true, distributionId: posted.id, residual: posted.workings.residual }, { status: 201 });
  } catch (error) {
    if (error instanceof DistributionError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Failed to post distribution', error);
    return NextResponse.json({ error: 'Could not post the distribution. Please try again.' }, { status: 500 });
  }
}
