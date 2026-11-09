import { NextRequest, NextResponse } from 'next/server';
import { ensureDemoWorkspace } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createWorkspaceNotification } from '@/lib/notifications';
import { attributeLegacyEntry, getUnattributedLegacyEntries, LegacyAttributionError } from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Unattributed (pre-partners) activity rows. Owners and admins only. */
export async function GET() {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;
  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
  try {
    const entries = await getUnattributedLegacyEntries(workspaceId);
    return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Failed to load unattributed legacy entries', error);
    return NextResponse.json({ error: 'Could not load the unattributed rows. Please try again.' }, { status: 500 });
  }
}

/**
 * Attributes one legacy row to a partner (OWNER/ADMIN). Never auto-guesses by
 * name: one explicit tag per row, then the row is immutable.
 */
export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;
  let body: { transactionId?: number; ownerId?: number };
  try {
    body = await request.json() as { transactionId?: number; ownerId?: number };
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const transactionId = Number(body?.transactionId);
  const ownerId = Number(body?.ownerId);
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
    return NextResponse.json({ error: 'Choose a valid activity row.' }, { status: 400 });
  }
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
    return NextResponse.json({ error: 'Choose the partner this row belongs to.' }, { status: 400 });
  }

  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
  try {
    const result = await attributeLegacyEntry(workspaceId, transactionId, ownerId, { name: access.member.name, userId: access.member.userId });
    await createWorkspaceNotification({ workspaceId, actorUserId: access.member.userId, kind: 'transaction',
      title: 'Legacy row attributed', body: `${result.entryType === 'CAPITAL_CONTRIBUTION' ? 'Capital contribution' : 'Counter drawing'} of ₨ ${result.amount.toLocaleString('en-PK')} tagged to ${result.partnerName}`,
      href: '/partners' });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof LegacyAttributionError) {
      // A row that is already tagged stays as recorded: that is a conflict, not a bad request.
      const alreadyTagged = /already|attributed by someone else/.test(error.message);
      return NextResponse.json({ error: error.message }, { status: alreadyTagged ? 409 : 400 });
    }
    console.error('Failed to attribute legacy entry', error);
    return NextResponse.json({ error: 'Could not attribute this row. Please try again.' }, { status: 500 });
  }
}
