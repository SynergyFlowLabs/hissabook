import { NextRequest, NextResponse } from 'next/server';
import { ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createWorkspaceNotification, money } from '@/lib/notifications';
import { csvAttachment, csvNum } from '@/lib/csv';
import { DistributionError, listDistributions, postDistribution } from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    const distributions = await listDistributions(workspaceId);
    if (request.nextUrl.searchParams.get('format') === 'csv') {
      const headers = ['ID', 'Period from', 'Period to', 'Basis profit (PKR)', 'Salary total (PKR)', 'Interest on capital (PKR)', 'Interest on drawings (PKR)', 'Residual distributed (PKR)', 'Status', 'Note', 'Posted by', 'Posted on'];
      const rows = distributions.map((row) => [String(row.id), row.periodFrom, row.periodTo,
        csvNum(row.basisProfit), csvNum(row.salaryTotal), csvNum(row.interestCapitalTotal), csvNum(row.interestDrawingsTotal),
        csvNum(row.residual), row.status, row.note, row.createdBy, row.createdAt]);
      const meta = [
        'Hisaabook distribution history',
        `Exported ${new Date().toISOString()}`,
      ];
      const file = csvAttachment(meta, headers, rows);
      return new NextResponse(file, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="partner-distributions.csv"',
          'Cache-Control': 'private, no-store',
        },
      });
    }
    return NextResponse.json({ distributions }, { headers: { 'Cache-Control': 'private, no-store' } });
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
