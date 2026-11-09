-- Partner ledger — additive schema for partner sub-ledger, effective-dated
-- share history, appropriation records, deed settings and movement attribution.
-- Mirrors the inline SQLite DDL in lib/database.ts. No existing data is altered.

ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exited'));
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS exited_at TEXT;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES public.owners(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS funding_kind TEXT CHECK (funding_kind IN ('ACCOUNT', 'PARTNER_ADVANCE', 'PARTNER_CAPITAL'));

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_system INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.owner_share_changes (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  share REAL NOT NULL CHECK (share >= 0 AND share <= 100),
  effective_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);
CREATE INDEX IF NOT EXISTS owner_share_changes_ws_owner_idx ON public.owner_share_changes(workspace_id, owner_id, effective_at);

CREATE TABLE IF NOT EXISTS public.profit_distributions (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  basis_profit INTEGER NOT NULL,
  salary_total INTEGER NOT NULL DEFAULT 0,
  interest_capital_total INTEGER NOT NULL DEFAULT 0,
  interest_drawings_total INTEGER NOT NULL DEFAULT 0,
  residual_distributed INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOID')),
  workings_json TEXT NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CHECK (period_to >= period_from)
);
CREATE INDEX IF NOT EXISTS profit_distributions_ws_period_idx ON public.profit_distributions(workspace_id, period_to DESC);

CREATE TABLE IF NOT EXISTS public.partner_entries (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'CAPITAL_CONTRIBUTION','CAPITAL_RETURN',
    'EXPENSE_PAID','ADVANCE_REIMBURSED',
    'CASH_WITHDRAWAL',
    'INTEREST_ON_CAPITAL','INTEREST_ON_DRAWINGS','PARTNER_SALARY','PARTNER_COMMISSION',
    'PROFIT_SHARE','LOSS_SHARE',
    'SETTLEMENT','CORRECTION'
  )),
  direction TEXT NOT NULL CHECK (direction IN ('CREDIT','DEBIT')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  transaction_id INTEGER REFERENCES public.transactions(id) ON DELETE SET NULL,
  distribution_id INTEGER REFERENCES public.profit_distributions(id) ON DELETE SET NULL,
  split_share REAL,
  note TEXT NOT NULL DEFAULT '',
  transaction_date TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);
CREATE INDEX IF NOT EXISTS partner_entries_ws_owner_idx ON public.partner_entries(workspace_id, owner_id, transaction_date);
CREATE INDEX IF NOT EXISTS partner_entries_ws_distribution_idx ON public.partner_entries(workspace_id, distribution_id);

CREATE TABLE IF NOT EXISTS public.workspace_partner_settings (
  workspace_id INTEGER PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  partner_salary_enabled INTEGER NOT NULL DEFAULT 0,
  interest_on_capital_enabled INTEGER NOT NULL DEFAULT 0,
  interest_on_capital_pct REAL,
  interest_on_drawings_enabled INTEGER NOT NULL DEFAULT 0,
  interest_on_drawings_pct REAL,
  drawing_cap_pct REAL NOT NULL DEFAULT 70,
  settlement_method TEXT NOT NULL DEFAULT 'PAY' CHECK (settlement_method IN ('PAY','LOAN')),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

-- Baseline PSR history rows for every existing owner (idempotent).
INSERT INTO public.owner_share_changes (workspace_id, owner_id, share, effective_at, note, created_by)
SELECT o.workspace_id, o.id, o.share, substr(o.effective_at, 1, 10), 'Baseline share at migration', 'migration'
FROM public.owners o
WHERE NOT EXISTS (
  SELECT 1 FROM public.owner_share_changes osc WHERE osc.owner_id = o.id
);

ALTER TABLE public.owner_share_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_partner_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_share_changes FROM anon, authenticated;
REVOKE ALL ON public.profit_distributions FROM anon, authenticated;
REVOKE ALL ON public.partner_entries FROM anon, authenticated;
REVOKE ALL ON public.workspace_partner_settings FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.owner_share_changes_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.profit_distributions_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.partner_entries_id_seq FROM anon, authenticated;
