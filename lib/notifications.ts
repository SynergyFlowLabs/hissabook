/**
 * Server-side notification center logic.
 *
 * Broadcast model: one `notifications` row per business event; per-user read
 * state in `notification_reads`. Unread = workspace rows − my reads.
 * `createWorkspaceNotification` never throws — a failed notifier must not
 * break the business mutation that triggered it.
 */
import { db } from '@/lib/database';
import { formatPKR } from '@/lib/format';
import { sendWorkspacePush } from '@/lib/push';

export type NotificationKind =
  | 'transaction' | 'loan' | 'inventory' | 'salary' | 'member' | 'invitation' | 'reminder';

export type NotificationItem = {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
  actorName: string | null;
};

type CreateInput = {
  workspaceId: number;
  actorUserId?: number | null;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  dedupeKey?: string | null;
};

export async function createWorkspaceNotification({
  workspaceId, actorUserId = null, kind, title, body = '', href = '/', dedupeKey = null,
}: CreateInput): Promise<number | null> {
  try {
    if (dedupeKey) {
      const existing = await db.prepare('SELECT id FROM notifications WHERE dedupe_key = ?').get(dedupeKey) as { id: number } | undefined;
      if (existing) return null; // idempotent re-run (e.g. daily cron)
    }
    const result = await db.prepare(
      'INSERT INTO notifications (workspace_id, actor_user_id, kind, title, body, href, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(workspaceId, actorUserId, kind, title.slice(0, 140), body.slice(0, 280), href.slice(0, 200), dedupeKey);
    const id = Number(result.lastInsertRowid) || null;
    if (id) {
      try {
        await sendWorkspacePush(workspaceId, { title, body, href, kind, tag: dedupeKey ?? `${kind}:${id}` });
      } catch (pushError) {
        console.error('push fan-out failed', pushError);
      }
    }
    return id;
  } catch (error) {
    // Unique-dedupe race: another run won — swallow quietly.
    if (dedupeKey) { console.warn('createWorkspaceNotification: dedupe swallowed', dedupeKey); return null; }
    console.error('createWorkspaceNotification failed', error);
    return null;
  }
}

export function money(amount: number): string {
  return formatPKR(amount);
}

type Row = {
  id: number; kind: NotificationKind; title: string; body: string; href: string;
  created_at: string; read: number | boolean | null; actor_name: string | null;
};

function toItem(row: Row): NotificationItem {
  return {
    id: Number(row.id),
    kind: row.kind,
    title: row.title,
    body: row.body ?? '',
    href: row.href || '/',
    createdAt: row.created_at,
    read: Boolean(Number(row.read)),
    actorName: row.actor_name ?? null,
  };
}

export async function listNotifications({
  workspaceId, userId, cursor = null, limit = 20,
}: {
  workspaceId: number; userId: number; cursor?: number | null; limit?: number;
}): Promise<{ items: NotificationItem[]; unreadCount: number; nextCursor: number | null }> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 50);
  const cursorClause = cursor ? 'AND n.id < ?' : '';
  const params: Array<number> = cursor ? [userId, workspaceId, cursor, capped + 1] : [userId, workspaceId, capped + 1];
  const rows = await db.prepare(`
    SELECT n.id, n.kind, n.title, n.body, n.href, n.created_at,
           (r.user_id IS NOT NULL) AS read, u.display_name AS actor_name
    FROM notifications n
    LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
    LEFT JOIN users u ON u.id = n.actor_user_id
    WHERE n.workspace_id = ? ${cursorClause}
    ORDER BY n.id DESC
    LIMIT ?`).all(...params) as unknown as Row[];

  const hasMore = rows.length > capped;
  const page = hasMore ? rows.slice(0, capped) : rows;
  const unreadCount = await getUnreadCount({ workspaceId, userId });
  return {
    items: page.map(toItem),
    unreadCount,
    nextCursor: hasMore && page.length ? page[page.length - 1].id : null,
  };
}

export async function getUnreadCount({ workspaceId, userId }: { workspaceId: number; userId: number }): Promise<number> {
  const row = await db.prepare(`
    SELECT COUNT(*) AS n
    FROM notifications n
    LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
    WHERE n.workspace_id = ? AND r.user_id IS NULL`).get(userId, workspaceId) as { n: number | string } | undefined;
  return Number(row?.n ?? 0);
}

export async function markNotificationRead({
  notificationId, workspaceId, userId,
}: {
  notificationId: number; workspaceId: number; userId: number;
}): Promise<boolean> {
  try {
    const owned = await db.prepare('SELECT id FROM notifications WHERE id = ? AND workspace_id = ?').get(notificationId, workspaceId);
    if (!owned) return false;
    const existing = await db.prepare('SELECT notification_id FROM notification_reads WHERE notification_id = ? AND user_id = ?').get(notificationId, userId);
    if (!existing) {
      await db.prepare('INSERT INTO notification_reads (notification_id, user_id) VALUES (?, ?)').run(notificationId, userId);
    }
    return true;
  } catch (error) {
    console.error('markNotificationRead failed', error);
    return false;
  }
}

export async function markAllNotificationsRead({ workspaceId, userId }: { workspaceId: number; userId: number }): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO notification_reads (notification_id, user_id)
      SELECT n.id, ?
      FROM notifications n
      LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
      WHERE n.workspace_id = ? AND r.user_id IS NULL`).run(userId, userId, workspaceId);
  } catch (error) {
    console.error('markAllNotificationsRead failed', error);
  }
}
