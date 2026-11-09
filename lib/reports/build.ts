/**
 * Assembles the report payloads. One place builds each report so the screen, the
 * print view and the CSV export can never show different numbers.
 */
import { db } from '@/lib/database';
import { computeTotals, type CategoryTotal, type PlInput, topWithOther } from './pl';
import { moneyClass, neutralReason } from './kind';
import { monthsInRange, rangeLabel, type DateRange } from './period';
import {
  loadAccountFlow, loadDailyNet, loadLoanFlow, loadMonthlySplit, loadOwnerFlow,
  loadStatusCounts, loadTaggedActivity, loadAccountNames, resolveReportWorkspace,
} from './summary';

export type ReportMeta = { workspace: string; currency: string; range: DateRange; label: string; generatedAt: string; role: string };

export type SummaryReport = {
  meta: ReportMeta;
  totals: { income: number; expenses: number; net: number };
  income: CategoryTotal[];
  expenses: CategoryTotal[];
  accountInflow: Array<{ account: string; amount: number; count: number }>;
  accountOutflow: Array<{ account: string; amount: number; count: number }>;
  ownerFlow: Array<{ kind: string; label: string; account: string; amount: number; count: number }>;
  loans: { feesReceived: number; feesPaid: number; principalIn: number; principalOut: number; repaymentCount: number };
  status: { pendingCount: number; pendingAmount: number; voidCount: number };
  daily: Array<{ day: string; income: number; expenses: number }>;
  monthly: Array<{ month: string; income: number; expenses: number }>;
  neutral: Array<{ label: string; amount: number; count: number }>;
  excludedCount: number;
};

export type ProfitReport = {
  meta: ReportMeta;
  totals: ReturnType<typeof computeTotals>;
  income: CategoryTotal[];
  expenses: CategoryTotal[];
  monthly: Array<{ month: string; income: number; expenses: number }>;
  appropriation: Array<{ id: number; periodFrom: string; periodTo: string; residual: number; status: string }>;
  input: PlInput;
};

const OWNER_LABEL: Record<string, string> = {
  CONTRIBUTION: 'Owner contributions',
  WITHDRAWAL: 'Owner withdrawals',
  TRANSFER: 'Internal transfers',
};

function group(rows: Array<{ category: string; amount: number }>): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const row of rows) {
    const label = row.category?.trim() || 'Uncategorised';
    const key = label.toLocaleLowerCase();
    const current = map.get(key) ?? { key, label, amount: 0, count: 0 };
    current.amount += row.amount;
    current.count += 1;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function metaFor(workspace: { name: string; currency: string }, range: DateRange, role: string): ReportMeta {
  return { workspace: workspace.name, currency: workspace.currency, range, label: rangeLabel(range), generatedAt: new Date().toISOString(), role };
}

export async function buildSummaryReport(range: DateRange, role: string, selectedWorkspaceId?: number): Promise<SummaryReport> {
  const { workspaceId, workspace } = await resolveReportWorkspace(selectedWorkspaceId);
  const [rows, flow, loans, status, daily, monthly, ownerFlow] = await Promise.all([
    loadTaggedActivity(workspaceId, range),
    loadAccountFlow(workspaceId, range),
    loadLoanFlow(workspaceId, range),
    loadStatusCounts(workspaceId, range),
    loadDailyNet(workspaceId, range),
    loadMonthlySplit(workspaceId, range),
    loadOwnerFlow(workspaceId, range),
  ]);

  const cleared = rows.filter((row) => row.status === 'CLEARED');
  const incomeRows = cleared.filter((row) => moneyClass(row.kind, row.tag) === 'income');
  const expenseRows = cleared.filter((row) => moneyClass(row.kind, row.tag) === 'expense');
  const neutralRows = cleared.filter((row) => moneyClass(row.kind, row.tag) === 'neutral');

  const neutralMap = new Map<string, { label: string; amount: number; count: number }>();
  for (const row of neutralRows) {
    const label = neutralReason(row.kind);
    const current = neutralMap.get(label) ?? { label, amount: 0, count: 0 };
    current.amount += row.amount;
    current.count += 1;
    neutralMap.set(label, current);
  }

  const income = group(incomeRows);
  const expenses = group(expenseRows);
  const totalIncome = income.reduce((total, row) => total + row.amount, 0);
  const totalExpenses = expenses.reduce((total, row) => total + row.amount, 0);

  return {
    meta: metaFor(workspace, range, role),
    totals: { income: totalIncome, expenses: totalExpenses, net: totalIncome - totalExpenses },
    income,
    expenses,
    accountInflow: flow.inflow.map(({ account, amount, count }) => ({ account, amount, count })),
    accountOutflow: flow.outflow.map(({ account, amount, count }) => ({ account, amount, count })),
    ownerFlow: ownerFlow.map((row) => ({ ...row, label: OWNER_LABEL[row.kind] ?? row.kind })),
    loans,
    status,
    daily,
    monthly,
    neutral: [...neutralMap.values()].sort((a, b) => b.amount - a.amount),
    excludedCount: neutralRows.length + status.pendingCount + status.voidCount,
  };
}

export async function buildProfitReport(range: DateRange, role: string, selectedWorkspaceId?: number): Promise<ProfitReport> {
  const { workspaceId, workspace } = await resolveReportWorkspace(selectedWorkspaceId);
  const [rows, loans, status, monthly] = await Promise.all([
    loadTaggedActivity(workspaceId, range),
    loadLoanFlow(workspaceId, range),
    loadStatusCounts(workspaceId, range),
    loadMonthlySplit(workspaceId, range),
  ]);
  const distributionRows = await db.prepare(`SELECT id, period_from AS periodFrom, period_to AS periodTo, residual_distributed AS residual, status
    FROM profit_distributions WHERE workspace_id = ? AND substr(period_to, 1, 10) >= ? AND substr(period_from, 1, 10) <= ?
    ORDER BY period_to, id`).all(workspaceId, range.from, range.to) as Array<Record<string, unknown>>;
  const salaryRow = await db.prepare(`SELECT COALESCE(SUM(sp.amount), 0) AS paid, COUNT(DISTINCT sp.salary_period_id) AS periods
    FROM salary_payments sp JOIN salary_periods per ON per.id = sp.salary_period_id
    WHERE per.workspace_id = ? AND substr(sp.paid_at, 1, 10) >= ? AND substr(sp.paid_at, 1, 10) <= ?`)
    .get(workspaceId, range.from, range.to) as Record<string, number> | undefined;
  const movementRow = await db.prepare(`SELECT COUNT(*) AS count FROM inventory_movements WHERE workspace_id = ? AND transaction_id IS NOT NULL
    AND substr(movement_date, 1, 10) >= ? AND substr(movement_date, 1, 10) <= ?`)
    .get(workspaceId, range.from, range.to) as Record<string, number> | undefined;
  const salary = salaryRow;
  const movements = movementRow;
  const distributions = distributionRows;

  const cleared = rows.filter((row) => row.status === 'CLEARED');
  const income = group(cleared.filter((row) => moneyClass(row.kind, row.tag) === 'income'));
  const expenses = group(cleared.filter((row) => moneyClass(row.kind, row.tag) === 'expense'));
  const transfers = cleared.filter((row) => row.kind.toUpperCase() === 'TRANSFER').length;
  const contributions = cleared.filter((row) => row.kind.toUpperCase() === 'CONTRIBUTION').length;
  const withdrawals = cleared.filter((row) => row.kind.toUpperCase() === 'WITHDRAWAL').length;
  const loanPrincipal = cleared.filter((row) => row.kind.toUpperCase() === 'LOAN_RECEIVED' || row.kind.toUpperCase() === 'LOAN_GIVEN').length;

  const input: PlInput = {
    income,
    expenses,
    feesReceived: loans.feesReceived,
    feesPaid: loans.feesPaid,
    salaryPaid: Number(salary?.paid ?? 0),
    salaryPeriods: Number(salary?.periods ?? 0),
    recommendations: Number(movements?.count ?? 0),
    excluded: { transfers, contributions, withdrawals, loanPrincipal, pendingCount: status.pendingCount, voidCount: status.voidCount },
  };

  return {
    meta: metaFor(workspace, range, role),
    totals: computeTotals(input),
    income,
    expenses,
    monthly,
    appropriation: distributions.map((row) => ({
      id: Number(row.id),
      periodFrom: String(row.periodFrom),
      periodTo: String(row.periodTo),
      residual: Number(row.residual),
      status: String(row.status),
    })),
    input,
  };
}

export type StockReport = {
  meta: ReportMeta;
  items: Array<{ id: number; name: string; sku: string; unit: string; opening: number; received: number; issued: number; closing: number; reorderLevel: number; low: boolean }>;
  purchasedValue: number;
  purchaseCount: number;
  openingNote: string;
};

/**
 * Stock movement report. Opening quantity is defined as everything recorded
 * before the range starts, so closing always equals opening plus movements and a
 * reader can check the arithmetic by hand.
 */
export async function buildStockReport(range: DateRange, role: string, selectedWorkspaceId?: number): Promise<StockReport> {
  const { workspaceId, workspace } = await resolveReportWorkspace(selectedWorkspaceId);
  const items = await db.prepare('SELECT id, name, sku, unit, reorder_level AS reorderLevel FROM inventory_items WHERE workspace_id = ? AND active = 1 ORDER BY name')
    .all(workspaceId) as Array<{ id: number; name: string; sku: string; unit: string; reorderLevel: number }>;
  const opening = await db.prepare(`SELECT item_id AS itemId, COALESCE(SUM(quantity_delta), 0) AS qty FROM inventory_movements
    WHERE workspace_id = ? AND substr(movement_date, 1, 10) < ? GROUP BY item_id`).all(workspaceId, range.from) as Array<{ itemId: number; qty: number }>;
  const received = await db.prepare(`SELECT item_id AS itemId, COALESCE(SUM(quantity_delta), 0) AS qty FROM inventory_movements
    WHERE workspace_id = ? AND quantity_delta > 0 AND substr(movement_date, 1, 10) >= ? AND substr(movement_date, 1, 10) <= ? GROUP BY item_id`)
    .all(workspaceId, range.from, range.to) as Array<{ itemId: number; qty: number }>;
  const issued = await db.prepare(`SELECT item_id AS itemId, COALESCE(SUM(quantity_delta), 0) AS qty FROM inventory_movements
    WHERE workspace_id = ? AND quantity_delta < 0 AND substr(movement_date, 1, 10) >= ? AND substr(movement_date, 1, 10) <= ? GROUP BY item_id`)
    .all(workspaceId, range.from, range.to) as Array<{ itemId: number; qty: number }>;
  const spend = await db.prepare(`SELECT COALESCE(SUM(t.amount), 0) AS total, COUNT(*) AS count FROM transactions t
    WHERE t.workspace_id = ? AND t.status = 'CLEARED' AND substr(t.transaction_date, 1, 10) >= ? AND substr(t.transaction_date, 1, 10) <= ?
    AND EXISTS (SELECT 1 FROM inventory_movements im WHERE im.transaction_id = t.id)`)
    .get(workspaceId, range.from, range.to) as Record<string, number> | undefined;

  const openMap = new Map(opening.map((row) => [Number(row.itemId), Number(row.qty)]));
  const recvMap = new Map(received.map((row) => [Number(row.itemId), Number(row.qty)]));
  const issuedMap = new Map(issued.map((row) => [Number(row.itemId), Number(row.qty)]));
  return {
    meta: metaFor(workspace, range, role),
    items: items.map((item) => {
      const openingQty = openMap.get(Number(item.id)) ?? 0;
      const receivedQty = recvMap.get(Number(item.id)) ?? 0;
      const issuedQty = issuedMap.get(Number(item.id)) ?? 0;
      const closingQty = openingQty + receivedQty + issuedQty;
      return {
        id: Number(item.id), name: item.name, sku: item.sku ?? '', unit: item.unit ?? 'units',
        opening: openingQty, received: receivedQty, issued: issuedQty, closing: closingQty,
        reorderLevel: Number(item.reorderLevel ?? 0),
        low: Number(item.reorderLevel ?? 0) > 0 && closingQty <= Number(item.reorderLevel),
      };
    }),
    purchasedValue: Number(spend?.total ?? 0),
    purchaseCount: Number(spend?.count ?? 0),
    openingNote: 'Opening is everything recorded before the first day of the range. Closing equals opening plus received minus issued.',
  };
}

export type SalaryReport = {
  meta: ReportMeta;
  rows: Array<{ id: number; employee: string; periodStart: string; periodEnd: string; dueDate: string; amountDue: number; paid: number; outstanding: number; status: string }>;
  totals: { due: number; paid: number; outstanding: number };
  employeeCount: number;
  basisNote: string;
};

/**
 * Salary due and salary paid, side by side. Salary payments are stored as
 * expenses at the moment of payment, so this report never adds them to expenses a
 * second time: it reports the obligation beside the payment, not on top of it.
 */
export async function buildSalaryReport(range: DateRange, role: string, selectedWorkspaceId?: number): Promise<SalaryReport> {
  const { workspaceId, workspace } = await resolveReportWorkspace(selectedWorkspaceId);
  const rows = await db.prepare(`SELECT per.id, e.name AS employee, per.period_start AS periodStart, per.period_end AS periodEnd,
      per.due_date AS dueDate, per.amount_due AS amountDue, COALESCE(SUM(sp.amount), 0) AS paid
    FROM salary_periods per JOIN employees e ON e.id = per.employee_id
    LEFT JOIN salary_payments sp ON sp.salary_period_id = per.id
    WHERE per.workspace_id = ? AND substr(per.period_start, 1, 10) >= ? AND substr(per.period_start, 1, 10) <= ?
    GROUP BY per.id ORDER BY per.period_start, e.name`)
    .all(workspaceId, range.from, range.to) as Array<Record<string, unknown>>;
  const employees = await db.prepare('SELECT COUNT(*) AS count FROM employees WHERE workspace_id = ? AND active = 1').get(workspaceId) as Record<string, number> | undefined;

  const mapped = rows.map((row) => {
    const amountDue = Number(row.amountDue);
    const paid = Number(row.paid);
    const outstanding = Math.max(0, amountDue - paid);
    return {
      id: Number(row.id), employee: String(row.employee), periodStart: String(row.periodStart), periodEnd: String(row.periodEnd),
      dueDate: String(row.dueDate), amountDue, paid, outstanding,
      status: outstanding <= 0 ? 'Paid' : paid > 0 ? 'Partly paid' : 'Unpaid',
    };
  });
  return {
    meta: metaFor(workspace, range, role),
    rows: mapped,
    totals: {
      due: mapped.reduce((total, row) => total + row.amountDue, 0),
      paid: mapped.reduce((total, row) => total + row.paid, 0),
      outstanding: mapped.reduce((total, row) => total + row.outstanding, 0),
    },
    employeeCount: Number(employees?.count ?? 0),
    basisNote: 'Salary periods are grouped by the month they start in. A payment is shown against the period it settles, so paid and outstanding add up to the amount due.',
  };
}

export { group as groupByCategory, metaFor, monthsInRange, loadAccountNames, topWithOther };
