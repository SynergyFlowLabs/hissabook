/**
 * Income and expense summary data, shared by the reports screen and its CSV.
 *
 * Query shape is kept ASCII-safe because the same statements run on SQLite and
 * Postgres through the database adapter: no clever string functions, no boolean
 * columns in the projection.
 */
import { db, ensureDemoWorkspace } from '@/lib/database';
import type { DateRange } from './period';

/**
 * Rows that carry a report tag. The tag is derived from the record that created
 * the transaction rather than stored on it, so a salary payment or stock purchase
 * cannot drift out of the report if the source row is edited later.
 */
export const TAGGED_ACTIVITY_SQL = `
  SELECT t.id, substr(t.transaction_date, 1, 10) AS day, t.type AS kind, t.category,
    t.amount, t.status, t.description, t.counterparty, t.created_by AS createdBy,
    t.account_id AS accountId,
    CASE
      WHEN EXISTS (SELECT 1 FROM salary_payments sp WHERE sp.transaction_id = t.id) THEN 'SALARY_PAYMENT'
      WHEN EXISTS (SELECT 1 FROM inventory_movements im WHERE im.transaction_id = t.id) THEN 'INVENTORY_PURCHASE'
      ELSE NULL
    END AS tag
  FROM transactions t
  WHERE t.workspace_id = ?`;

export type SummaryRow = {
  id: number;
  day: string;
  kind: string;
  category: string;
  amount: number;
  status: string;
  description: string;
  counterparty: string;
  createdBy: string;
  accountId: number;
  tag: string | null;
};

export async function loadTaggedActivity(workspaceId: number, range: DateRange): Promise<SummaryRow[]> {
  const rows = await db.prepare(`${TAGGED_ACTIVITY_SQL}
    AND substr(t.transaction_date, 1, 10) >= ? AND substr(t.transaction_date, 1, 10) <= ?
    ORDER BY substr(t.transaction_date, 1, 10) ASC, t.id ASC`)
    .all(workspaceId, range.from, range.to) as SummaryRow[];
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

export type AccountTotal = { accountId: number | null; account: string; amount: number; count: number };

export async function loadAccountNames(workspaceId: number): Promise<Map<number, string>> {
  const rows = await db.prepare('SELECT id, name FROM accounts WHERE workspace_id = ? AND is_system = 0 ORDER BY name')
    .all(workspaceId) as Array<{ id: number; name: string }>;
  return new Map(rows.map((row) => [Number(row.id), String(row.name)]));
}

/**
 * Cash view inside the range: cleared money in and out of each business account.
 * Transfers show on both sides because the cash really did move twice, and the
 * screen labels them so nobody reads the two lines as income.
 */
export async function loadAccountFlow(workspaceId: number, range: DateRange): Promise<{ inflow: AccountTotal[]; outflow: AccountTotal[] }> {
  const rows = await db.prepare(`${TAGGED_ACTIVITY_SQL}
    AND t.status = 'CLEARED'
    AND substr(t.transaction_date, 1, 10) >= ? AND substr(t.transaction_date, 1, 10) <= ?`)
    .all(workspaceId, range.from, range.to) as SummaryRow[];
  const names = await loadAccountNames(workspaceId);
  const inflow = new Map<string, AccountTotal>();
  const outflow = new Map<string, AccountTotal>();
  const bump = (target: Map<string, AccountTotal>, key: string, accountId: number | null, account: string, amount: number) => {
    const current = target.get(key) ?? { accountId, account, amount: 0, count: 0 };
    current.amount += amount;
    current.count += 1;
    target.set(key, current);
  };
  for (const row of rows) {
    const account = names.get(Number(row.accountId)) ?? 'Unknown account';
    const key = String(row.accountId);
    const kind = row.kind.toUpperCase();
    if (kind === 'INCOME' || kind === 'CONTRIBUTION' || kind === 'LOAN_RECEIVED') bump(inflow, key, Number(row.accountId), account, row.amount);
    if (kind === 'EXPENSE' || kind === 'WITHDRAWAL' || kind === 'LOAN_GIVEN') bump(outflow, key, Number(row.accountId), account, row.amount);
    // Transfers are excluded from this cash view: an internal move is neither an
    // arrival nor a departure for the business as a whole, and counting both legs
    // would inflate every total by the transfer amount.
  }
  return {
    inflow: [...inflow.values()].sort((a, b) => b.amount - a.amount),
    outflow: [...outflow.values()].sort((a, b) => b.amount - a.amount),
  };
}

export type LoanFlow = { feesReceived: number; feesPaid: number; principalOut: number; principalIn: number; repaymentCount: number };

export async function loadLoanFlow(workspaceId: number, range: DateRange): Promise<LoanFlow> {
  const row = await db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN l.direction = 'RECEIVABLE' THEN lr.fee_amount ELSE 0 END), 0) AS feesReceived,
      COALESCE(SUM(CASE WHEN l.direction = 'PAYABLE' THEN lr.fee_amount ELSE 0 END), 0) AS feesPaid,
      COALESCE(SUM(CASE WHEN l.direction = 'RECEIVABLE' THEN lr.principal_amount ELSE 0 END), 0) AS principalIn,
      COALESCE(SUM(CASE WHEN l.direction = 'PAYABLE' THEN lr.principal_amount ELSE 0 END), 0) AS principalOut,
      COUNT(*) AS repaymentCount
    FROM loan_repayments lr JOIN loans l ON l.id = lr.loan_id
    WHERE lr.workspace_id = ? AND substr(lr.transaction_date, 1, 10) >= ? AND substr(lr.transaction_date, 1, 10) <= ?`)
    .get(workspaceId, range.from, range.to) as Record<string, number>;
  return {
    feesReceived: Number(row?.feesReceived ?? 0),
    feesPaid: Number(row?.feesPaid ?? 0),
    principalOut: Number(row?.principalOut ?? 0),
    principalIn: Number(row?.principalIn ?? 0),
    repaymentCount: Number(row?.repaymentCount ?? 0),
  };
}

export type StatusCounts = { pendingCount: number; pendingAmount: number; voidCount: number };

export async function loadStatusCounts(workspaceId: number, range: DateRange): Promise<StatusCounts> {
  const row = await db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pendingCount,
      COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) AS pendingAmount,
      COALESCE(SUM(CASE WHEN status = 'VOID' THEN 1 ELSE 0 END), 0) AS voidCount
    FROM transactions WHERE workspace_id = ?
    AND substr(transaction_date, 1, 10) >= ? AND substr(transaction_date, 1, 10) <= ?`)
    .get(workspaceId, range.from, range.to) as Record<string, number>;
  return {
    pendingCount: Number(row?.pendingCount ?? 0),
    pendingAmount: Number(row?.pendingAmount ?? 0),
    voidCount: Number(row?.voidCount ?? 0),
  };
}

/** Daily net movement, for the small trend line above the tables. */
export async function loadDailyNet(workspaceId: number, range: DateRange): Promise<Array<{ day: string; income: number; expenses: number }>> {
  const rows = await db.prepare(`SELECT substr(transaction_date, 1, 10) AS day,
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expenses
    FROM transactions WHERE workspace_id = ? AND status = 'CLEARED'
    AND substr(transaction_date, 1, 10) >= ? AND substr(transaction_date, 1, 10) <= ?
    GROUP BY substr(transaction_date, 1, 10) ORDER BY day`).all(workspaceId, range.from, range.to) as Array<Record<string, unknown>>;
  return rows.map((row) => ({ day: String(row.day), income: Number(row.income), expenses: Number(row.expenses) }));
}

/** Monthly split used by both the summary screen and the profit report. */
export async function loadMonthlySplit(workspaceId: number, range: DateRange): Promise<Array<{ month: string; income: number; expenses: number }>> {
  const rows = await db.prepare(`SELECT substr(transaction_date, 1, 7) AS month,
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expenses
    FROM transactions WHERE workspace_id = ? AND status = 'CLEARED'
    AND substr(transaction_date, 1, 10) >= ? AND substr(transaction_date, 1, 10) <= ?
    GROUP BY substr(transaction_date, 1, 7) ORDER BY month`).all(workspaceId, range.from, range.to) as Array<Record<string, unknown>>;
  return rows.map((row) => ({ month: String(row.month), income: Number(row.income), expenses: Number(row.expenses) }));
}

/** Owner money in and out in the range, kept apart from profit on purpose. */
export async function loadOwnerFlow(workspaceId: number, range: DateRange): Promise<Array<{ kind: string; account: string; amount: number; count: number }>> {
  const names = await loadAccountNames(workspaceId);
  const rows = await db.prepare(`SELECT type AS kind, account_id AS accountId, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count
    FROM transactions WHERE workspace_id = ? AND status = 'CLEARED' AND type IN ('CONTRIBUTION', 'WITHDRAWAL', 'TRANSFER')
    AND substr(transaction_date, 1, 10) >= ? AND substr(transaction_date, 1, 10) <= ?
    GROUP BY type, account_id ORDER BY type`).all(workspaceId, range.from, range.to) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    kind: String(row.kind),
    account: names.get(Number(row.accountId)) ?? 'Unknown account',
    amount: Number(row.amount),
    count: Number(row.count),
  }));
}

export async function resolveReportWorkspace(selectedWorkspaceId?: number) {
  const workspaceId = await ensureDemoWorkspace(selectedWorkspaceId);
  const workspace = await db.prepare('SELECT id, name, currency FROM workspaces WHERE id = ?').get(workspaceId) as { id: number; name: string; currency: string };
  return { workspaceId, workspace };
}
