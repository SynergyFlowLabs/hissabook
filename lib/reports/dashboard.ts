/**
 * The one-glance summary shown on the dashboard. Same classification as the full
 * reports screen, trimmed to what fits in a card.
 */
import { buildSummaryReport } from './build';
import type { DateRange } from './period';

export type DashboardSnapshot = {
  label: string;
  income: number;
  expenses: number;
  net: number;
  topExpenses: Array<{ label: string; amount: number }>;
  excludedCount: number;
  pendingCount: number;
  pendingAmount: number;
};

export async function buildDashboardSnapshot(range: DateRange, label: string, workspaceId: number): Promise<DashboardSnapshot> {
  const report = await buildSummaryReport(range, '', workspaceId);
  return {
    label,
    income: report.totals.income,
    expenses: report.totals.expenses,
    net: report.totals.net,
    topExpenses: report.expenses.slice(0, 4).map((row) => ({ label: row.label, amount: row.amount })),
    excludedCount: report.excludedCount,
    pendingCount: report.status.pendingCount,
    pendingAmount: report.status.pendingAmount,
  };
}
