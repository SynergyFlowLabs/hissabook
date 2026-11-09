import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace, getWorkspaceMember } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';
import { createWorkspaceNotification } from '@/lib/notifications';
import { getDeedSettings, getPartnerOverview } from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
const today = () => new Date().toISOString().slice(0, 10);

export async function GET() {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const workspaceId = access.member.workspaceId;

  try {
    const workspace = await db.prepare('SELECT id, name, business_type AS businessType, currency FROM workspaces WHERE id = ?').get(workspaceId);
    const accounts = await db.prepare('SELECT id, name, account_type AS type, currency FROM accounts WHERE workspace_id = ? AND is_system = 0 ORDER BY name').all(workspaceId);
    const partners = await getPartnerOverview(workspaceId);
    const members = await db.prepare(`SELECT u.id AS userId, u.display_name AS name
      FROM workspace_members m JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = ? AND m.active = 1 ORDER BY u.display_name`).all(workspaceId);
    const settings = await getDeedSettings(workspaceId);
    return NextResponse.json({
      workspace,
      accounts,
      partners,
      members,
      settings,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Failed to load partner overview', error);
    return NextResponse.json({ error: 'Could not load partners. Please try again.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN]);
  if (access.response) return access.response;
  let body: { name?: string; role?: string; share?: number; effectiveAt?: string; userId?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > 80) return NextResponse.json({ error: 'Give the partner a name of 1–80 characters.' }, { status: 400 });
  const role = (body.role?.trim() || 'Partner').slice(0, 40);
  const share = Number(body.share);
  if (!Number.isFinite(share) || share < 0 || share > 100) return NextResponse.json({ error: 'Share must be between 0 and 100.' }, { status: 400 });
  const effectiveAt = body.effectiveAt && isValidDate(body.effectiveAt) ? body.effectiveAt : today();
  const userId = body.userId === null || body.userId === undefined ? null : Number(body.userId);
  if (userId !== null) {
    if (!Number.isSafeInteger(userId)) return NextResponse.json({ error: 'Choose a valid workspace member.' }, { status: 400 });
    const member = await getWorkspaceMember(userId);
    if (!member || member.workspaceId !== access.member.workspaceId) return NextResponse.json({ error: 'That member does not belong to this business.' }, { status: 400 });
  }
  const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);

  try {
    const create = db.transaction(async () => {
      const result = await db.prepare('INSERT INTO owners (workspace_id, name, role, share, effective_at, user_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(workspaceId, name, role, share, `${effectiveAt}T00:00:00.000Z`, userId);
      const ownerId = Number(result.lastInsertRowid);
      await db.prepare("INSERT INTO owner_share_changes (workspace_id, owner_id, share, effective_at, note, created_by) VALUES (?, ?, ?, ?, 'Baseline share', ?)")
        .run(workspaceId, ownerId, share, effectiveAt, access.member.name);
      await db.prepare('INSERT INTO audit_events (workspace_id, transaction_id, action, details, actor) VALUES (?, NULL, ?, ?, ?)')
        .run(workspaceId, 'PARTNER_CREATED', JSON.stringify({ ownerId, name, role, share, effectiveAt, userId }), access.member.name);
      return ownerId;
    });
    const ownerId = await create();
    await createWorkspaceNotification({ workspaceId, actorUserId: access.member.userId, kind: 'member', title: 'Partner added',
      body: `${name} · ${share}% share from ${effectiveAt}`, href: '/partners' });
    return NextResponse.json({ ok: true, ownerId }, { status: 201 });
  } catch (error) {
    console.error('Failed to add partner', error);
    return NextResponse.json({ error: 'Could not add this partner. Please try again.' }, { status: 500 });
  }
}
