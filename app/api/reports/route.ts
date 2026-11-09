import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceMember } from '@/lib/authorization';
import { buildProfitReport, buildSalaryReport, buildStockReport, buildSummaryReport } from '@/lib/reports/build';
import { sanitiseRange } from '@/lib/reports/period';
import { topWithOther } from '@/lib/reports/pl';
import { csvAttachment, csvNum } from '@/lib/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Report data and CSV, one endpoint per report type.
 *
 * Filters come from the query string so a report link can be shared or printed
 * with the same range and scope. `format=csv` returns an attachment built from
 * the same payload the screen renders.
 */
const KINDS = new Set(['summary', 'profit', 'stock', 'salary']);

const today = () => new Date().toISOString().slice(0, 10);

function attachment(body: string, name: string) {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const params = request.nextUrl.searchParams;
  const kind = (params.get('kind') ?? 'summary').toLowerCase();
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'Choose a valid report.' }, { status: 400 });

  const { range, error } = sanitiseRange(params.get('from') ?? '', params.get('to') ?? '', today());
  if (error) return NextResponse.json({ error }, { status: 400 });

  const csv = params.get('format') === 'csv';
  const role = access.member.role;
  const workspaceId = access.member.workspaceId;

  if (kind === 'salary' && !['OWNER', 'ADMIN', 'PAYROLL'].includes(role)) {
    // EMP-06: compensation is limited to payroll-authorized roles.
    return NextResponse.json({ error: 'Only owners, admins, and payroll members can view salary reports.' }, { status: 403 });
  }

  try {
    if (kind === 'summary') {
      const report = await buildSummaryReport(range, role, workspaceId);
      if (!csv) return NextResponse.json(report, { headers: { 'Cache-Control': 'private, no-store' } });
      const rows: Array<Array<string | number>> = [];
      for (const row of report.income) rows.push(['Income', row.label, String(row.count), row.amount]);
      for (const row of report.expenses) rows.push(['Expense', row.label, String(row.count), row.amount]);
      for (const row of report.accountInflow) rows.push(['Cash in', row.account, String(row.count), row.amount]);
      for (const row of report.accountOutflow) rows.push(['Cash out', row.account, String(row.count), row.amount]);
      for (const row of report.ownerFlow) rows.push([row.label, row.account, String(row.count), row.amount]);
      for (const row of report.neutral) rows.push(['Not income or expense', row.label, String(row.count), row.amount]);
      rows.push(['Total', 'Income', '', report.totals.income]);
      rows.push(['Total', 'Expenses', '', report.totals.expenses]);
      rows.push(['Total', 'Income minus expenses', '', report.totals.net]);
      return attachment(csvAttachment(
        [`${report.meta.workspace} income and expense summary`, `${report.meta.label}`, `Currency ${report.meta.currency}`, 'Only cleared records are counted. Transfers, owner money, and loan principal are excluded.'],
        ['Section', 'Category or account', 'Records', `Amount (${report.meta.currency})`], rows,
      ), `income-expense-summary-${range.from}-to-${range.to}.csv`);
    }

    if (kind === 'profit') {
      const report = await buildProfitReport(range, role, workspaceId);
      if (!csv) return NextResponse.json(report, { headers: { 'Cache-Control': 'private, no-store' } });
      const rows: Array<Array<string | number>> = [];
      for (const row of topWithOther(report.income, 100)) rows.push(['Income', row.label, String(row.count), row.amount]);
      if (report.totals.feeIncome > 0) rows.push(['Income', 'Loan fees received', '', report.totals.feeIncome]);
      for (const row of topWithOther(report.expenses, 100)) rows.push(['Expense', row.label, String(row.count), row.amount]);
      if (report.totals.feeExpense > 0) rows.push(['Expense', 'Loan repayment fees', '', report.totals.feeExpense]);
      rows.push(['Total', 'Income', '', report.totals.totalIncome]);
      rows.push(['Total', 'Expenses', '', report.totals.totalExpenses]);
      rows.push(['Total', 'Income minus expenses', '', report.totals.netProfit]);
      for (const row of report.appropriation) rows.push(['Appropriation (not an expense)', `Distribution #${row.id} ${row.status}`, '', row.residual]);
      return attachment(csvAttachment(
        [`${report.meta.workspace} income and expense summary`, report.meta.label, `Currency ${report.meta.currency}`,
          'Only cleared records. Loan principal, transfers, owner money, and partner profit shares are not income or expenses.',
          'Informational summary, not audited accounts or tax advice.'],
        ['Section', 'Category', 'Records', `Amount (${report.meta.currency})`], rows,
      ), `profit-summary-${range.from}-to-${range.to}.csv`);
    }

    if (kind === 'stock') {
      const report = await buildStockReport(range, role, workspaceId);
      if (!csv) return NextResponse.json(report, { headers: { 'Cache-Control': 'private, no-store' } });
      const rows = report.items.map((item) => [item.name, item.sku, item.unit, csvNum(item.opening), csvNum(item.received), csvNum(item.issued), csvNum(item.closing), csvNum(item.reorderLevel), item.low ? 'At or below reorder point' : '']);
      return attachment(csvAttachment(
        [`${report.meta.workspace} stock movement`, report.meta.label, report.openingNote,
          'Quantities only. Stock valuation is not included, and purchase spend is reported separately.'],
        ['Item', 'SKU', 'Unit', 'Opening', 'Received', 'Issued', 'Closing', 'Reorder point', 'Note'], rows,
      ), `stock-movement-${range.from}-to-${range.to}.csv`);
    }

    const report = await buildSalaryReport(range, role, workspaceId);
    if (!csv) return NextResponse.json(report, { headers: { 'Cache-Control': 'private, no-store' } });
    const rows = report.rows.map((row) => [row.employee, row.periodStart, row.periodEnd, row.dueDate, csvNum(row.amountDue), csvNum(row.paid), csvNum(row.outstanding), row.status]);
    rows.push(['Total', '', '', '', csvNum(report.totals.due), csvNum(report.totals.paid), csvNum(report.totals.outstanding), '']);
    return attachment(csvAttachment(
      [`${report.meta.workspace} salary periods`, report.meta.label, report.basisNote, 'Payments are recorded as expenses when paid, so they are not added again here.'],
      ['Employee', 'Period start', 'Period end', 'Due date', 'Amount due', 'Paid', 'Outstanding', 'Status'], rows,
    ), `salary-periods-${range.from}-to-${range.to}.csv`);
  } catch (error) {
    console.error('Failed to build report', kind, error);
    return NextResponse.json({ error: 'Could not build this report. Please try again.' }, { status: 500 });
  }
}
