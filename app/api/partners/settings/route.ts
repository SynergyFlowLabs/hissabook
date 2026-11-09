import { NextRequest, NextResponse } from 'next/server';
import { ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { DistributionError, getDeedSettings, updateDeedSettings } from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    return NextResponse.json({ settings: await getDeedSettings(workspaceId) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Failed to load deed settings', error);
    return NextResponse.json({ error: 'Could not load the deed settings.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    const settings = await updateDeedSettings(workspaceId, {
      partnerSalaryEnabled: typeof body.partnerSalaryEnabled === 'boolean' ? body.partnerSalaryEnabled : undefined,
      interestOnCapitalEnabled: typeof body.interestOnCapitalEnabled === 'boolean' ? body.interestOnCapitalEnabled : undefined,
      interestOnCapitalPct: (body.interestOnCapitalPct ?? undefined) as number | null | undefined,
      interestOnDrawingsEnabled: typeof body.interestOnDrawingsEnabled === 'boolean' ? body.interestOnDrawingsEnabled : undefined,
      interestOnDrawingsPct: (body.interestOnDrawingsPct ?? undefined) as number | null | undefined,
      drawingCapPct: (body.drawingCapPct ?? undefined) as number | undefined,
      settlementMethod: body.settlementMethod === 'LOAN' || body.settlementMethod === 'PAY' ? body.settlementMethod : undefined,
    }, access.member.name);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (error instanceof DistributionError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Failed to update deed settings', error);
    return NextResponse.json({ error: 'Could not save the deed settings.' }, { status: 500 });
  }
}
