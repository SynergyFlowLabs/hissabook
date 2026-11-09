import { NextResponse } from 'next/server';
import { requireWorkspaceMember } from '@/lib/authorization';
import { markAllNotificationsRead } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const { userId, workspaceId } = access.member;
  await markAllNotificationsRead({ workspaceId, userId });
  return NextResponse.json({ ok: true, unreadCount: 0 });
}
