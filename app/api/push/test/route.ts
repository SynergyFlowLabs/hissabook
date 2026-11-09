import { NextResponse } from 'next/server';
import { requireWorkspaceMember } from '@/lib/authorization';
import { sendUserPush } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sends a confirmation push to the calling user's own devices. */
export async function POST() {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const { userId, workspaceId } = access.member;
  const sent = await sendUserPush(workspaceId, userId, {
    title: 'Hisaabook: alerts are on',
    body: 'Ledger activity, payroll and reminders will land on this device.',
    href: '/',
    kind: 'reminder',
    tag: 'hissabook:welcome',
  });
  return NextResponse.json({ ok: true, sent });
}
