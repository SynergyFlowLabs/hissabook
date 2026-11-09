import Database from 'better-sqlite3';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import postgres, { type Sql, type TransactionSql } from 'postgres';
import { hashPassword } from '@/lib/passwords';
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_NAME, DEMO_WORKSPACE_NAME, DEMO_WORKSPACE_SLUG } from '@/lib/demo-account';

const databaseUrl = process.env.DATABASE_URL;
const databasePath = process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'hisaabook.sqlite');
if (process.env.VERCEL_ENV === 'production' && !databaseUrl) {
  throw new Error('DATABASE_URL is required for production deployments.');
}
const schemaSql = `
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      business_type TEXT NOT NULL DEFAULT 'Business',
      currency TEXT NOT NULL DEFAULT 'PKR',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      kind TEXT NOT NULL CHECK (kind IN ('transaction', 'loan', 'inventory', 'salary', 'member', 'invitation', 'reminder')),
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      href TEXT NOT NULL DEFAULT '/',
      dedupe_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (notification_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'BOOKKEEPER', 'VIEWER', 'PAYROLL')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS workspace_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      email TEXT NOT NULL COLLATE NOCASE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'BOOKKEEPER', 'VIEWER', 'PAYROLL')),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      accepted_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'CASH',
      currency TEXT NOT NULL DEFAULT 'PKR',
      opening_balance INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, name)
    );

    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Owner',
      share REAL NOT NULL CHECK (share >= 0 AND share <= 100),
      effective_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      direction TEXT NOT NULL CHECK (direction IN ('PAYABLE', 'RECEIVABLE')),
      name TEXT NOT NULL,
      counterparty TEXT NOT NULL DEFAULT '',
      principal INTEGER NOT NULL CHECK (principal > 0),
      outstanding INTEGER NOT NULL CHECK (outstanding >= 0),
      due_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (type != 'TRANSFER' OR destination_account_id IS NOT NULL),
      CHECK (destination_account_id IS NULL OR destination_account_id != account_id)
    );

    CREATE TABLE IF NOT EXISTS loan_repayments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      loan_id INTEGER NOT NULL REFERENCES loans(id),
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      principal_amount INTEGER NOT NULL CHECK (principal_amount > 0),
      fee_amount INTEGER NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
      fee_description TEXT NOT NULL DEFAULT '',
      transaction_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT 'Areeba Khan',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      actor TEXT NOT NULL DEFAULT 'Areeba Khan',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'General',
      unit TEXT NOT NULL DEFAULT 'pcs',
      reorder_level REAL NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, name)
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      job_title TEXT NOT NULL DEFAULT '',
      employee_ref TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, name)
    );

    CREATE TABLE IF NOT EXISTS salary_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'PKR',
      effective_from TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, effective_from)
    );

    CREATE TABLE IF NOT EXISTS salary_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      salary_rate_id INTEGER REFERENCES salary_rates(id),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      due_date TEXT NOT NULL,
      amount_due INTEGER NOT NULL CHECK (amount_due > 0),
      currency TEXT NOT NULL DEFAULT 'PKR',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, period_start, period_end),
      CHECK (period_end >= period_start)
    );

    CREATE TABLE IF NOT EXISTS salary_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salary_period_id INTEGER NOT NULL REFERENCES salary_periods(id) ON DELETE CASCADE,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      amount INTEGER NOT NULL CHECK (amount > 0),
      paid_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id, active);
    CREATE INDEX IF NOT EXISTS notifications_workspace_idx ON notifications(workspace_id, id DESC);
    CREATE INDEX IF NOT EXISTS notifications_kind_idx ON notifications(workspace_id, kind, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS notification_reads_user_idx ON notification_reads(user_id);
    CREATE INDEX IF NOT EXISTS push_subscriptions_workspace_idx ON push_subscriptions(workspace_id, user_id);
    CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_idx ON workspace_invitations(workspace_id, accepted_at, revoked_at, expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_pending_email_idx ON workspace_invitations(workspace_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
    CREATE INDEX IF NOT EXISTS transactions_workspace_date_idx ON transactions(workspace_id, transaction_date DESC);
    CREATE INDEX IF NOT EXISTS transactions_account_idx ON transactions(account_id, destination_account_id);
    CREATE INDEX IF NOT EXISTS loans_workspace_idx ON loans(workspace_id, outstanding);
    CREATE INDEX IF NOT EXISTS loan_repayments_loan_date_idx ON loan_repayments(loan_id, transaction_date DESC);
    CREATE INDEX IF NOT EXISTS inventory_movements_item_date_idx ON inventory_movements(item_id, movement_date DESC);
    CREATE INDEX IF NOT EXISTS employees_workspace_idx ON employees(workspace_id, active, name);
    CREATE INDEX IF NOT EXISTS salary_periods_employee_date_idx ON salary_periods(employee_id, period_start DESC);`;

type GlobalWithDatabase = typeof globalThis & {
  hisaabookSqlite?: Database.Database;
  hisaabookPostgres?: Sql;
};
const globalForDatabase = globalThis as GlobalWithDatabase;
const postgresClient = databaseUrl
  ? globalForDatabase.hisaabookPostgres ?? postgres(databaseUrl, {
      max: 1,
      prepare: false,
      max_pipeline: 1,
      connect_timeout: 10,
      idle_timeout: 20,
      ssl: 'require',
      types: {
        bigint: {
          to: 20,
          from: [20],
          serialize: (value: number | bigint) => String(value),
          parse: Number,
        },
      },
    })
  : null;
if (postgresClient && process.env.NODE_ENV !== 'production') globalForDatabase.hisaabookPostgres = postgresClient;

const postgresTransactionContext = new AsyncLocalStorage<TransactionSql>();
const sqliteTransactionContext = new AsyncLocalStorage<boolean>();
let sqliteQueue: Promise<void> = Promise.resolve();

function createSqliteDatabase() {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = globalForDatabase.hisaabookSqlite ?? new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schemaSql);
  if (process.env.NODE_ENV !== 'production') globalForDatabase.hisaabookSqlite = db;
  return db;
}

const sqliteDatabase = postgresClient ? null : createSqliteDatabase();

function acquireSqliteLock() {
  let release!: () => void;
  const previous = sqliteQueue;
  sqliteQueue = new Promise<void>((resolve) => { release = resolve; });
  return previous.then(() => release);
}

async function withSqliteLock<T>(operation: () => T | Promise<T>): Promise<T> {
  const release = await acquireSqliteLock();
  try { return await operation(); } finally { release(); }
}

function toPostgresSql(statement: string, returningId = false) {
  let text = statement
    .replace(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/g, (match, name: string) => /[A-Z]/.test(name) ? `AS "${name}"` : match)
    .replace(/\s+COLLATE\s+NOCASE/gi, '')
    .replace(/\bCURRENT_TIMESTAMP\b/g, 'CURRENT_TIMESTAMP::text');
  if (returningId && /^\s*INSERT\b/i.test(text) && !/\bRETURNING\b/i.test(text)) {
    text = text.trim().replace(/;$/, '') + ' RETURNING id';
  }
  let parameter = 0;
  return text.replace(/\?/g, () => `$${++parameter}`);
}

// PostgreSQL schema is applied from supabase/migrations; runtime requests do not execute DDL.
const postgresReady: Promise<void> = Promise.resolve();

async function executePostgres(statement: string, parameters: unknown[] = [], returningId = false) {
  await postgresReady;
  const client = postgresTransactionContext.getStore() ?? postgresClient;
  if (!client) throw new Error('DATABASE_NOT_CONFIGURED');
  const text = toPostgresSql(statement, returningId);
  return client.unsafe(text, parameters as never[]);
}

function executeSqlite<T>(operation: () => T): Promise<T> {
  if (sqliteTransactionContext.getStore()) return Promise.resolve(operation());
  return withSqliteLock(operation);
}

type RunResult = { changes: number; lastInsertRowid: number | bigint };
type PreparedQuery = {
  get: (...parameters: unknown[]) => Promise<unknown>;
  all: (...parameters: unknown[]) => Promise<unknown[]>;
  run: (...parameters: unknown[]) => Promise<RunResult>;
};

export const db = {
  prepare(statement: string): PreparedQuery {
    return {
      get: async (...parameters) => postgresClient
        ? (await executePostgres(statement, parameters))[0]
        : executeSqlite(() => sqliteDatabase!.prepare(statement).get(...parameters)),
      all: async (...parameters) => postgresClient
        ? [...await executePostgres(statement, parameters)]
        : executeSqlite(() => sqliteDatabase!.prepare(statement).all(...parameters)),
      run: async (...parameters) => {
        if (!postgresClient) return executeSqlite(() => sqliteDatabase!.prepare(statement).run(...parameters));
        const result = await executePostgres(statement, parameters, true);
        return { changes: result.count ?? result.length, lastInsertRowid: result[0]?.id ?? 0 };
      },
    };
  },
  async exec(statement: string) {
    if (!postgresClient) return executeSqlite(() => sqliteDatabase!.exec(statement));
    const statements = statement.split(';').map((part) => part.trim()).filter(Boolean);
    for (const part of statements) await executePostgres(part);
  },
  transaction<T>(callback: () => T | Promise<T>) {
    return async () => {
      if (postgresClient) {
        await postgresReady;
        return postgresClient.begin((transaction) => postgresTransactionContext.run(transaction, callback));
      }
      return withSqliteLock(async () => {
        sqliteDatabase!.exec('BEGIN IMMEDIATE');
        try {
          const value = await sqliteTransactionContext.run(true, callback);
          sqliteDatabase!.exec('COMMIT');
          return value;
        } catch (error) {
          sqliteDatabase!.exec('ROLLBACK');
          throw error;
        }
      });
    };
  },
};

function dayOffset(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

export async function ensureDemoWorkspace(workspaceId?: number) {
  if (workspaceId !== undefined) return Number(workspaceId);
  if (postgresClient) {
    await db.prepare(`INSERT INTO workspaces (slug, name, business_type, currency)
      VALUES (?, ?, ?, ?) ON CONFLICT (slug) DO NOTHING`).run('hisaabook', 'My Business', 'Business', 'PKR');
    const workspace = await db.prepare('SELECT id FROM workspaces WHERE slug = ?').get('hisaabook') as { id: number } | undefined;
    if (!workspace) throw new Error('WORKSPACE_INITIALIZATION_FAILED');
    await db.prepare(`INSERT INTO accounts (workspace_id, name, account_type, currency, opening_balance)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT (workspace_id, name) DO NOTHING`).run(workspace.id, 'Cash in hand', 'CASH', 'PKR', 0);
    return Number(workspace.id);
  }

  const exists = await db.prepare('SELECT id FROM workspaces WHERE slug = ?').get('safa-studio') as { id: number } | undefined;
  if (exists) return exists.id;

  const seed = db.transaction(async () => {
    const workspaceResult = await db.prepare('INSERT INTO workspaces (slug, name, business_type, currency) VALUES (?, ?, ?, ?)').run('safa-studio', 'Safa Studio', 'Creative agency', 'PKR');
    const workspaceId = Number(workspaceResult.lastInsertRowid);
    const bank = Number((await db.prepare('INSERT INTO accounts (workspace_id, name, account_type, currency, opening_balance) VALUES (?, ?, ?, ?, ?)').run(workspaceId, 'Business bank', 'BANK', 'PKR', 383250)).lastInsertRowid);
    const cash = Number((await db.prepare('INSERT INTO accounts (workspace_id, name, account_type, currency, opening_balance) VALUES (?, ?, ?, ?, ?)').run(workspaceId, 'Cash in hand', 'CASH', 'PKR', 0)).lastInsertRowid);

    const owner = db.prepare('INSERT INTO owners (workspace_id, name, role, share, effective_at) VALUES (?, ?, ?, ?, ?)');
    await owner.run(workspaceId, 'Areeba Khan', 'Business owner', 45, dayOffset(90));
    await owner.run(workspaceId, 'Hamza Malik', 'Partner', 35, dayOffset(90));
    await owner.run(workspaceId, 'Sara Ahmed', 'Partner', 20, dayOffset(90));

    const loan = db.prepare('INSERT INTO loans (workspace_id, direction, name, counterparty, principal, outstanding, due_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    await loan.run(workspaceId, 'PAYABLE', 'Short-term business loan', 'Fariha', 50000, 50000, dayOffset(-37).slice(0, 10));
    await loan.run(workspaceId, 'RECEIVABLE', 'Advance to vendor', 'Print House', 25000, 25000, dayOffset(-11).slice(0, 10));

    const insertTransaction = db.prepare(`INSERT INTO transactions
      (workspace_id, account_id, type, amount, description, category, transaction_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    await insertTransaction.run(workspaceId, bank, 'INCOME', 85000, 'Website project', 'Client payment', dayOffset(0), 'CLEARED');
    await insertTransaction.run(workspaceId, bank, 'EXPENSE', 32000, 'Studio rent', 'Rent & utilities', dayOffset(0), 'CLEARED');
    await insertTransaction.run(workspaceId, cash, 'CONTRIBUTION', 50000, 'Hamza · Capital', 'Owner contribution', dayOffset(1), 'CLEARED');
    await insertTransaction.run(workspaceId, bank, 'EXPENSE', 12500, 'Software subscriptions', 'Tools & software', dayOffset(2), 'PENDING');
    return workspaceId;
  });

  return await seed();
}

export async function ensurePublicDemoAccount() {
  const provision = db.transaction(async () => {
    await db.prepare(`INSERT INTO workspaces (slug, name, business_type, currency)
      VALUES (?, ?, ?, ?) ON CONFLICT (slug) DO NOTHING`)
      .run(DEMO_WORKSPACE_SLUG, DEMO_WORKSPACE_NAME, 'Creative agency', 'PKR');
    const workspace = await db.prepare('SELECT id FROM workspaces WHERE slug = ?').get(DEMO_WORKSPACE_SLUG) as { id: number } | undefined;
    if (!workspace) throw new Error('DEMO_WORKSPACE_INITIALIZATION_FAILED');
    const workspaceId = Number(workspace.id);

    await db.prepare(`INSERT INTO accounts (workspace_id, name, account_type, currency, opening_balance)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT (workspace_id, name) DO NOTHING`)
      .run(workspaceId, 'Business bank', 'BANK', 'PKR', 383250);
    await db.prepare(`INSERT INTO accounts (workspace_id, name, account_type, currency, opening_balance)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT (workspace_id, name) DO NOTHING`)
      .run(workspaceId, 'Cash in hand', 'CASH', 'PKR', 0);
    const bank = await db.prepare('SELECT id FROM accounts WHERE workspace_id = ? AND name = ?').get(workspaceId, 'Business bank') as { id: number } | undefined;
    const cash = await db.prepare('SELECT id FROM accounts WHERE workspace_id = ? AND name = ?').get(workspaceId, 'Cash in hand') as { id: number } | undefined;
    if (!bank || !cash) throw new Error('DEMO_ACCOUNT_INITIALIZATION_FAILED');

    const existingDemoUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL);
    if (!existingDemoUser) {
      await db.prepare(`INSERT INTO users (email, display_name, password_hash)
        VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING`).run(DEMO_EMAIL, DEMO_USER_NAME, hashPassword(DEMO_PASSWORD));
    }
    const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL) as { id: number } | undefined;
    if (!user) throw new Error('DEMO_USER_INITIALIZATION_FAILED');
    await db.prepare(`INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (?, ?, 'OWNER') ON CONFLICT (workspace_id, user_id) DO NOTHING`).run(workspaceId, Number(user.id));

    const ownerCount = (await db.prepare('SELECT COUNT(*) AS count FROM owners WHERE workspace_id = ?').get(workspaceId) as { count: number }).count;
    if (ownerCount === 0) {
      const owner = db.prepare('INSERT INTO owners (workspace_id, name, role, share, effective_at) VALUES (?, ?, ?, ?, ?)');
      await owner.run(workspaceId, 'Areeba Khan', 'Business owner', 45, dayOffset(90));
      await owner.run(workspaceId, 'Hamza Malik', 'Partner', 35, dayOffset(90));
      await owner.run(workspaceId, 'Sara Ahmed', 'Partner', 20, dayOffset(90));
    }

    const loanCount = (await db.prepare('SELECT COUNT(*) AS count FROM loans WHERE workspace_id = ?').get(workspaceId) as { count: number }).count;
    if (loanCount === 0) {
      const loan = db.prepare(`INSERT INTO loans (workspace_id, direction, name, counterparty, principal, outstanding, due_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`);
      await loan.run(workspaceId, 'PAYABLE', 'Short-term business loan', 'Fariha', 50000, 50000, dayOffset(-37).slice(0, 10));
      await loan.run(workspaceId, 'RECEIVABLE', 'Advance to vendor', 'Print House', 25000, 25000, dayOffset(-11).slice(0, 10));
    }

    const transactionCount = (await db.prepare('SELECT COUNT(*) AS count FROM transactions WHERE workspace_id = ?').get(workspaceId) as { count: number }).count;
    if (transactionCount === 0) {
      const transaction = db.prepare(`INSERT INTO transactions
        (workspace_id, account_id, type, amount, description, category, transaction_date, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      await transaction.run(workspaceId, Number(bank.id), 'INCOME', 85000, 'Website project', 'Client payment', dayOffset(0), 'CLEARED', 'Areeba Khan');
      await transaction.run(workspaceId, Number(bank.id), 'EXPENSE', 32000, 'Studio rent', 'Rent & utilities', dayOffset(0), 'CLEARED', 'Areeba Khan');
      await transaction.run(workspaceId, Number(cash.id), 'CONTRIBUTION', 50000, 'Hamza · Capital', 'Owner contribution', dayOffset(1), 'CLEARED', 'Hamza Malik');
      await transaction.run(workspaceId, Number(bank.id), 'EXPENSE', 12500, 'Software subscriptions', 'Tools & software', dayOffset(2), 'PENDING', 'Areeba Khan');
      await db.prepare(`INSERT INTO audit_events (workspace_id, action, details, actor)
        VALUES (?, ?, ?, ?)`).run(workspaceId, 'DEMO_WORKSPACE_SEEDED', 'Public demo sample data initialized', DEMO_USER_NAME);
    }
    return workspaceId;
  });
  const workspaceId = await provision();
  await ensureDemoModuleData(workspaceId);
  return workspaceId;
}

export async function isSetupComplete() {
  const workspaceId = await ensureDemoWorkspace();
  return (await db.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = ? AND role = 'OWNER' AND active = 1").get(workspaceId) as { count: number }).count > 0;
}

export async function createInitialOwner(name: string, email: string, passwordHash: string) {
  const workspaceId = await ensureDemoWorkspace();
  const createOwner = db.transaction(async () => {
    const count = (await db.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = ? AND role = 'OWNER' AND active = 1").get(workspaceId) as { count: number }).count;
    if (count > 0) throw new Error('SETUP_ALREADY_COMPLETE');
    const userId = Number((await db.prepare('INSERT INTO users (email, display_name, password_hash) VALUES (?, ?, ?)').run(email, name, passwordHash)).lastInsertRowid);
    await db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(workspaceId, userId, 'OWNER');
    await db.prepare('INSERT INTO audit_events (workspace_id, action, details, actor) VALUES (?, ?, ?, ?)')
      .run(workspaceId, 'OWNER_ACCOUNT_CREATED', JSON.stringify({ userId, email }), name);
    return userId;
  });
  return await createOwner();
}

export async function getWorkspaceMember(userId: number) {
  return await db.prepare(`SELECT wm.id, wm.workspace_id AS workspaceId, wm.user_id AS userId, wm.role, u.email, u.display_name AS name
    FROM workspace_members wm JOIN users u ON u.id = wm.user_id
    WHERE wm.user_id = ? AND wm.active = 1 AND u.active = 1 ORDER BY wm.created_at ASC LIMIT 1`).get(userId) as
    { id: number; workspaceId: number; userId: number; role: string; email: string; name: string } | undefined;
}

export async function getWorkspaceAccessData(workspaceId?: number) {
  workspaceId = await ensureDemoWorkspace(workspaceId);
  const members = await db.prepare(`SELECT wm.id, wm.user_id AS userId, u.display_name AS name, u.email, wm.role, wm.active, wm.created_at AS joinedAt
    FROM workspace_members wm JOIN users u ON u.id = wm.user_id WHERE wm.workspace_id = ? ORDER BY wm.role = 'OWNER' DESC, u.display_name COLLATE NOCASE`).all(workspaceId);
  const invitations = await db.prepare(`SELECT id, email, display_name AS name, role, expires_at AS expiresAt, created_at AS createdAt
    FROM workspace_invitations WHERE workspace_id = ? AND accepted_at IS NULL AND revoked_at IS NULL ORDER BY created_at DESC`).all(workspaceId);
  return { members, invitations };
}

export async function createWorkspaceInvitation(input: { workspaceId: number; email: string; name: string; role: string; tokenHash: string; expiresAt: string; createdBy: number; actor: string }) {
  const workspaceId = await ensureDemoWorkspace(input.workspaceId);
  return db.transaction(async () => {
    const existingMember = await db.prepare(`SELECT wm.id FROM workspace_members wm JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ? AND u.email = ?`).get(workspaceId, input.email);
    if (existingMember) throw new Error('ALREADY_A_MEMBER');
    const existingInvitation = await db.prepare(`SELECT id, expires_at AS expiresAt FROM workspace_invitations
      WHERE workspace_id = ? AND email = ? AND accepted_at IS NULL AND revoked_at IS NULL ORDER BY id DESC LIMIT 1`).get(workspaceId, input.email) as { id: number; expiresAt: string } | undefined;
    if (existingInvitation && new Date(existingInvitation.expiresAt).getTime() > Date.now()) throw new Error('INVITATION_ALREADY_PENDING');
    if (existingInvitation) await db.prepare('UPDATE workspace_invitations SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?').run(existingInvitation.id);
    const result = await db.prepare(`INSERT INTO workspace_invitations (workspace_id, email, display_name, role, token_hash, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(workspaceId, input.email, input.name, input.role, input.tokenHash, input.expiresAt, input.createdBy);
    await db.prepare('INSERT INTO audit_events (workspace_id, action, details, actor) VALUES (?, ?, ?, ?)')
      .run(workspaceId, 'MEMBER_INVITED', JSON.stringify({ email: input.email, role: input.role }), input.actor);
    return Number(result.lastInsertRowid);
  })();
}

export async function getInvitationByHash(tokenHash: string) {
  return await db.prepare(`SELECT i.id, i.workspace_id AS workspaceId, i.email, i.display_name AS name, i.role,
      i.expires_at AS expiresAt, i.accepted_at AS acceptedAt, i.revoked_at AS revokedAt, w.name AS workspaceName
    FROM workspace_invitations i JOIN workspaces w ON w.id = i.workspace_id WHERE i.token_hash = ? LIMIT 1`).get(tokenHash) as
    { id: number; workspaceId: number; email: string; name: string; role: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; workspaceName: string } | undefined;
}

export async function getCredentialRecord(email: string) {
  if (email.trim().toLowerCase() === DEMO_EMAIL) await ensurePublicDemoAccount();
  return await db.prepare('SELECT id, email, display_name AS name, password_hash AS passwordHash FROM users WHERE email = ? AND active = 1')
    .get(email) as { id: number; email: string; name: string; passwordHash: string } | undefined;
}

export function acceptWorkspaceInvitation(tokenHash: string, passwordHash: string) {
  return db.transaction(async () => {
    const invite = await getInvitationByHash(tokenHash);
    if (!invite || invite.acceptedAt || invite.revokedAt || new Date(invite.expiresAt).getTime() <= Date.now()) throw new Error('INVITATION_INVALID');
    const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(invite.email) as { id: number } | undefined;
    let userId: number;
    if (user) {
      userId = user.id;
      const existing = await db.prepare('SELECT id, active FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(invite.workspaceId, userId) as { id: number; active: number } | undefined;
      if (existing?.active) throw new Error('ALREADY_A_MEMBER');
      if (existing) await db.prepare('UPDATE workspace_members SET role = ?, active = 1 WHERE id = ?').run(invite.role, existing.id);
      else await db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(invite.workspaceId, userId, invite.role);
    } else {
      userId = Number((await db.prepare('INSERT INTO users (email, display_name, password_hash) VALUES (?, ?, ?)').run(invite.email, invite.name, passwordHash)).lastInsertRowid);
      await db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(invite.workspaceId, userId, invite.role);
    }
    const accepted = await db.prepare(`UPDATE workspace_invitations SET accepted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND accepted_at IS NULL AND revoked_at IS NULL`).run(invite.id);
    if (accepted.changes !== 1) throw new Error('INVITATION_INVALID');
    await db.prepare('INSERT INTO audit_events (workspace_id, action, details, actor) VALUES (?, ?, ?, ?)')
      .run(invite.workspaceId, 'MEMBER_JOINED', JSON.stringify({ userId, email: invite.email, role: invite.role }), invite.name);
    return { userId, email: invite.email };
  })();
}

export async function updateWorkspaceMember(memberId: number, input: { role?: string; active?: boolean }, actor: string, selectedWorkspaceId?: number) {
  const workspaceId = await ensureDemoWorkspace(selectedWorkspaceId);
  return db.transaction(async () => {
    const member = await db.prepare('SELECT id, role, active FROM workspace_members WHERE id = ? AND workspace_id = ?').get(memberId, workspaceId) as { id: number; role: string; active: number } | undefined;
    if (!member) throw new Error('MEMBER_NOT_FOUND');
    if (member.role === 'OWNER') throw new Error('OWNER_ACCESS_PROTECTED');
    const role = input.role ?? member.role;
    const active = input.active === undefined ? member.active : Number(input.active);
    await db.prepare('UPDATE workspace_members SET role = ?, active = ? WHERE id = ?').run(role, active, memberId);
    await db.prepare('INSERT INTO audit_events (workspace_id, action, details, actor) VALUES (?, ?, ?, ?)')
      .run(workspaceId, active ? 'MEMBER_ACCESS_UPDATED' : 'MEMBER_ACCESS_REVOKED', JSON.stringify({ memberId, role, active }), actor);
    return await getWorkspaceAccessData(workspaceId);
  })();
}

export async function revokeWorkspaceInvitation(invitationId: number, actor: string, selectedWorkspaceId?: number) {
  const workspaceId = await ensureDemoWorkspace(selectedWorkspaceId);
  const result = await db.prepare(`UPDATE workspace_invitations SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND accepted_at IS NULL AND revoked_at IS NULL`).run(invitationId, workspaceId);
  if (result.changes) await db.prepare('INSERT INTO audit_events (workspace_id, action, details, actor) VALUES (?, ?, ?, ?)')
    .run(workspaceId, 'INVITATION_REVOKED', JSON.stringify({ invitationId }), actor);
  return result.changes > 0;
}

export async function ensureDemoModuleData(workspaceId?: number) {
  workspaceId = workspaceId ?? await ensureDemoWorkspace();
  if (postgresClient) {
    const workspace = await db.prepare('SELECT slug FROM workspaces WHERE id = ?').get(workspaceId) as { slug: string } | undefined;
    if (workspace?.slug !== DEMO_WORKSPACE_SLUG) return;
  }
  const seedModules = db.transaction(async () => {
    const itemCount = (await db.prepare('SELECT COUNT(*) AS count FROM inventory_items WHERE workspace_id = ?').get(workspaceId) as { count: number }).count;
    if (itemCount === 0) {
      const item = db.prepare('INSERT INTO inventory_items (workspace_id, name, sku, category, unit, reorder_level) VALUES (?, ?, ?, ?, ?, ?)');
      const sketchbooks = Number((await item.run(workspaceId, 'Branded sketchbooks', 'SK-001', 'Studio merchandise', 'pcs', 40)).lastInsertRowid);
      const paper = Number((await item.run(workspaceId, 'A3 photo paper', 'PP-A3', 'Print supplies', 'sheets', 50)).lastInsertRowid);
      const toteBags = Number((await item.run(workspaceId, 'Canvas tote bags', 'TB-014', 'Studio merchandise', 'pcs', 20)).lastInsertRowid);
      const movement = db.prepare(`INSERT INTO inventory_movements (workspace_id, item_id, type, quantity_delta, movement_date, note)
        VALUES (?, ?, ?, ?, ?, ?)`);
      await movement.run(workspaceId, sketchbooks, 'RECEIPT', 180, dayOffset(20), 'Opening demo stock');
      await movement.run(workspaceId, sketchbooks, 'ISSUE', -35, dayOffset(3), 'Client welcome packs');
      await movement.run(workspaceId, paper, 'RECEIPT', 50, dayOffset(25), 'Opening demo stock');
      await movement.run(workspaceId, paper, 'ISSUE', -18, dayOffset(1), 'Print production');
      await movement.run(workspaceId, toteBags, 'RECEIPT', 80, dayOffset(18), 'Opening demo stock');
      await movement.run(workspaceId, toteBags, 'ISSUE', -8, dayOffset(4), 'Event merchandise');
    }

    const employeeCount = (await db.prepare('SELECT COUNT(*) AS count FROM employees WHERE workspace_id = ?').get(workspaceId) as { count: number }).count;
    if (employeeCount === 0) {
      const today = new Date();
      const periodStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
      const periodEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      const dueDate = `${periodStart.slice(0, 7)}-10`;
      const employee = db.prepare('INSERT INTO employees (workspace_id, name, job_title, employee_ref, start_date) VALUES (?, ?, ?, ?, ?)');
      const designer = Number((await employee.run(workspaceId, 'Noor Ahmed', 'Graphic designer', 'EMP-014', dayOffset(210).slice(0, 10))).lastInsertRowid);
      const assistant = Number((await employee.run(workspaceId, 'Bilal Raza', 'Studio assistant', 'EMP-021', dayOffset(150).slice(0, 10))).lastInsertRowid);
      const rate = db.prepare('INSERT INTO salary_rates (employee_id, amount, currency, effective_from) VALUES (?, ?, ?, ?)');
      const designerRate = Number((await rate.run(designer, 85000, 'PKR', periodStart)).lastInsertRowid);
      const assistantRate = Number((await rate.run(assistant, 55000, 'PKR', periodStart)).lastInsertRowid);
      const salaryPeriod = db.prepare(`INSERT INTO salary_periods
        (workspace_id, employee_id, salary_rate_id, period_start, period_end, due_date, amount_due, currency, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PKR', 'Demo salary period')`);
      await salaryPeriod.run(workspaceId, designer, designerRate, periodStart, periodEnd, dueDate, 85000);
      await salaryPeriod.run(workspaceId, assistant, assistantRate, periodStart, periodEnd, dueDate, 55000);
    }
  });
  await seedModules();
}

export async function getInventoryData(selectedWorkspaceId?: number) {
  const workspaceId = await ensureDemoWorkspace(selectedWorkspaceId);
  await ensureDemoModuleData(workspaceId);
  const workspace = await db.prepare('SELECT id, name, currency FROM workspaces WHERE id = ?').get(workspaceId);
  const accounts = await db.prepare('SELECT id, name, currency FROM accounts WHERE workspace_id = ? ORDER BY id').all(workspaceId);
  const items = await db.prepare(`SELECT i.id, i.name, i.sku, i.category, i.unit, i.reorder_level AS reorderLevel, i.active,
    COALESCE(SUM(m.quantity_delta), 0) AS stockOnHand,
    CASE WHEN COALESCE(SUM(m.quantity_delta), 0) <= i.reorder_level THEN 1 ELSE 0 END AS lowStock
    FROM inventory_items i LEFT JOIN inventory_movements m ON m.item_id = i.id
    WHERE i.workspace_id = ? AND i.active = 1 GROUP BY i.id ORDER BY i.name COLLATE NOCASE`).all(workspaceId);
  const movements = await db.prepare(`SELECT m.id, m.item_id AS itemId, i.name AS itemName, i.unit, m.type,
    m.quantity_delta AS quantityDelta, m.unit_cost AS unitCost, m.counterparty, m.note,
    m.movement_date AS date, m.transaction_id AS transactionId
    FROM inventory_movements m JOIN inventory_items i ON i.id = m.item_id
    WHERE m.workspace_id = ? ORDER BY substr(m.movement_date, 1, 10) DESC, m.id DESC LIMIT 30`).all(workspaceId);
  const totals = await db.prepare(`SELECT COUNT(*) AS totalItems,
    COALESCE(SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END), 0) AS activeItems FROM inventory_items WHERE workspace_id = ?`).get(workspaceId) as { totalItems: number; activeItems: number };
  const lowStock = (items as Array<{ lowStock: number }>).filter((item) => item.lowStock).length;
  return { workspace, accounts, items, movements, summary: { ...totals, lowStock } };
}

export async function getTeamData(selectedWorkspaceId?: number) {
  const workspaceId = await ensureDemoWorkspace(selectedWorkspaceId);
  await ensureDemoModuleData(workspaceId);
  const workspace = await db.prepare('SELECT id, name, currency FROM workspaces WHERE id = ?').get(workspaceId);
  const accounts = await db.prepare('SELECT id, name, currency FROM accounts WHERE workspace_id = ? ORDER BY id').all(workspaceId);
  const today = new Date().toISOString().slice(0, 10);
  const employeeRows = await db.prepare(`SELECT e.id, e.name, e.job_title AS jobTitle, e.employee_ref AS employeeRef,
    e.start_date AS startDate, e.end_date AS endDate, e.active,
    current_rate.amount AS currentSalary, current_rate.currency AS currency, current_rate.effective_from AS rateEffectiveFrom
    FROM employees e LEFT JOIN salary_rates current_rate ON current_rate.id = (
      SELECT r.id FROM salary_rates r WHERE r.employee_id = e.id AND r.effective_from <= ? ORDER BY r.effective_from DESC LIMIT 1
    ) WHERE e.workspace_id = ? ORDER BY e.active DESC, e.name COLLATE NOCASE`).all(today, workspaceId) as Array<Record<string, unknown> & { id: number; active: number }>;
  const salaryRates = await db.prepare(`SELECT r.id, r.employee_id AS employeeId, r.amount, r.currency, r.effective_from AS effectiveFrom
    FROM salary_rates r JOIN employees e ON e.id = r.employee_id WHERE e.workspace_id = ? ORDER BY r.effective_from DESC`).all(workspaceId) as Array<{ id: number; employeeId: number; amount: number; currency: string; effectiveFrom: string }>;
  const ratesByEmployee = new Map<number, typeof salaryRates>();
  for (const rate of salaryRates) ratesByEmployee.set(rate.employeeId, [...(ratesByEmployee.get(rate.employeeId) ?? []), rate]);
  const employees = employeeRows.map((employee) => ({ ...employee, salaryRates: ratesByEmployee.get(employee.id) ?? [] }));
  const periods = await db.prepare(`SELECT p.id, p.employee_id AS employeeId, e.name AS employeeName, e.job_title AS jobTitle,
    p.period_start AS periodStart, p.period_end AS periodEnd, p.due_date AS dueDate, p.amount_due AS amountDue,
    p.currency, p.note, COALESCE(SUM(sp.amount), 0) AS amountPaid
    FROM salary_periods p JOIN employees e ON e.id = p.employee_id
    LEFT JOIN salary_payments sp ON sp.salary_period_id = p.id
    WHERE p.workspace_id = ? GROUP BY p.id, e.name, e.job_title ORDER BY p.period_start DESC, p.due_date ASC LIMIT 30`).all(workspaceId) as Array<Record<string, string | number> & { periodStart: string; dueDate: string; amountDue: number; amountPaid: number }>;
  const payments = await db.prepare(`SELECT sp.id, sp.salary_period_id AS salaryPeriodId, sp.transaction_id AS transactionId,
    sp.amount, sp.paid_at AS paidAt, sp.note, t.account_id AS accountId, a.name AS accountName
    FROM salary_payments sp JOIN salary_periods p ON p.id = sp.salary_period_id
    JOIN transactions t ON t.id = sp.transaction_id JOIN accounts a ON a.id = t.account_id
    WHERE p.workspace_id = ? ORDER BY sp.paid_at DESC, sp.id DESC`).all(workspaceId);
  const normalizedPeriods = periods.map((period) => {
    const amountDue = Number(period.amountDue);
    const amountPaid = Number(period.amountPaid);
    const balance = Math.max(0, amountDue - amountPaid);
    const dueDate = String(period.dueDate);
    return { ...period, amountDue, amountPaid, balance, status: balance === 0 ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : dueDate < today ? 'OVERDUE' : 'UNPAID' };
  });
  const currentMonth = today.slice(0, 7);
  const monthStartDate = `${currentMonth}-01`;
  const nextMonthDate = new Date(Date.UTC(new Date(today).getUTCFullYear(), new Date(today).getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const currentSalaryDue = normalizedPeriods.filter((period) => String(period.periodStart).startsWith(currentMonth)).reduce((sum, period) => sum + Number(period.balance), 0);
  const paidThisMonth = (await db.prepare(`SELECT COALESCE(SUM(sp.amount), 0) AS total FROM salary_payments sp
    JOIN salary_periods p ON p.id = sp.salary_period_id
    WHERE p.workspace_id = ? AND sp.paid_at >= ? AND sp.paid_at < ?`).get(workspaceId, monthStartDate, nextMonthDate) as { total: number }).total;
  return {
    workspace, accounts, employees, periods: normalizedPeriods, payments,
    summary: {
      activeEmployees: (employees as Array<{ active: number }>).filter((employee) => employee.active).length,
      currentSalaryDue,
      pendingPeriods: normalizedPeriods.filter((period) => Number(period.balance) > 0).length,
      paidThisMonth,
    },
  };
}

export type DashboardTransaction = {
  id: number;
  title: string;
  category: string;
  date: string;
  amount: number;
  kind: string;
  account: string;
  destinationAccount: string | null;
  status: string;
  counterparty: string;
  note: string;
};

export async function getDashboardData(selectedWorkspaceId?: number) {
  const workspaceId = await ensureDemoWorkspace(selectedWorkspaceId);
  const workspace = await db.prepare('SELECT id, name, business_type AS businessType, currency FROM workspaces WHERE id = ?').get(workspaceId);
  const accounts = await db.prepare(`SELECT a.id, a.name, a.account_type AS type, a.currency, a.opening_balance AS openingBalance,
    a.opening_balance + COALESCE((SELECT SUM(CASE
      WHEN t.type IN ('INCOME', 'CONTRIBUTION', 'LOAN_RECEIVED') THEN t.amount
      WHEN t.type IN ('EXPENSE', 'WITHDRAWAL', 'LOAN_GIVEN') THEN -t.amount
      WHEN t.type = 'TRANSFER' AND t.account_id = a.id THEN -t.amount
      WHEN t.type = 'TRANSFER' AND t.destination_account_id = a.id THEN t.amount
      ELSE 0 END) FROM transactions t WHERE t.workspace_id = a.workspace_id AND t.status = 'CLEARED' AND (t.account_id = a.id OR t.destination_account_id = a.id)), 0)
      + COALESCE((SELECT SUM(CASE WHEN l.direction = 'PAYABLE' THEN -lr.principal_amount WHEN l.direction = 'RECEIVABLE' THEN lr.principal_amount ELSE 0 END)
        FROM loan_repayments lr JOIN loans l ON l.id = lr.loan_id WHERE lr.workspace_id = a.workspace_id AND lr.account_id = a.id), 0) AS balance
    FROM accounts a WHERE a.workspace_id = ? ORDER BY a.id`).all(workspaceId);
  const transactions = await db.prepare(`SELECT * FROM (
    SELECT t.id, t.description AS title, t.category, t.transaction_date AS date,
      t.amount, t.type AS kind, a.name AS account, destination.name AS destinationAccount,
      t.status, t.counterparty, t.note
    FROM transactions t JOIN accounts a ON a.id = t.account_id
    LEFT JOIN accounts destination ON destination.id = t.destination_account_id
    WHERE t.workspace_id = ?
    UNION ALL
    SELECT -lr.id AS id,
      CASE WHEN l.direction = 'PAYABLE' THEN 'Loan repayment · ' || l.name ELSE 'Loan collection · ' || l.name END AS title,
      CASE WHEN l.direction = 'PAYABLE' THEN 'Loan repayment' ELSE 'Loan collection' END AS category,
      lr.transaction_date AS date, lr.principal_amount AS amount,
      CASE WHEN l.direction = 'PAYABLE' THEN 'LOAN_REPAYMENT_OUT' ELSE 'LOAN_REPAYMENT_IN' END AS kind,
      a.name AS account, NULL AS destinationAccount, 'CLEARED' AS status, l.counterparty, lr.note
    FROM loan_repayments lr JOIN loans l ON l.id = lr.loan_id JOIN accounts a ON a.id = lr.account_id
    WHERE lr.workspace_id = ?
  ) activity ORDER BY substr(date, 1, 10) DESC, id DESC LIMIT 30`).all(workspaceId, workspaceId) as DashboardTransaction[];
  const owners = await db.prepare('SELECT id, name, role, share, effective_at AS effectiveAt FROM owners WHERE workspace_id = ? ORDER BY id').all(workspaceId);
  const loans = await db.prepare(`SELECT l.id, l.direction, l.name, l.counterparty, l.principal, l.outstanding, l.due_at AS dueAt,
      COALESCE(SUM(r.principal_amount), 0) AS repaidAmount, COUNT(r.id) AS repaymentCount,
      MAX(r.transaction_date) AS lastRepaymentAt
    FROM loans l LEFT JOIN loan_repayments r ON r.loan_id = l.id
    WHERE l.workspace_id = ? GROUP BY l.id ORDER BY (l.outstanding > 0) DESC, l.due_at ASC`).all(workspaceId);

  const now = new Date();
  const startThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const startLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
  const totals = await db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN type = 'INCOME' AND transaction_date >= ? THEN amount ELSE 0 END), 0) AS incomeThisMonth,
    COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND transaction_date >= ? THEN amount ELSE 0 END), 0) AS expensesThisMonth,
    COALESCE(SUM(CASE WHEN type = 'INCOME' AND transaction_date >= ? AND transaction_date < ? THEN amount ELSE 0 END), 0) AS incomeLastMonth,
    COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND transaction_date >= ? AND transaction_date < ? THEN amount ELSE 0 END), 0) AS expensesLastMonth
    FROM transactions WHERE workspace_id = ? AND status = 'CLEARED'`).get(startThisMonth, startThisMonth, startLastMonth, startThisMonth, startLastMonth, startThisMonth, workspaceId) as Record<string, number>;

  const chartStart = new Date();
  chartStart.setDate(chartStart.getDate() - 89);
  chartStart.setHours(0, 0, 0, 0);
  const daily = await db.prepare(`SELECT substr(transaction_date, 1, 10) AS day,
    SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS income,
    SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS expenses
    FROM transactions WHERE workspace_id = ? AND status = 'CLEARED' AND type IN ('INCOME', 'EXPENSE') AND transaction_date >= ?
    GROUP BY substr(transaction_date, 1, 10)`).all(workspaceId, chartStart.toISOString()) as Array<{ day: string; income: number; expenses: number }>;
  const dailyMap = new Map(daily.map((row) => [row.day, row]));
  const chart = Array.from({ length: 90 }, (_, index) => {
    const date = new Date(chartStart);
    date.setDate(chartStart.getDate() + index);
    const day = date.toISOString().slice(0, 10);
    const point = dailyMap.get(day);
    return { day, income: Math.round((point?.income ?? 0) / 1000), expenses: Math.round((point?.expenses ?? 0) / 1000) };
  });

  const cashBalance = (accounts as Array<{ balance: number }>).reduce((sum, account) => sum + account.balance, 0);
  const outstandingLoans = (loans as Array<{ outstanding: number }>).reduce((sum, loan) => sum + loan.outstanding, 0);
  return {
    workspace,
    accounts,
    transactions,
    owners,
    loans,
    summary: {
      cashBalance,
      incomeThisMonth: totals.incomeThisMonth,
      expensesThisMonth: totals.expensesThisMonth,
      incomeLastMonth: totals.incomeLastMonth,
      expensesLastMonth: totals.expensesLastMonth,
      outstandingLoans,
      activeLoans: (loans as Array<{ outstanding: number }>).filter((loan) => Number(loan.outstanding) > 0).length,
    },
    chart,
  };
}
