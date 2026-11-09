import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceMember } from '@/lib/authorization';
import { getUnreadCount, markNotificationRead } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const { userId, workspaceId } = access.member;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Choose a valid notification.' }, { status: 400 });
  const ok = await markNotificationRead({ notificationId: id, workspaceId, userId });
  if (!ok) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  const unreadCount = await getUnreadCount({ workspaceId, userId });
  return NextResponse.json({ ok: true, unreadCount });
}
