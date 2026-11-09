-- Notifications: in-app notification center + web push subscriptions (PR 2/3).
-- Broadcast model: one notifications row per business event; per-user read state
-- in notification_reads. dedupe_key guards cron idempotency. Additive only.

CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('transaction', 'loan', 'inventory', 'salary', 'member', 'invitation', 'reminder')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '/',
  dedupe_key TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id INTEGER NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  last_seen_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE INDEX IF NOT EXISTS notifications_workspace_idx ON public.notifications(workspace_id, id DESC);
CREATE INDEX IF NOT EXISTS notifications_kind_idx ON public.notifications(workspace_id, kind, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx ON public.notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_reads_user_idx ON public.notification_reads(user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_workspace_idx ON public.push_subscriptions(workspace_id, user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
REVOKE ALL ON public.notification_reads FROM anon, authenticated;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.notifications_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.push_subscriptions_id_seq FROM anon, authenticated;
