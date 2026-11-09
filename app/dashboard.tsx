'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, Briefcase,
  Check, Eye, EyeOff, HandCoins, Landmark, MoreHorizontal, Plus,
  Search, ShieldCheck, ShoppingBag, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import AppSidebar from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AnimatedAmount from '@/components/animated-amount';
import { toast } from '@/lib/toast';
import { sounds } from '@/lib/sounds';

type TransactionKind = 'Income' | 'Expense' | 'Contribution' | 'Withdrawal' | 'Loan received' | 'Loan given' | 'Loan repayment' | 'Loan collection' | 'Transfer';
type Period = '7 days' | '30 days' | '90 days';
type DashboardData = {
  workspace: { id: number; name: string; businessType: string; currency: string };
  accounts: Array<{ id: number; name: string; type: string; currency: string; openingBalance: number; balance: number }>;
  transactions: Array<{ id: number; title: string; category: string; date: string; amount: number; kind: string; account: string; destinationAccount: string | null; status: string; counterparty: string; note: string }>;
  owners: Array<{ id: number; name: string; role: string; share: number; effectiveAt: string }>;
  loans: Array<{ id: number; direction: string; name: string; counterparty: string; principal: number; outstanding: number; dueAt: string | null; repaidAmount: number; repaymentCount: number; lastRepaymentAt: string | null }>;
  summary: { cashBalance: number; incomeThisMonth: number; expensesThisMonth: number; incomeLastMonth: number; expensesLastMonth: number; outstandingLoans: number; activeLoans: number };
  chart: Array<{ day: string; income: number; expenses: number }>;
};

type ChartPoint = { day: string; income: number; expenses: number };

function formatPKR(value: number) {
  return `₨ ${Math.abs(value).toLocaleString('en-PK')}`;
}

function displayKind(value: string): TransactionKind {
  const labels: Record<string, TransactionKind> = {
    INCOME: 'Income', EXPENSE: 'Expense', CONTRIBUTION: 'Contribution', WITHDRAWAL: 'Withdrawal',
    LOAN_RECEIVED: 'Loan received', LOAN_GIVEN: 'Loan given', LOAN_REPAYMENT_OUT: 'Loan repayment', LOAN_REPAYMENT_IN: 'Loan collection', TRANSFER: 'Transfer',
  };
  return labels[value] ?? 'Expense';
}

function apiKind(value: TransactionKind) {
  return value.toUpperCase().replaceAll(' ', '_');
}

function displayDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-PK', { month: 'short', day: '2-digit', year: 'numeric' });
}

function shortDate(value: string | null) {
  if (!value) return 'No due date';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function KindIcon({ kind }: { kind: TransactionKind }) {
  if (kind === 'Income') return <ArrowDownLeft size={16} />;
  if (kind === 'Expense') return <ShoppingBag size={15} />;
  if (kind === 'Contribution') return <HandCoins size={16} />;
  if (kind === 'Loan collection') return <ArrowDownLeft size={16} />;
  if (kind === 'Withdrawal' || kind === 'Loan given' || kind === 'Loan repayment') return <ArrowUpRight size={16} />;
  return <ArrowLeftRight size={16} />;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label ? new Date(`${label}T12:00:00`).toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}</div>
      {payload.map((item) => <div className="chart-tooltip-value" key={item.name} style={{ color: item.name === 'Income' ? '#c9f24f' : '#e8ede4' }}>{item.name}: ₨ {Number(item.value).toLocaleString('en-PK')}k</div>)}
    </div>
  );
}

function chartLabel(value: string, period: Period) {
  const date = new Date(`${value}T12:00:00`);
  if (period === '7 days') return date.toLocaleDateString('en-PK', { weekday: 'short' });
  return date.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const canEdit = (role: string) => ['OWNER', 'ADMIN', 'BOOKKEEPER'].includes(role);

export default function Dashboard({ userName, userRole }: { userName: string; userRole: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [period, setPeriod] = useState<Period>('30 days');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hideBalance, setHideBalance] = useState(false);
  const [kind, setKind] = useState<TransactionKind>('Expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [accountId, setAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [counterparty, setCounterparty] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const [repaymentLoan, setRepaymentLoan] = useState<DashboardData['loans'][number] | null>(null);
  const [repaymentPrincipal, setRepaymentPrincipal] = useState('');
  const [repaymentFee, setRepaymentFee] = useState('');
  const [repaymentFeeDescription, setRepaymentFeeDescription] = useState('');
  const [repaymentAccount, setRepaymentAccount] = useState('');
  const [repaymentDate, setRepaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [repaymentNote, setRepaymentNote] = useState('');
  const [repaymentError, setRepaymentError] = useState('');
  const [repaymentSaving, setRepaymentSaving] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load business records. Please refresh to try again.');
        return response.json() as Promise<DashboardData>;
      })
      .then((result) => {
        setData(result);
        if (result.accounts[0]) { setAccountId(String(result.accounts[0].id)); setRepaymentAccount(String(result.accounts[0].id)); }
        if (result.accounts[1]) setDestinationAccountId(String(result.accounts[1].id));
      })
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  const filteredTransactions = useMemo(() => (data?.transactions ?? []).filter((item) => `${item.title} ${item.category} ${item.account} ${item.counterparty}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6), [data, query]);
  const periodDays = period === '7 days' ? 7 : period === '30 days' ? 30 : 90;
  const chartData: ChartPoint[] = data?.chart.slice(-periodDays) ?? [];
  const maxIncome = Math.max(0, ...chartData.map((point) => point.income));
  const isOutgoing = kind === 'Expense' || kind === 'Withdrawal' || kind === 'Loan given';

  const openDialog = (preset: TransactionKind) => () => {
    setKind(preset);
    setSaveError('');
    setDialogOpen(true);
  };

  const resetTransactionForm = () => {
    setAmount(''); setDescription(''); setCategory('General'); setCounterparty(''); setDueDate(''); setNote('');
    setTransactionDate(new Date().toISOString().slice(0, 10)); setKind('Expense'); setSaveError('');
  };

  const saveTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    setSaving(true); setSaveError('');
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: apiKind(kind), amount: Number(amount), description, category,
          accountId: Number(accountId), destinationAccountId: kind === 'Transfer' ? Number(destinationAccountId) : null,
          transactionDate, counterparty, dueDate: dueDate || null, note,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not save this transaction.');
      setData(result as DashboardData);
      setDialogOpen(false); resetTransactionForm();
      toast.ledger('Saved to ledger', 'Transaction recorded and posted to your books.');
    } catch (error) {
      sounds.error();
      setSaveError(error instanceof Error ? error.message : 'Could not save this transaction.');
    } finally {
      setSaving(false);
    }
  };

  const openRepayment = (loan: DashboardData['loans'][number]) => {
    setRepaymentLoan(loan); setRepaymentPrincipal(String(loan.outstanding)); setRepaymentFee(''); setRepaymentFeeDescription('');
    setRepaymentDate(new Date().toISOString().slice(0, 10)); setRepaymentNote(''); setRepaymentError(''); setRepaymentOpen(true);
  };

  const recordRepayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!repaymentLoan) return;
    setRepaymentSaving(true); setRepaymentError('');
    try {
      const response = await fetch(`/api/loans/${repaymentLoan.id}/repayments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principalAmount: Number(repaymentPrincipal), feeAmount: repaymentFee === '' ? 0 : Number(repaymentFee), feeDescription: repaymentFeeDescription, accountId: Number(repaymentAccount), transactionDate: repaymentDate, note: repaymentNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not record the loan repayment.');
      setData(result as DashboardData); setRepaymentOpen(false); setRepaymentLoan(null);
      toast.ledger(repaymentLoan.direction === 'PAYABLE' ? 'Repayment recorded' : 'Collection recorded', 'The outstanding balance has been updated.');
    } catch (error) { sounds.error(); setRepaymentError(error instanceof Error ? error.message : 'Could not record the loan repayment.'); }
    finally { setRepaymentSaving(false); }
  };

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="brand-mark" aria-hidden="true" style={{width: 52, height: 52, borderRadius: 17}}><img src="/logo.svg" alt="" width={52} height={52} /></div>
        <strong>{loadError ? 'Your records could not be loaded' : 'Opening your business books…'}</strong>
        <span>{loadError || 'Preparing your workspace'}</span>
        {loadError && <Button variant="outline" className="rounded-full" onClick={() => window.location.reload()}>Try again</Button>}
      </div>
    );
  }

  const incomeChange = percentChange(data.summary.incomeThisMonth, data.summary.incomeLastMonth);
  const expenseChange = percentChange(data.summary.expensesThisMonth, data.summary.expensesLastMonth);
  const netThisMonth = data.summary.incomeThisMonth - data.summary.expensesThisMonth;
  const dateHeading = new Date().toLocaleDateString('en-PK', { weekday: 'long', month: 'long', day: 'numeric' });
  const hidden = (value: number) => (hideBalance ? '₨ ••••••' : formatPKR(value));

  return (
    <div className="app-shell" id="overview">
      <AppSidebar workspaceName={data.workspace.name} businessType={data.workspace.businessType} userName={userName} userRole={userRole} current="overview" loanCount={data.loans.length} />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><strong>Overview</strong></div>
          <div className="top-actions">
            {searchOpen && <Input autoFocus aria-label="Search transactions" placeholder="Search activity…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-44 rounded-full bg-white text-xs sm:w-52" />}
            <Button variant="outline" size="icon" className="rounded-full bg-white" aria-label="Search transactions" onClick={() => { setSearchOpen((open) => !open); setQuery(''); }}><Search size={16} /></Button>
            <Button variant="outline" size="icon" className="relative rounded-full bg-white" aria-label="Notifications" onClick={() => toast.info('You’re all caught up.', 'New ledger activity will appear here.')}><Bell size={16} /></Button>
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />{dateHeading}</span>
              <h1 className="page-title">Good morning, {userName.split(' ')[0] || 'there'} <span aria-hidden="true">✳</span></h1>
              <p className="page-subtitle">Here’s what’s happening with {data.workspace.name} today.</p>
            </div>
            {canEdit(userRole) && <button className="lime-button" onClick={openDialog('Expense')}><Plus size={16} strokeWidth={2.6} /> Add transaction</button>}
          </section>

          {/* Hero balance card */}
          <section className="grid gap-4 xl:grid-cols-12">
            <div className="hero-panel xl:col-span-7" aria-label="Total business balance">
              <div className="hero-top">
                <span className="hero-label"><Landmark size={13} /> Total business balance</span>
                <span className="hero-workspace"><Briefcase size={12} /> {data.workspace.name}</span>
              </div>
              <div className="hero-amount-row">
                <div className="hero-amount"><small>PKR</small><AnimatedAmount value={hideBalance ? 0 : Math.abs(data.summary.cashBalance)} format={(n) => hideBalance ? '••••••' : Math.abs(n).toLocaleString('en-PK')} /></div>
                <button onClick={() => setHideBalance((value) => !value)} aria-label={hideBalance ? 'Show balance' : 'Hide balance'} style={{ background: '#ffffff14', border: '1px solid #ffffff1f', color: '#cfe0c9', borderRadius: 999, width: 40, height: 40, display: 'grid', placeItems: 'center', flex: 0 }}>{hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <div className="hero-meta">Across {data.accounts.length} {data.accounts.length === 1 ? 'account' : 'accounts'} · {data.workspace.businessType || 'Business'} · Cleared records only</div>
              <div className="hero-chips">
                <div className="hero-chip">
                  <div className="hero-chip-label"><ArrowDownLeft size={11} /> Income this month</div>
                  <div className="hero-chip-value"><AnimatedAmount value={data.summary.incomeThisMonth} format={hidden} /></div>
                  <div className="hero-chip-sub">Recorded cleared income</div>
                </div>
                <div className="hero-chip">
                  <div className="hero-chip-label"><ArrowUpRight size={11} /> Spent this month</div>
                  <div className="hero-chip-value"><AnimatedAmount value={data.summary.expensesThisMonth} format={hidden} /></div>
                  <div className="hero-chip-sub">Recorded cleared expenses</div>
                </div>
              </div>
              <div className="hero-foot">
                <div className="account-stack" aria-hidden="true">{data.accounts.slice(0, 4).map((account) => <span key={account.id} className="account-dot">{initials(account.name)}</span>)}</div>
                <div className="hero-foot-note">Your books update themselves — every cleared entry, repayment and transfer rolls up here automatically.</div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="soft-card flex flex-col justify-between gap-4 xl:col-span-5">
              <div className="card-header-row">
                <div><div className="card-title">Quick actions</div><div className="card-subtitle">The two-tap way to keep clean books</div></div>
              </div>
              <div className="quick-actions" role="list">
                {canEdit(userRole) && (
                  <button className="quick-action primary" onClick={openDialog('Expense')} role="listitem"><span className="quick-action-icon"><Plus size={22} strokeWidth={2.4} /></span><span>Add entry</span></button>
                )}
                {canEdit(userRole) && (
                  <button className="quick-action" onClick={openDialog('Income')} role="listitem"><span className="quick-action-icon"><ArrowDownLeft size={20} /></span><span>Income</span></button>
                )}
                {canEdit(userRole) && (
                  <button className="quick-action" onClick={openDialog('Expense')} role="listitem"><span className="quick-action-icon"><ArrowUpRight size={20} /></span><span>Expense</span></button>
                )}
                {canEdit(userRole) && (
                  <button className="quick-action" onClick={openDialog('Loan received')} role="listitem"><span className="quick-action-icon"><HandCoins size={20} /></span><span>Record loan</span></button>
                )}
                {canEdit(userRole) && (
                  <button className="quick-action dark" onClick={openDialog('Transfer')} role="listitem"><span className="quick-action-icon"><ArrowLeftRight size={20} /></span><span>Transfer</span></button>
                )}
                <a className="quick-action" href="/transactions" role="listitem"><span className="quick-action-icon"><Search size={20} /></span><span>Find entry</span></a>
              </div>
              <div className="rounded-2xl bg-[var(--card-soft)] p-4 text-[10px] leading-relaxed text-[var(--muted)]">
                <strong className="mb-1 flex items-center gap-1.5 text-[var(--ink)]"><ShieldCheck size={13} className="text-[var(--positive)]" /> Shared, transparent records</strong>
                Everyone with access sees the same numbers. Share passes are logged; viewers can never edit.
              </div>
            </div>
          </section>

          {/* KPI strip */}
          <section className="stat-grid" style={{ marginTop: 14 }} aria-label="Business summary">
            <div className="stat-card">
              <div className="stat-top"><span className="stat-label">Income this month</span><span className="stat-icon green"><ArrowDownLeft size={16} /></span></div>
              <div className="stat-value"><AnimatedAmount value={data.summary.incomeThisMonth} format={hidden} /></div>
              <div className="stat-foot">{incomeChange === null ? <span>No comparison yet</span> : <><span className={`delta ${incomeChange < 0 ? 'down' : 'up'}`}>{incomeChange < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />} {Math.abs(incomeChange)}%</span><span>vs. last month</span></>}</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span className="stat-label">Expenses this month</span><span className="stat-icon terra"><ArrowUpRight size={16} /></span></div>
              <div className="stat-value"><AnimatedAmount value={data.summary.expensesThisMonth} format={hidden} /></div>
              <div className="stat-foot">{expenseChange === null ? <span>No comparison yet</span> : <><span className={`delta ${expenseChange > 0 ? 'down' : 'up'}`}>{expenseChange > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {Math.abs(expenseChange)}%</span><span>vs. last month</span></>}</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span className="stat-label">Net cash flow</span><span className="stat-icon lime"><ArrowLeftRight size={16} /></span></div>
              <div className="stat-value" style={{ color: netThisMonth >= 0 ? 'var(--positive)' : 'var(--negative)' }}><AnimatedAmount value={netThisMonth} format={(n) => `${n >= 0 ? '+' : '−'}${hideBalance ? '₨ ••••••' : formatPKR(Math.abs(n))}`} /></div>
              <div className="stat-foot"><span>Income minus expenses, this month</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span className="stat-label">Outstanding loans</span><span className="stat-icon slate"><HandCoins size={16} /></span></div>
              <div className="stat-value"><AnimatedAmount value={data.summary.outstandingLoans} format={hidden} /></div>
              <div className="stat-foot"><span>{data.summary.activeLoans} active {data.summary.activeLoans === 1 ? 'obligation' : 'obligations'}</span></div>
            </div>
          </section>

          {/* Chart + accounts */}
          <section className="grid gap-4 xl:grid-cols-12" style={{ marginTop: 14 }}>
            <div className="soft-card chart-panel xl:col-span-7" id="reports">
              <div className="card-header-row">
                <div><div className="card-title">Money in vs money out</div><div className="card-subtitle">Cleared income and expenses · amounts in thousands (₨k)</div></div>
                <Tabs value={period} onValueChange={(value) => setPeriod(value as Period)}>
                  <TabsList className="rounded-full bg-[var(--card-soft)] p-1">
                    {(['7 days', '30 days', '90 days'] as const).map((item) => <TabsTrigger key={item} value={item} className="rounded-full text-[10px] font-bold data-[state=active]:bg-[var(--deep)] data-[state=active]:text-[var(--lime)]">{item.replace(' days', 'D')}</TabsTrigger>)}
                  </TabsList>
                </Tabs>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 0, left: -14, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} strokeDasharray="3 5" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tickMargin={10} interval={period === '7 days' ? 0 : period === '30 days' ? 4 : 14} tickFormatter={(value: string) => chartLabel(value, period)} />
                    <YAxis axisLine={false} tickLine={false} tickMargin={6} />
                    <Tooltip cursor={{ fill: 'rgba(21, 35, 27, 0.05)' }} content={<CustomTooltip />} />
                    <Bar dataKey="expenses" name="Expenses" fill="#dde5da" radius={[5, 5, 5, 5]} maxBarSize={16} />
                    <Bar dataKey="income" name="Income" radius={[5, 5, 5, 5]} maxBarSize={16}>
                      {chartData.map((point, index) => <Cell key={index} fill={point.income >= maxIncome && maxIncome > 0 ? '#c9f24f' : '#b8d8a2'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex items-center gap-4 text-[9px] font-bold text-[var(--muted)]"><span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-[var(--lime)]" />Income</span><span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-[#dde5da]" />Expenses</span></div>
            </div>

            <div className="soft-card accounts-panel xl:col-span-5" id="accounts">
              <div className="card-header-row">
                <div><div className="card-title">Where your money is</div><div className="card-subtitle">Recorded balance across business accounts</div></div>
                <Button variant="ghost" size="icon" className="rounded-full text-[var(--muted)]" aria-label="Account options" onClick={() => toast.info('Account management is being built.', 'We’ll let you know when it lands.')}><MoreHorizontal size={17} /></Button>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--faint)]">Total recorded</div><div className="mt-1 text-[26px] font-extrabold leading-none tracking-[-1px] tabular-nums">{hidden(data.summary.cashBalance)}</div></div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lime-soft)] px-3 py-1.5 text-[9px] font-extrabold text-[#57721f]"><Wallet size={11} /> {data.accounts.length} accounts</span>
              </div>
              <div className="balance-track" aria-hidden="true"><span style={{ width: `${data.summary.cashBalance > 0 ? Math.max(3, Math.min(100, data.accounts.reduce((max, account) => Math.max(max, account.balance), 0) / data.summary.cashBalance * 100)) : 0}%` }} /></div>
              <div>{data.accounts.map((account) => <div className="account-row" key={account.id}><div className="account-left"><span className="account-icon">{account.type === 'BANK' ? <Landmark size={16} /> : <Wallet size={16} />}</span><span><div className="account-name">{account.name}</div><div className="account-kind">{account.type === 'BANK' ? 'Bank account' : account.type === 'MOBILE_WALLET' ? 'Mobile wallet' : 'Cash account'} · {account.currency}</div></span></div><span className="account-value">{hidden(account.balance)}</span></div>)}</div>
              <a className="text-link" style={{ marginTop: 13 }} href="/transactions">Account activity <ArrowRight size={12} /></a>
            </div>
          </section>

          {/* Transactions + ownership */}
          <section className="grid gap-4 xl:grid-cols-12" style={{ marginTop: 14 }}>
            <div className="soft-card transactions-panel xl:col-span-7" id="transactions">
              <div className="card-header-row">
                <div><div className="card-title">Recent transactions</div><div className="card-subtitle">Your latest saved business activity</div></div>
                <div className="flex items-center gap-2">
                  <a className="ghost-pill" href="/transactions">Filter</a>
                  <a className="text-link" href="/transactions">See all <ArrowRight size={12} /></a>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                {filteredTransactions.length ? filteredTransactions.map((item) => {
                  const itemKind = displayKind(item.kind);
                  const negative = ['EXPENSE', 'WITHDRAWAL', 'LOAN_GIVEN', 'LOAN_REPAYMENT_OUT'].includes(item.kind);
                  const neutral = item.kind === 'TRANSFER';
                  return (
                    <div className="txn-row" key={item.id}>
                      <span className={`txn-icon ${neutral ? 'neutral' : negative ? 'expense' : 'income'}`}><KindIcon kind={itemKind} /></span>
                      <span style={{ minWidth: 0 }}>
                        <div className="txn-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div className="txn-sub">{item.category} · {displayDate(item.date)} · {item.kind === 'TRANSFER' ? `${item.account} → ${item.destinationAccount}` : item.account}</div>
                      </span>
                      <span className="txn-amount">
                        <div className={`txn-amount-value ${!neutral && !negative ? 'in' : ''}`}>{neutral ? '' : negative ? '−' : '+'}{hidden(item.amount)}</div>
                        <span className={`txn-status ${item.status.toLowerCase()}`}>{item.status === 'CLEARED' ? 'Cleared' : item.status === 'PENDING' ? 'Pending' : 'Voided'}</span>
                      </span>
                    </div>
                  );
                }) : <div className="empty-state">No matching activity found.</div>}
              </div>
            </div>

            <div className="soft-card owners-panel xl:col-span-5" id="owners">
              <div className="card-header-row">
                <div><div className="card-title">Ownership overview</div><div className="card-subtitle">Recorded shares in {data.workspace.name}</div></div>
                <button className="text-link" onClick={() => toast.info('Ownership history is coming next.', 'Share changes will be attributable here.')}>View details <ArrowRight size={12} /></button>
              </div>
              <div style={{ marginTop: 8 }}>{data.owners.map((owner) => <div className="owner-row" key={owner.id}><div className="owner-avatar">{initials(owner.name)}</div><div className="owner-info"><div className="owner-name">{owner.name}{owner.name.trim().toLowerCase() === userName.trim().toLowerCase() && <span className="ml-1.5 text-[8px] font-bold uppercase tracking-wide text-[var(--faint)]">· You</span>}</div><div className="owner-bar"><span style={{ width: `${Math.min(100, Number(owner.share) || 0)}%` }} /></div></div><div className="owner-share">{Number(owner.share).toLocaleString('en-PK')}%</div></div>)}</div>
              <div className="owner-note"><ShieldCheck size={14} className="mt-0.5 shrink-0" /><span>Shares are recorded as agreed by your team. Contributions and ownership are tracked separately.</span></div>
            </div>
          </section>

          {/* Loans */}
          <section className="soft-card" id="loans" style={{ marginTop: 14 }}>
            <div className="card-header-row">
              <div><div className="card-title">Loans & amounts due</div><div className="card-subtitle">What your business owes — and what it’s owed</div></div>
              {canEdit(userRole) && <button className="ghost-pill" onClick={openDialog('Loan received')}><Plus size={12} /> Record a loan</button>}
            </div>
            {data.loans.length ? <div className="loan-list">{data.loans.map((loan) => <div className="loan-item" key={loan.id}><span className={`loan-icon ${loan.direction === 'RECEIVABLE' ? 'receivable' : ''}`}>{loan.direction === 'RECEIVABLE' ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}</span><span style={{ minWidth: 0 }}><div className="loan-name">{loan.name}</div><div className="loan-due">{loan.direction === 'PAYABLE' ? 'Owed to' : 'Owed by'} {loan.counterparty || 'Unspecified'} · Due {shortDate(loan.dueAt)}</div></span><span className="loan-amount">{hidden(loan.outstanding)}<small>{loan.outstanding === 0 ? 'Settled' : loan.direction === 'PAYABLE' ? 'Payable' : 'Receivable'} · {hidden(loan.repaidAmount)} repaid</small></span>{loan.outstanding > 0 && canEdit(userRole) && <button className={`loan-action ${loan.direction === 'RECEIVABLE' ? 'collect' : ''}`} onClick={() => openRepayment(loan)}>{loan.direction === 'PAYABLE' ? 'Repay' : 'Collect'}</button>}</div>)}</div> : <div className="empty-state">No outstanding loans or dues recorded.</div>}
          </section>
          <p className="footer-note" id="about">Hisaabook keeps your business records clear. For bookkeeping reference only — not legal, tax, or accounting advice.</p>
        </div>
      </main>

      {/* Add transaction dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-[560px] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Add a transaction</DialogTitle>
            <DialogDescription>Keep a clear record of money moving through your business.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveTransaction}>
            <div className="form-grid">
              <div className="form-field full"><Label htmlFor="txn-kind">Transaction type</Label>
                <Select value={kind} onValueChange={(value) => setKind(value as TransactionKind)}>
                  <SelectTrigger id="txn-kind" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Expense">Expense</SelectItem><SelectItem value="Income">Income</SelectItem><SelectItem value="Contribution">Contribution</SelectItem><SelectItem value="Withdrawal">Withdrawal</SelectItem><SelectItem value="Loan received">Loan received</SelectItem><SelectItem value="Loan given">Loan given</SelectItem><SelectItem value="Transfer">Transfer</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="form-field"><Label htmlFor="txn-amount">Amount (PKR)</Label><Input id="txn-amount" type="number" min="1" step="1" required placeholder="e.g. 12,500" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-11 rounded-xl" /><span className="field-hint">Whole PKR amounts for now.</span></div>
              <div className="form-field"><Label htmlFor="txn-date">Date</Label><Input id="txn-date" type="date" required value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="h-11 rounded-xl" /></div>
              <div className="form-field full"><Label htmlFor="txn-description">Description</Label><Input id="txn-description" required maxLength={160} placeholder="What was this transaction for?" value={description} onChange={(event) => setDescription(event.target.value)} className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="txn-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="txn-category" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="General">General</SelectItem><SelectItem value="Sales & services">Sales & services</SelectItem><SelectItem value="Rent & utilities">Rent & utilities</SelectItem><SelectItem value="Tools & software">Tools & software</SelectItem><SelectItem value="Travel & transport">Travel & transport</SelectItem><SelectItem value="Owner funding">Owner funding</SelectItem><SelectItem value="Loan repayment">Loan repayment</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="form-field"><Label htmlFor="txn-account">{isOutgoing ? 'Paid from' : 'Received into'}</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="txn-account" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{data.accounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {kind === 'Transfer' && <div className="form-field full"><Label htmlFor="txn-dest">Transfer to</Label>
                <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
                  <SelectTrigger id="txn-dest" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{data.accounts.filter((account) => String(account.id) !== accountId).map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>}
              {(kind === 'Loan received' || kind === 'Loan given') && <>
                <div className="form-field"><Label htmlFor="txn-counterparty">{kind === 'Loan received' ? 'Lender' : 'Borrower'}</Label><Input id="txn-counterparty" maxLength={120} placeholder="Person or business" value={counterparty} onChange={(event) => setCounterparty(event.target.value)} className="h-11 rounded-xl" /></div>
                <div className="form-field"><Label htmlFor="txn-due">Due date (optional)</Label><Input id="txn-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-11 rounded-xl" /></div>
              </>}
              <div className="form-field full"><Label htmlFor="txn-note">Note</Label><Textarea id="txn-note" maxLength={1000} placeholder="Add a note or reference (optional)" value={note} onChange={(event) => setNote(event.target.value)} className="min-h-[72px] rounded-xl" /></div>
            </div>
            {saveError && <div className="form-error" role="alert">{saveError}</div>}
            <DialogFooter className="mt-5 gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-full px-5" disabled={saving} onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="h-11 rounded-full px-6" disabled={saving}>{saving ? 'Saving…' : <><Check size={15} /> Save transaction</>}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Loan repayment dialog */}
      <Dialog open={repaymentOpen} onOpenChange={setRepaymentOpen}>
        <DialogContent className="max-h-[92vh] max-w-[560px] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">{repaymentLoan?.direction === 'PAYABLE' ? 'Record loan repayment' : 'Record loan collection'}</DialogTitle>
            <DialogDescription>{repaymentLoan ? `${repaymentLoan.name} · ${formatPKR(repaymentLoan.outstanding)} principal remaining. Principal changes the loan balance; any fee is recorded separately.` : 'Record a loan repayment or collection.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={recordRepayment}>
            <div className="form-grid">
              <div className="form-field"><Label htmlFor="repay-principal">Principal amount (PKR)</Label><Input id="repay-principal" type="number" min="1" max={repaymentLoan?.outstanding} step="1" required value={repaymentPrincipal} onChange={(event) => setRepaymentPrincipal(event.target.value)} className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="repay-date">Date</Label><Input id="repay-date" type="date" required value={repaymentDate} onChange={(event) => setRepaymentDate(event.target.value)} className="h-11 rounded-xl" /></div>
              <div className="form-field full"><Label htmlFor="repay-account">{repaymentLoan?.direction === 'PAYABLE' ? 'Paid from' : 'Received into'}</Label>
                <Select value={repaymentAccount} onValueChange={setRepaymentAccount}>
                  <SelectTrigger id="repay-account" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{data.accounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="form-field"><Label htmlFor="repay-fee">Optional interest or fee (PKR)</Label><Input id="repay-fee" type="number" min="0" step="1" value={repaymentFee} onChange={(event) => setRepaymentFee(event.target.value)} placeholder="0" className="h-11 rounded-xl" /><span className="field-hint">Posted separately as {repaymentLoan?.direction === 'RECEIVABLE' ? 'income' : 'expense'}.</span></div>
              <div className="form-field"><Label htmlFor="repay-fee-desc">Fee / interest description</Label><Input id="repay-fee-desc" maxLength={120} required={Number(repaymentFee) > 0} value={repaymentFeeDescription} onChange={(event) => setRepaymentFeeDescription(event.target.value)} placeholder="Required only when amount is entered" className="h-11 rounded-xl" /></div>
              <div className="form-field full"><Label htmlFor="repay-note">Note</Label><Textarea id="repay-note" maxLength={1000} value={repaymentNote} onChange={(event) => setRepaymentNote(event.target.value)} placeholder="Reference or repayment details (optional)" className="min-h-[72px] rounded-xl" /></div>
            </div>
            {repaymentError && <div className="form-error" role="alert">{repaymentError}</div>}
            <DialogFooter className="mt-5 gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-full px-5" disabled={repaymentSaving} onClick={() => setRepaymentOpen(false)}>Cancel</Button>
              <Button type="submit" className="h-11 rounded-full px-6" disabled={repaymentSaving}>{repaymentSaving ? 'Saving…' : <><Check size={15} /> Record {repaymentLoan?.direction === 'PAYABLE' ? 'repayment' : 'collection'}</>}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
