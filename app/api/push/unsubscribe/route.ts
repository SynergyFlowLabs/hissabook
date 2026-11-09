import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireWorkspaceMember } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const { userId } = access.member;
  let body: { endpoint?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint || endpoint.length > 1000) return NextResponse.json({ error: 'Invalid endpoint.' }, { status: 400 });
  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, userId);
  return NextResponse.json({ ok: true });
}
