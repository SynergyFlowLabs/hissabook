
    CREATE TABLE IF NOT EXISTS workspaces (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      business_type TEXT NOT NULL DEFAULT 'Business',
      currency TEXT NOT NULL DEFAULT 'PKR',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL  UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'BOOKKEEPER', 'VIEWER', 'PAYROLL')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      UNIQUE(workspace_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS workspace_invitations (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      email TEXT NOT NULL ,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'BOOKKEEPER', 'VIEWER', 'PAYROLL')),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      accepted_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'CASH',
      currency TEXT NOT NULL DEFAULT 'PKR',
      opening_balance INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      UNIQUE(workspace_id, name)
    );

    CREATE TABLE IF NOT EXISTS owners (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Owner',
      share REAL NOT NULL CHECK (share >= 0 AND share <= 100),
      effective_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );

    CREATE TABLE IF NOT EXISTS loans (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      direction TEXT NOT NULL CHECK (direction IN ('PAYABLE', 'RECEIVABLE')),
      name TEXT NOT NULL,
      counterparty TEXT NOT NULL DEFAULT '',
      principal INTEGER NOT NULL CHECK (principal > 0),
      outstanding INTEGER NOT NULL CHECK (outstanding >= 0),
      due_at TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      destination_account_id INTEGER REFERENCES accounts(id),
      loan_id INTEGER REFERENCES loans(id),
      type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'CONTRIBUTION', 'WITHDRAWAL', 'LOAN_RECEIVED', 'LOAN_GIVEN', 'TRANSFER')),
      amount INTEGER NOT NULL CHECK (amount > 0),
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      counterparty TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'CLEARED' CHECK (status IN ('CLEARED', 'PENDING', 'VOID')),
      transaction_date TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'Areeba Khan',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      CHECK (type != 'TRANSFER' OR destination_account_id IS NOT NULL),
      CHECK (destination_account_id IS NULL OR destination_account_id != account_id)
    );

    CREATE TABLE IF NOT EXISTS loan_repayments (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      loan_id INTEGER NOT NULL REFERENCES loans(id),
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      principal_amount INTEGER NOT NULL CHECK (principal_amount > 0),
      fee_amount INTEGER NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
      fee_description TEXT NOT NULL DEFAULT '',
      transaction_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT 'Areeba Khan',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      actor TEXT NOT NULL DEFAULT 'Areeba Khan',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'General',
      unit TEXT NOT NULL DEFAULT 'pcs',
      reorder_level REAL NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      UNIQUE(workspace_id, name)
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES inventory_items(id),
      transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK (type IN ('RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT')),
      quantity_delta REAL NOT NULL CHECK (quantity_delta != 0),
      unit_cost INTEGER CHECK (unit_cost IS NULL OR unit_cost >= 0),
      counterparty TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      movement_date TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'Areeba Khan',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      job_title TEXT NOT NULL DEFAULT '',
      employee_ref TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      UNIQUE(workspace_id, name)
    );

    CREATE TABLE IF NOT EXISTS salary_rates (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'PKR',
      effective_from TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      UNIQUE(employee_id, effective_from)
    );

    CREATE TABLE IF NOT EXISTS salary_periods (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      salary_rate_id INTEGER REFERENCES salary_rates(id),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      due_date TEXT NOT NULL,
      amount_due INTEGER NOT NULL CHECK (amount_due > 0),
      currency TEXT NOT NULL DEFAULT 'PKR',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
      UNIQUE(employee_id, period_start, period_end),
      CHECK (period_end >= period_start)
    );

    CREATE TABLE IF NOT EXISTS salary_payments (
      id SERIAL PRIMARY KEY,
      salary_period_id INTEGER NOT NULL REFERENCES salary_periods(id) ON DELETE CASCADE,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      amount INTEGER NOT NULL CHECK (amount > 0),
      paid_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
    );

    CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id, active);
    CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_idx ON workspace_invitations(workspace_id, accepted_at, revoked_at, expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_pending_email_idx ON workspace_invitations(workspace_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
    CREATE INDEX IF NOT EXISTS transactions_workspace_date_idx ON transactions(workspace_id, transaction_date DESC);
    CREATE INDEX IF NOT EXISTS transactions_account_idx ON transactions(account_id, destination_account_id);
    CREATE INDEX IF NOT EXISTS loans_workspace_idx ON loans(workspace_id, outstanding);
    CREATE INDEX IF NOT EXISTS loan_repayments_loan_date_idx ON loan_repayments(loan_id, transaction_date DESC);
    CREATE INDEX IF NOT EXISTS inventory_movements_item_date_idx ON inventory_movements(item_id, movement_date DESC);
    CREATE INDEX IF NOT EXISTS employees_workspace_idx ON employees(workspace_id, active, name);
    CREATE INDEX IF NOT EXISTS salary_periods_employee_date_idx ON salary_periods(employee_id, period_start DESC);

-- App traffic uses the private Postgres connection; the public Supabase REST roles get no table or sequence access.
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
