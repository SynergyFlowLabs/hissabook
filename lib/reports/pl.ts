/**
 * Profit and loss arithmetic, kept pure so it can be tested without a database.
 *
 * Basis, stated plainly because the UI repeats it:
 * - Only CLEARED rows count. Pending rows are not recognised, and VOID rows stay
 *   out of every total.
 * - Income is INCOME. Expenses are EXPENSE, plus LOAN_REPAYMENT_OUT fee amounts
 *   (the fee is a real cost of borrowing) and explicit salary payments and stock
 *   purchases, which the app already records as EXPENSE rows so they are not
 *   counted twice.
 * - Transfers, contributions, withdrawals, loan principal and repayments of
 *   principal are not profit or loss. A loan you received is cash, not income.
 * - Partner profit shares are an appropriation of profit, not an expense, so they
 *   are listed separately and never subtracted here.
 *
 * This is an informational summary, not audited accounts.
 */

export type PlLineKind = 'INCOME' | 'EXPENSE' | 'EXCLUDED' | 'FEE_INCOME';

export type PlRow = {
  /** Signed amount in PKR, or null when the bucket is an explicit placeholder. */
  amount: number | null;
  /** Only set for explicit placeholders such as "Stock movement value". */
  note?: string;
};

export type CategoryTotal = { key: string; label: string; amount: number; count: number };

export type PlInput = {
  income: CategoryTotal[];
  expenses: CategoryTotal[];
  /** Loan repayment fees, split by direction. Fees received are other income. */
  feesReceived: number;
  feesPaid: number;
  /** Counts used for the honesty line at the bottom of the report. */
  excluded: { transfers: number; contributions: number; withdrawals: number; loanPrincipal: number; pendingCount: number; voidCount: number };
  salaryPaid: number;
  salaryPeriods: number;
  recommendations: number;
};

export type PlTotals = {
  income: number;
  feeIncome: number;
  totalIncome: number;
  expenses: number;
  feeExpense: number;
  totalExpenses: number;
  netProfit: number;
  marginPct: number | null;
};

export function computeTotals(input: Pick<PlInput, 'income' | 'expenses' | 'feesReceived' | 'feesPaid'>): PlTotals {
  const income = sum(input.income);
  const expenses = sum(input.expenses);
  const feeIncome = Math.max(0, round(input.feesReceived));
  const feeExpense = Math.max(0, round(input.feesPaid));
  const totalIncome = income + feeIncome;
  const totalExpenses = expenses + feeExpense;
  const netProfit = totalIncome - totalExpenses;
  return {
    income,
    feeIncome,
    totalIncome,
    expenses,
    feeExpense,
    totalExpenses,
    netProfit,
    marginPct: totalIncome > 0 ? round((netProfit / totalIncome) * 1000) / 10 : null,
  };
}

export function sum(rows: CategoryTotal[]): number {
  return rows.reduce((total, row) => total + row.amount, 0);
}

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/** Largest single expense, used for the "what ate the money" line. */
export function biggest(rows: CategoryTotal[]): CategoryTotal | null {
  return rows.reduce<CategoryTotal | null>((best, row) => (!best || row.amount > best.amount ? row : best), null);
}

/** Share of an expense category in total expenses, as a whole percentage. */
export function shareOf(row: CategoryTotal, rows: CategoryTotal[]): number | null {
  const total = sum(rows);
  if (total <= 0) return null;
  return Math.round((row.amount / total) * 1000) / 10;
}

/**
 * Sorts categories biggest first and collapses the tail into "Other" so the
 * report stays readable on a phone. `limit` counts the named rows.
 */
export function topWithOther(rows: CategoryTotal[], limit = 8): CategoryTotal[] {
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit);
  const tail = sorted.slice(limit);
  const other: CategoryTotal = {
    key: '__other__',
    label: `Other (${tail.length} ${tail.length === 1 ? 'category' : 'categories'})`,
    amount: tail.reduce((total, row) => total + row.amount, 0),
    count: tail.reduce((total, row) => total + row.count, 0),
  };
  return [...head, other];
}

/**
 * Month buckets for the report chart. Months with no activity are present with
 * zeroes so the bars do not silently shift the timeline.
 */
export function monthlySeries(
  months: string[],
  rows: Array<{ month: string; income: number; expenses: number }>,
): Array<{ month: string; income: number; expenses: number }> {
  const map = new Map(rows.map((row) => [row.month, row]));
  return months.map((month) => {
    const row = map.get(month);
    return { month, income: round(row?.income ?? 0), expenses: round(row?.expenses ?? 0) };
  });
}

/**
 * Plain-language reading of the numbers. Deliberately factual and free of advice;
 * NFR-07 keeps the product out of accounting and legal claims.
 */
export function describeResult(totals: PlTotals): string {
  if (totals.totalIncome === 0 && totals.totalExpenses === 0) return 'No cleared income or expenses in this period.';
  if (totals.netProfit > 0) return `Cleared income is higher than cleared expenses by ${totals.netProfit.toLocaleString('en-PK')} PKR.`;
  if (totals.netProfit < 0) return `Cleared expenses are higher than cleared income by ${Math.abs(totals.netProfit).toLocaleString('en-PK')} PKR.`;
  return 'Cleared income and cleared expenses are equal in this period.';
}

export const BASIS_LINES = [
  'Only cleared records are counted. Pending records are not recognised and voided records are excluded.',
  'Loan principal, transfers, owner contributions and owner withdrawals are not income or expenses.',
  'A loan repayment fee is counted as a cost. Repaying the principal is not.',
  'Salaries and paid stock purchases appear as expenses because the app records them as expenses once, at payment.',
  'Partner profit shares are an appropriation of profit, not an expense, and are not subtracted here.',
  'This summary is informational. It is not audited accounts, accounting advice, or a tax filing.',
];

/** CSV rows for the two tables, so the export matches the screen exactly. */
export function plCsvRows(input: PlInput): Array<[string, string, string, number]> {
  const rows: Array<[string, string, string, number]> = [];
  for (const row of topWithOther(input.income, 100)) rows.push(['Income', row.label, String(row.count), row.amount]);
  if (input.feesReceived > 0) rows.push(['Income', 'Loan fees received', '', input.feesReceived]);
  for (const row of topWithOther(input.expenses, 100)) rows.push(['Expense', row.label, String(row.count), row.amount]);
  if (input.feesPaid > 0) rows.push(['Expense', 'Loan repayment fees', '', input.feesPaid]);
  return rows;
}
