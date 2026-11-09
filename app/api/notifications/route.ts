import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceMember } from '@/lib/authorization';
import { listNotifications } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const { userId, workspaceId } = access.member;
  const { searchParams } = new URL(request.url);
  const cursorParam = searchParams.get('cursor');
  const limitParam = Number(searchParams.get('limit') ?? '20');
  const cursor = cursorParam && /^\d+$/.test(cursorParam) ? Number(cursorParam) : null;
  const { items, unreadCount, nextCursor } = await listNotifications({
    workspaceId, userId, cursor, limit: Number.isFinite(limitParam) ? limitParam : 20,
  });
  return NextResponse.json({ items, unreadCount, nextCursor });
}
