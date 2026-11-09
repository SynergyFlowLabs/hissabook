/**
 * Web-push fan-out (server-only). VAPID keys come from env; when missing,
 * push is a silent no-op so dev/preview without keys keeps working.
 */
import * as webpush from 'web-push';
import { db } from '@/lib/database';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? 'https://hissabook-eta.vercel.app';
const enabled = Boolean(publicKey && privateKey);

if (enabled) {
  webpush.setVapidDetails(subject, publicKey as string, privateKey as string);
} else {
  console.warn('web-push disabled: VAPID keys are not configured');
}

export type PushPayload = {
  title: string;
  body: string;
  href?: string;
  kind?: string;
  tag?: string;
};

type SubscriptionRow = { id: number; endpoint: string; p256dh: string; auth: string };

async function sendPushToRows(rows: SubscriptionRow[], payload: PushPayload): Promise<number> {
  if (!enabled) return 0;
  let sent = 0;
  await Promise.all(rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(payload),
        { TTL: 86_400, urgency: 'normal', topic: (payload.tag ?? 'hissabook').slice(0, 32) },
      );
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        // Dead endpoint — prune it.
        await db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id);
      } else {
        console.error('push send failed', { status, message: (error as Error)?.message });
      }
    }
  }));
  return sent;
}

export async function sendWorkspacePush(workspaceId: number, payload: PushPayload): Promise<number> {
  try {
    const rows = await db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE workspace_id = ?').all(workspaceId) as unknown as SubscriptionRow[];
    return await sendPushToRows(rows, payload);
  } catch (error) {
    console.error('sendWorkspacePush failed', error);
    return 0;
  }
}

export async function sendUserPush(workspaceId: number, userId: number, payload: PushPayload): Promise<number> {
  try {
    const rows = await db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE workspace_id = ? AND user_id = ?').all(workspaceId, userId) as unknown as SubscriptionRow[];
    return await sendPushToRows(rows, payload);
  } catch (error) {
    console.error('sendUserPush failed', error);
    return 0;
  }
}
