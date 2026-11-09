'use client';

import Link from 'next/link';
import { Sk, SkLines, SkStatus } from '@/components/skeletons';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BASIS_LINES, computeTotals, describeResult, shareOf, topWithOther } from '@/lib/reports/pl';
import { dayLabel, monthLabel, resolveRange, type DateRange, type RangePreset } from '@/lib/reports/period';
import { toast } from '@/lib/toast';

type SummaryReport = {
  meta: { workspace: string; currency: string; label: string; generatedAt: string };
  totals: { income: number; expenses: number; net: number };
  income: Array<{ label: string; amount: number; count: number }>;
  expenses: Array<{ label: string; amount: number; count: number }>;
  accountInflow: Array<{ account: string; amount: number; count: number }>;
  accountOutflow: Array<{ account: string; amount: number; count: number }>;
  ownerFlow: Array<{ label: string; account: string; amount: number; count: number }>;
  loans: { feesReceived: number; feesPaid: number; principalIn: number; principalOut: number; repaymentCount: number };
  status: { pendingCount: number; pendingAmount: number; voidCount: number };
  daily: Array<{ day: string; income: number; expenses: number }>;
  monthly: Array<{ month: string; income: number; expenses: number }>;
  neutral: Array<{ label: string; amount: number; count: number }>;
  excludedCount: number;
};

type ProfitReport = {
  meta: SummaryReport['meta'];
  totals: { totalIncome: number; totalExpenses: number; netProfit: number; feeIncome: number; feeExpense: number; marginPct: number | null };
  income: SummaryReport['income'];
  expenses: SummaryReport['expenses'];
  monthly: SummaryReport['monthly'];
  appropriation: Array<{ id: number; periodFrom: string; periodTo: string; residual: number; status: string }>;
};

type StockReport = {
  meta: SummaryReport['meta'];
  items: Array<{ id: number; name: string; sku: string; unit: string; opening: number; received: number; issued: number; closing: number; reorderLevel: number; low: boolean }>;
  purchasedValue: number;
  purchaseCount: number;
  openingNote: string;
};

type SalaryReport = {
  meta: SummaryReport['meta'];
  rows: Array<{ id: number; employee: string; periodStart: string; periodEnd: string; dueDate: string; amountDue: number; paid: number; outstanding: number; status: string }>;
  totals: { due: number; paid: number; outstanding: number };
  employeeCount: number;
  basisNote: string;
};

type ReportKind = 'summary' | 'profit' | 'stock' | 'salary';

const KIND_TABS: Array<{ value: ReportKind; label: string; blurb: string }> = [
  { value: 'summary', label: 'Income and expenses', blurb: 'What came in, what went out, and what was deliberately left out.' },
  { value: 'profit', label: 'Profit summary', blurb: 'Cleared income minus cleared expenses, with the basis spelled out.' },
  { value: 'stock', label: 'Stock movement', blurb: 'Opening, received, issued, closing, and what was spent on stock.' },
  { value: 'salary', label: 'Salary', blurb: 'Salary due, salary paid, and what stays outstanding per employee period.' },
];

const PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-30-days', label: 'Last 30 days' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'this-year', label: 'This year' },
];

const money = (value: number) => `PKR ${Math.abs(Math.round(value)).toLocaleString('en-PK')}`;
const signed = (value: number) => `${value < 0 ? '−' : ''}PKR ${Math.abs(Math.round(value)).toLocaleString('en-PK')}`;

function defaultRange(): DateRange {
  return resolveRange('this-month', new Date().toISOString().slice(0, 10));
}

export default function ReportsClient({ userName, userRole }: { userName: string; userRole: string }) {
  const canSeeSalary = ['OWNER', 'ADMIN', 'PAYROLL'].includes(userRole);
  const initial = defaultRange();
  const [kind, setKind] = useState<ReportKind>('summary');
  const [preset, setPreset] = useState<RangePreset>('this-month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [payload, setPayload] = useState<SummaryReport | ProfitReport | StockReport | SalaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const query = useMemo(() => {
    const params = new URLSearchParams({ kind, from, to });
    return params.toString();
  }, [kind, from, to]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/api/reports?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not build this report.');
        return result;
      })
      .then(setPayload)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Could not build this report.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, reload]);

  const applyPreset = (value: RangePreset) => {
    setPreset(value);
    if (value === 'custom') return;
    const range = resolveRange(value, new Date().toISOString().slice(0, 10));
    setFrom(range.from);
    setTo(range.to);
  };

  const exportUrl = `/api/reports?${query}&format=csv`;
  const tab = KIND_TABS.find((item) => item.value === kind) ?? KIND_TABS[0];

  return (
    <div className="app-shell">
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><Link href="/#overview" style={{ color: 'inherit', textDecoration: 'none' }}>Workspace</Link><span aria-hidden="true">›</span><strong>Reports</strong></div>
          <div className="top-actions"><Link className="ghost-pill" href="/#overview"><ArrowLeft size={13} /> Overview</Link><span className="topbar-notif-slot" /></div>
        </header>
        <div className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />Money, explained</span>
              <h1 className="page-title">Reports</h1>
              <p className="page-subtitle">{tab.blurb}</p>
            </div>
            <a className="lime-button" href={exportUrl} style={{ textDecoration: 'none' }} download><Download size={15} /> Export CSV</a>
          </section>

          <section className="soft-card" aria-label="Report range">
            <div className="card-header-row">
              <div><div className="card-title">Range and report</div><div className="card-subtitle">Every report states its own range and counting rules. Nothing is implied.</div></div>
              <span className="ledger-page-count">{payload ? `Built ${new Date(payload.meta.generatedAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
            </div>
            <Tabs value={kind} onValueChange={(value) => setKind(value as ReportKind)}>
              <TabsList className="rounded-full bg-[var(--card-soft)] p-1" aria-label="Report type">
                {KIND_TABS.filter((item) => item.value !== 'salary' || canSeeSalary).map((item) => (
                  <TabsTrigger key={item.value} value={item.value} className="rounded-full text-[10px] font-bold data-[state=active]:bg-[var(--deep)] data-[state=active]:text-[var(--lime)]">{item.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="report-range-row">
              <div className="form-field report-preset"><Label htmlFor="report-preset" className="form-label">Quick range</Label>
                <Select value={preset} onValueChange={(value) => applyPreset(value as RangePreset)}>
                  <SelectTrigger id="report-preset" className="h-11 rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRESETS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}<SelectItem value="custom">Custom</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="form-field"><Label htmlFor="report-from" className="form-label">From</Label><Input id="report-from" type="date" value={from} max={to} onChange={(event) => { setFrom(event.target.value); setPreset('custom'); }} className="h-11 rounded-full" /></div>
              <div className="form-field"><Label htmlFor="report-to" className="form-label">To</Label><Input id="report-to" type="date" value={to} min={from} onChange={(event) => { setTo(event.target.value); setPreset('custom'); }} className="h-11 rounded-full" /></div>
              <Button variant="outline" className="rounded-full" onClick={() => setReload((value) => value + 1)} disabled={loading} aria-label="Refresh report"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></Button>
            </div>
            {payload ? <p className="field-hint" style={{ marginTop: 10 }}>{payload.meta.workspace} · {payload.meta.label} · {payload.meta.currency}</p> : null}
          </section>

          {error ? <div className="soft-card" role="alert" style={{ marginTop: 14 }}><div className="card-title">This report could not be built</div><p className="card-subtitle">{error}</p><Button variant="outline" className="rounded-full" style={{ marginTop: 10 }} onClick={() => setReload((value) => value + 1)}>Try again</Button></div> : null}
          {loading && !payload ? (
            <>
              <SkStatus label="Building the report" />
              <div style={{ marginTop: 14, display: 'grid', gap: 14 }} aria-hidden="true">
                <div className="sk-kpi">
                  {[0, 1, 2, 3].map((index) => (
                    <div key={index} className="sk-card" style={{ gap: 11 }}>
                      <Sk w={index % 2 ? 88 : 112} h={9} />
                      <Sk w={`${56 - (index % 3) * 7}%`} h={21} radius={7} />
                    </div>
                  ))}
                </div>
                <div className="soft-card" style={{ display: 'grid', gap: 14 }}>
                  <Sk w={180} h={11} />
                  <Sk h={132} radius={14} />
                </div>
                <div className="soft-card" style={{ display: 'grid', gap: 13 }}>
                  <Sk w={150} h={11} />
                  {[0, 1, 2, 3, 4].map((index) => (
                    <div key={index} className="sk-split">
                      <Sk w={`${52 - index * 4}%`} h={9} />
                      <Sk w={64} h={9} />
                    </div>
                  ))}
                  <SkLines count={2} gap={7} />
                </div>
              </div>
            </>
          ) : null}

          <div className="report-body">
            {payload && kind === 'summary' ? <SummaryView report={payload as SummaryReport} /> : null}
            {payload && kind === 'profit' ? <ProfitView report={payload as ProfitReport} /> : null}
            {payload && kind === 'stock' ? <StockView report={payload as StockReport} /> : null}
            {payload && kind === 'salary' ? <SalaryView report={payload as SalaryReport} /> : null}
          </div>

          <p className="footer-note"><FileText size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />Reports use only this workspace. They are informational and are not audited accounts, tax advice, or a legal record of ownership.</p>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, foot, tone }: { label: string; value: string; foot: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="stat-card">
      <div className="stat-top"><span className="stat-label">{label}</span></div>
      <div className="stat-value" style={tone === 'good' ? { color: 'var(--positive)' } : tone === 'bad' ? { color: 'var(--negative)' } : undefined}>{value}</div>
      <div className="stat-foot"><span>{foot}</span></div>
    </div>
  );
}

function CategoryTable({ title, subtitle, rows, total, totalLabel }: { title: string; subtitle: string; rows: Array<{ label: string; amount: number; count: number }>; total: number; totalLabel: string }) {
  const visible = topWithOther(rows.map((row) => ({ ...row, key: row.label })), 8);
  return (
    <section className="soft-card" aria-label={title}>
      <div className="card-header-row"><div><div className="card-title">{title}</div><div className="card-subtitle">{subtitle}</div></div></div>
      <div className="data-table-wrap report-table-wrap">
        <table className="data-table">
          <thead><tr><th>Category</th><th>Records</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Share</th></tr></thead>
          <tbody>
            {visible.length === 0 ? <tr><td colSpan={4} className="ledger-message">Nothing recorded in this range.</td></tr> : visible.map((row) => {
              const share = shareOf({ key: row.key, label: row.label, amount: row.amount, count: row.count }, visible);
              return (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td className="table-muted">{row.count}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.amount)}</td>
                  <td className="table-muted" style={{ textAlign: 'right' }}>{share === null ? '-' : `${share}%`}</td>
                </tr>
              );
            })}
            <tr><td><strong>{totalLabel}</strong></td><td /><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong>{money(total)}</strong></td><td /></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryView({ report }: { report: SummaryReport }) {
  return (
    <>
      <section className="stat-grid" style={{ marginTop: 14 }} aria-label="Report totals">
        <Stat label="Cleared income" value={money(report.totals.income)} foot={`${report.income.reduce((count, row) => count + row.count, 0)} cleared records`} tone="good" />
        <Stat label="Cleared expenses" value={money(report.totals.expenses)} foot={`${report.expenses.reduce((count, row) => count + row.count, 0)} cleared records`} tone="bad" />
        <Stat label="Income minus expenses" value={signed(report.totals.net)} foot="Cash-basis difference, not audited profit" />
        <Stat label="Left out on purpose" value={String(report.excludedCount)} foot="Transfers, owner money, loan principal, pending and voided rows" />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" style={{ marginTop: 14 }}>
        <CategoryTable title="Where income came from" subtitle="Cleared income grouped by category" rows={report.income} total={report.totals.income} totalLabel="Total income" />
        <CategoryTable title="Where money went" subtitle="Cleared expenses grouped by category" rows={report.expenses} total={report.totals.expenses} totalLabel="Total expenses" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" style={{ marginTop: 14 }}>
        <section className="soft-card" aria-label="Cash movement by account">
          <div className="card-header-row"><div><div className="card-title">Cash movement by account</div><div className="card-subtitle">Cleared money actually received and paid, per account. Internal transfers are excluded here.</div></div></div>
          <div className="data-table-wrap report-table-wrap">
            <table className="data-table">
              <thead><tr><th>Account</th><th style={{ textAlign: 'right' }}>In</th><th style={{ textAlign: 'right' }}>Out</th></tr></thead>
              <tbody>
                {report.accountInflow.length === 0 && report.accountOutflow.length === 0 ? <tr><td colSpan={3} className="ledger-message">No cleared cash movement in this range.</td></tr> : [...new Set([...report.accountInflow.map((row) => row.account), ...report.accountOutflow.map((row) => row.account)])].map((account) => {
                  const inflow = report.accountInflow.find((row) => row.account === account)?.amount ?? 0;
                  const outflow = report.accountOutflow.find((row) => row.account === account)?.amount ?? 0;
                  return <tr key={account}><td>{account}</td><td className="amount-positive" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{inflow ? `+${money(inflow)}` : '-'}</td><td className="amount-negative" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{outflow ? `−${money(outflow)}` : '-'}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="soft-card" aria-label="Kept out of income and expenses">
          <div className="card-header-row"><div><div className="card-title">Kept out of income and expenses</div><div className="card-subtitle">These moved money or changed balances but are not revenue or costs.</div></div></div>
          <div className="data-table-wrap report-table-wrap">
            <table className="data-table">
              <thead><tr><th>What</th><th>Records</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {report.neutral.length === 0 ? <tr><td colSpan={3} className="ledger-message">Nothing was excluded in this range.</td></tr> : report.neutral.map((row) => (
                  <tr key={row.label}><td>{row.label}</td><td className="table-muted">{row.count}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field-hint" style={{ marginTop: 10 }}>
            {report.loans.repaymentCount > 0
              ? `${report.loans.repaymentCount} loan ${report.loans.repaymentCount === 1 ? 'repayment' : 'repayments'}, of which ${money(report.loans.principalIn + report.loans.principalOut)} was principal and ${money(report.loans.feesReceived + report.loans.feesPaid)} was fees.`
              : 'No loan repayments in this range.'}
          </p>
        </section>
      </div>

      <section className="soft-card" style={{ marginTop: 14 }} aria-label="Owner money and transfers">
        <div className="card-header-row"><div><div className="card-title">Owner money and transfers</div><div className="card-subtitle">Shown for completeness, never mixed into income or expenses.</div></div></div>
        <div className="data-table-wrap report-table-wrap">
          <table className="data-table">
            <thead><tr><th>What</th><th>Account</th><th>Records</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {report.ownerFlow.length === 0 ? <tr><td colSpan={4} className="ledger-message">No owner contributions, withdrawals, or transfers in this range.</td></tr> : report.ownerFlow.map((row) => (
                <tr key={`${row.label}-${row.account}`}><td>{row.label}</td><td className="table-muted">{row.account}</td><td className="table-muted">{row.count}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.status.pendingCount > 0 ? <p className="field-hint" style={{ marginTop: 10 }}>{report.status.pendingCount} pending {report.status.pendingCount === 1 ? 'record' : 'records'} worth {money(report.status.pendingAmount)} are not counted until they are cleared.</p> : null}
      </section>

      <section className="soft-card" style={{ marginTop: 14 }} aria-label="How this report counts">
        <div className="card-title">How this report counts</div>
        <ul className="card-subtitle report-notes">{BASIS_LINES.map((line) => <li key={line}>{line}</li>)}</ul>
      </section>
    </>
  );
}

function ProfitView({ report }: { report: ProfitReport }) {
  const asCategory = (rows: SummaryReport['income']) => rows.map((row) => ({ ...row, key: row.label }));
  const totals = computeTotals({ income: asCategory(report.income), expenses: asCategory(report.expenses), feesReceived: report.totals.feeIncome, feesPaid: report.totals.feeExpense });
  return (
    <>
      <section className="stat-grid" style={{ marginTop: 14 }} aria-label="Profit totals">
        <Stat label="Cleared income" value={money(totals.totalIncome)} foot={totals.feeIncome > 0 ? `Includes ${money(totals.feeIncome)} loan fees received` : 'Income plus any loan fees received'} tone="good" />
        <Stat label="Cleared expenses" value={money(totals.totalExpenses)} foot={totals.feeExpense > 0 ? `Includes ${money(totals.feeExpense)} loan repayment fees` : 'Expenses plus any loan fees paid'} tone="bad" />
        <Stat label="Income minus expenses" value={signed(totals.netProfit)} foot={describeResult(totals)} tone={totals.netProfit >= 0 ? 'good' : 'bad'} />
        <Stat label="Margin" value={totals.marginPct === null ? '-' : `${totals.marginPct}%`} foot="Income minus expenses as a share of income" />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" style={{ marginTop: 14 }}>
        <CategoryTable title="Income" subtitle="Cleared income by category" rows={report.income} total={totals.income} totalLabel="Total income" />
        <CategoryTable title="Expenses" subtitle="Cleared expenses by category" rows={report.expenses} total={totals.expenses} totalLabel="Total expenses" />
      </div>

      <section className="soft-card" style={{ marginTop: 14 }} aria-label="Profit by month">
        <div className="card-header-row"><div><div className="card-title">Month by month</div><div className="card-subtitle">Cleared income and expenses per month inside the range.</div></div></div>
        <div className="data-table-wrap report-table-wrap">
          <table className="data-table">
            <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Income</th><th style={{ textAlign: 'right' }}>Expenses</th><th style={{ textAlign: 'right' }}>Difference</th></tr></thead>
            <tbody>
              {report.monthly.length === 0 ? <tr><td colSpan={4} className="ledger-message">Nothing cleared in this range.</td></tr> : report.monthly.map((row) => (
                <tr key={row.month}><td>{monthLabel(row.month)}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.income)}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.expenses)}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className={row.income - row.expenses < 0 ? 'amount-negative' : 'amount-positive'}>{signed(row.income - row.expenses)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {report.appropriation.length > 0 ? (
        <section className="soft-card" style={{ marginTop: 14 }} aria-label="Partner appropriations">
          <div className="card-header-row"><div><div className="card-title">Partner profit shares</div><div className="card-subtitle">An appropriation of profit, not an expense. Listed here so the numbers are visible, never subtracted above.</div></div></div>
          <div className="data-table-wrap report-table-wrap">
            <table className="data-table">
              <thead><tr><th>Distribution</th><th>Period</th><th>Status</th><th style={{ textAlign: 'right' }}>Residual shared</th></tr></thead>
              <tbody>{report.appropriation.map((row) => (
                <tr key={row.id}><td>#{row.id}</td><td className="table-muted">{dayLabel(row.periodFrom)} to {dayLabel(row.periodTo)}</td><td><span className={row.status === 'POSTED' ? 'pill good' : 'pill neutral'}>{row.status === 'POSTED' ? 'Posted' : 'Void'}</span></td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.residual)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="soft-card" style={{ marginTop: 14 }} aria-label="How this report counts">
        <div className="card-title">How this report counts</div>
        <ul className="card-subtitle report-notes">{BASIS_LINES.map((line) => <li key={line}>{line}</li>)}</ul>
      </section>
    </>
  );
}

function StockView({ report }: { report: StockReport }) {
  const low = report.items.filter((item) => item.low);
  return (
    <>
      <section className="stat-grid" style={{ marginTop: 14 }} aria-label="Stock totals">
        <Stat label="Items tracked" value={String(report.items.length)} foot="Active items with a movement history" />
        <Stat label="Stock purchased" value={money(report.purchasedValue)} foot={`${report.purchaseCount} purchase ${report.purchaseCount === 1 ? 'record' : 'records'} linked to stock`} tone="bad" />
        <Stat label="At or below reorder point" value={String(low.length)} foot={low.length ? low.map((item) => item.name).slice(0, 3).join(', ') : 'Nothing needs restocking by your thresholds'} tone={low.length ? 'bad' : 'good'} />
        <Stat label="Units received" value={String(report.items.reduce((total, item) => total + item.received, 0))} foot="Across all items in this range" />
      </section>

      <section className="soft-card" style={{ marginTop: 14 }} aria-label="Stock movement">
        <div className="card-header-row"><div><div className="card-title">Opening, movement, closing</div><div className="card-subtitle">{report.openingNote}</div></div></div>
        <div className="data-table-wrap report-table-wrap">
          <table className="data-table">
            <thead><tr><th>Item</th><th>Unit</th><th style={{ textAlign: 'right' }}>Opening</th><th style={{ textAlign: 'right' }}>Received</th><th style={{ textAlign: 'right' }}>Issued</th><th style={{ textAlign: 'right' }}>Closing</th><th>Reorder</th></tr></thead>
            <tbody>
              {report.items.length === 0 ? <tr><td colSpan={7} className="ledger-message">No inventory items yet. Add stock from the Inventory page.</td></tr> : report.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}{item.sku ? <div className="ledger-secondary">{item.sku}</div> : null}</td>
                  <td className="table-muted">{item.unit}</td>
                  <td style={{ textAlign: 'right' }}>{item.opening}</td>
                  <td style={{ textAlign: 'right' }}>{item.received}</td>
                  <td style={{ textAlign: 'right' }}>{item.issued}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.closing}</td>
                  <td>{item.low ? <span className="pill warn">Reorder</span> : <span className="table-muted">{item.reorderLevel || '-'}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint" style={{ marginTop: 10 }}>Quantities only. Stock is not valued here because a valuation method has to be chosen and reviewed first. The purchase figure above is the cash actually paid in this range.</p>
      </section>
    </>
  );
}

function SalaryView({ report }: { report: SalaryReport }) {
  return (
    <>
      <section className="stat-grid" style={{ marginTop: 14 }} aria-label="Salary totals">
        <Stat label="Salary due" value={money(report.totals.due)} foot={`${report.rows.length} salary ${report.rows.length === 1 ? 'period' : 'periods'} in range`} />
        <Stat label="Salary paid" value={money(report.totals.paid)} foot="Recorded payments against those periods" tone="good" />
        <Stat label="Still outstanding" value={money(report.totals.outstanding)} foot="Due minus paid, per period" tone={report.totals.outstanding > 0 ? 'bad' : 'good'} />
        <Stat label="Employees" value={String(report.employeeCount)} foot="Active employees in this workspace" />
      </section>

      <section className="soft-card" style={{ marginTop: 14 }} aria-label="Salary periods">
        <div className="card-header-row"><div><div className="card-title">Salary periods</div><div className="card-subtitle">{report.basisNote}</div></div></div>
        <div className="data-table-wrap report-table-wrap">
          <table className="data-table">
            <thead><tr><th>Employee</th><th>Period</th><th>Due date</th><th style={{ textAlign: 'right' }}>Due</th><th style={{ textAlign: 'right' }}>Paid</th><th style={{ textAlign: 'right' }}>Outstanding</th><th>Status</th></tr></thead>
            <tbody>
              {report.rows.length === 0 ? <tr><td colSpan={7} className="ledger-message">No salary periods start in this range. Try a wider range.</td></tr> : report.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.employee}</td>
                  <td className="table-muted" style={{ whiteSpace: 'nowrap' }}>{dayLabel(row.periodStart)} to {dayLabel(row.periodEnd)}</td>
                  <td className="table-muted" style={{ whiteSpace: 'nowrap' }}>{dayLabel(row.dueDate)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.amountDue)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.paid)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.outstanding)}</td>
                  <td><span className={row.outstanding <= 0 ? 'pill good' : row.paid > 0 ? 'pill warn' : 'pill neutral'}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint" style={{ marginTop: 10 }}>Salary payments are recorded as expenses when paid, so this report reports the obligation beside the payment and never adds it to expenses twice. It does not calculate tax or any statutory deduction.</p>
      </section>
    </>
  );
}
