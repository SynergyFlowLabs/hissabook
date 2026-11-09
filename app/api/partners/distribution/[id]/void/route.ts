import { NextRequest, NextResponse } from 'next/server';
import { ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createWorkspaceNotification } from '@/lib/notifications';
import { DistributionError, voidDistribution } from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;
  const { id } = await params;
  const distributionId = Number(id);
  if (!Number.isSafeInteger(distributionId)) return NextResponse.json({ error: 'Choose a valid distribution.' }, { status: 400 });
  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
  try {
    const result = await voidDistribution(workspaceId, distributionId, body.reason ?? '', { name: access.member.name, userId: access.member.userId });
    await createWorkspaceNotification({ workspaceId, actorUserId: access.member.userId, kind: 'transaction',
      title: `Distribution #${result.id} voided`, body: 'The posted entries were reversed with correction rows.', href: '/partners' });
    return NextResponse.json({ ok: true, entriesMirrored: result.entriesMirrored });
  } catch (error) {
    if (error instanceof DistributionError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Failed to void distribution', error);
    return NextResponse.json({ error: 'Could not void the distribution. Please try again.' }, { status: 500 });
  }
}
