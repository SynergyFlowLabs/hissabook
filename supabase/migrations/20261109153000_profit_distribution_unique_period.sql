-- 1) One POSTED appropriation per workspace period.
--
-- The application already refuses an overlapping POSTED distribution, but that
-- check is read-then-write: two concurrent requests (a double tap, a retried
-- request, or two demo-seed lambdas) can both pass it. The partial unique index
-- makes the rule hold at the storage layer. VOID rows are excluded, so voiding
-- and re-posting the same period stays possible.
CREATE UNIQUE INDEX IF NOT EXISTS profit_distributions_active_period_idx
  ON public.profit_distributions(workspace_id, period_from, period_to)
  WHERE status = 'POSTED';

-- 2) Demo seed claims.
--
-- Demo seeding is a one-time job per workspace, but it runs from a page render,
-- so in production two lambdas could run it at once. Production ended up with
-- every demo partner entry twice and October's distribution POSTED twice because
-- the guard was a read-then-write count. A unique primary key is the only guard
-- that holds across connections: the loser of the race fails on insert and stops.
CREATE TABLE IF NOT EXISTS public.seed_claims (
  workspace_id INTEGER NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  claimed_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  PRIMARY KEY (workspace_id, kind)
);

ALTER TABLE public.seed_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seed_claims FROM anon, authenticated;
