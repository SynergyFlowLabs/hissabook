import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireWorkspaceMember } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE64URL = /^[A-Za-z0-9\-_]+$/;

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const { userId, workspaceId } = access.member;
  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth : '';
  if (!endpoint.startsWith('https://') || endpoint.length > 1000) return NextResponse.json({ error: 'Invalid push endpoint.' }, { status: 400 });
  if (!BASE64URL.test(p256dh) || !BASE64URL.test(auth) || p256dh.length > 400 || auth.length > 200 || p256dh.length < 10 || auth.length < 10) {
    return NextResponse.json({ error: 'Invalid push subscription keys.' }, { status: 400 });
  }
  const userAgent = request.headers.get('user-agent')?.slice(0, 200) ?? '';
  const existing = await db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(endpoint) as { id: number } | undefined;
  if (existing) {
    await db.prepare('UPDATE push_subscriptions SET workspace_id = ?, user_id = ?, p256dh = ?, auth = ?, user_agent = ?, last_seen_at = CURRENT_TIMESTAMP WHERE endpoint = ?')
      .run(workspaceId, userId, p256dh, auth, userAgent, endpoint);
  } else {
    await db.prepare('INSERT INTO push_subscriptions (workspace_id, user_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?, ?)')
      .run(workspaceId, userId, endpoint, p256dh, auth, userAgent);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
