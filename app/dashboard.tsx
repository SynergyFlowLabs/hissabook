'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import AppSidebar from '@/components/app-sidebar';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell,
  Check, FileText, Filter, HandCoins, Landmark, Menu, MoreHorizontal, Plus,
  Search, ShieldCheck, ShoppingBag, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

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
  if (kind === 'Income') return <ArrowDownLeft size={14} />;
  if (kind === 'Expense') return <ShoppingBag size={13} />;
  if (kind === 'Contribution') return <HandCoins size={14} />;
  if (kind === 'Loan collection') return <ArrowDownLeft size={14} />;
  if (kind === 'Withdrawal' || kind === 'Loan given' || kind === 'Loan repayment') return <ArrowUpRight size={14} />;
  return <ArrowLeftRight size={14} />;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><div className="chart-tooltip-label">{label}</div>{payload.map((item) => <div className="chart-tooltip-value" key={item.name} style={{ color: item.color }}>{item.name}: ₨ {item.value}k</div>)}</div>;
}

function chartLabel(value: string, period: Period) {
  const date = new Date(`${value}T12:00:00`);
  if (period === '7 days') return date.toLocaleDateString('en-PK', { weekday: 'short' });
  if (period === '30 days') return date.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
  return date.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export default function Dashboard({ userName, userRole }: { userName: string; userRole: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [period, setPeriod] = useState<Period>('30 days');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
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

  const filteredTransactions = useMemo(() => (data?.transactions ?? []).filter((item) => `${item.title} ${item.category} ${item.account} ${item.counterparty}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5), [data, query]);
  const periodDays = period === '7 days' ? 7 : period === '30 days' ? 30 : 90;
  const chartData: ChartPoint[] = data?.chart.slice(-periodDays) ?? [];
  const isOutgoing = kind === 'Expense' || kind === 'Withdrawal' || kind === 'Loan given';

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
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
      showToast('Transaction saved to your business ledger.');
    } catch (error) {
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
      showToast(repaymentLoan.direction === 'PAYABLE' ? 'Loan repayment recorded.' : 'Loan collection recorded.');
    } catch (error) { setRepaymentError(error instanceof Error ? error.message : 'Could not record the loan repayment.'); }
    finally { setRepaymentSaving(false); }
  };

  if (!data) return <div className="loading-screen"><div className="brand-mark" aria-hidden="true">H</div><strong>{loadError ? 'Your records could not be loaded' : 'Opening your business books…'}</strong><span>{loadError || 'Preparing your workspace'}</span>{loadError && <button className="subtle-button" onClick={() => window.location.reload()}>Try again</button>}</div>;

  const incomeChange = percentChange(data.summary.incomeThisMonth, data.summary.incomeLastMonth);
  const expenseChange = percentChange(data.summary.expensesThisMonth, data.summary.expensesLastMonth);
  const dateHeading = new Date().toLocaleDateString('en-PK', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="app-shell" id="overview">
      <AppSidebar workspaceName={data.workspace.name} businessType={data.workspace.businessType} userName={userName} userRole={userRole} current="overview" loanCount={data.loans.length} />
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu" onClick={() => showToast('Use the navigation links to explore your workspace.')}><Menu size={17} /></button>
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Overview</strong></div>
          <div className="top-actions">
            {searchOpen && <input aria-label="Search transactions" autoFocus className="form-control" style={{ width: 175, height: 34 }} placeholder="Search activity…" value={query} onChange={(event) => setQuery(event.target.value)} />}
            <button className="icon-button" aria-label="Search transactions" onClick={() => { setSearchOpen((open) => !open); setQuery(''); }}><Search size={16} /></button>
            <button className="icon-button" aria-label="Notifications" onClick={() => showToast('You’re all caught up.')}><Bell size={16} /><span className="notification-dot" /></button>
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div><div className="eyebrow">{dateHeading}</div><h1 className="page-title">Good morning, {userName.split(' ')[0] || 'there'} <span aria-hidden="true">✳</span></h1><div className="page-subtitle">Here’s what’s happening with your business today.</div></div>
            {['OWNER', 'ADMIN', 'BOOKKEEPER'].includes(userRole) && <button className="primary-button" onClick={() => { setSaveError(''); setDialogOpen(true); }}><Plus size={15} strokeWidth={2.5} /> Add transaction</button>}
          </section>

          <section className="stats-grid" aria-label="Business summary">
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Total cash balance</span><span className="stat-icon" style={{ background: '#eaf4ee', color: '#247451' }}><Wallet size={15} /></span></div><div className="stat-value">{formatPKR(data.summary.cashBalance)}</div><div className="stat-foot"><span>Across {data.accounts.length} business accounts</span></div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Income this month</span><span className="stat-icon" style={{ background: '#eef4fb', color: '#597fa6' }}><ArrowDownLeft size={15} /></span></div><div className="stat-value">{formatPKR(data.summary.incomeThisMonth)}</div><div className="stat-foot">{incomeChange === null ? <span>No comparison yet</span> : <><span className={`stat-change ${incomeChange < 0 ? 'down' : ''}`}><TrendingUp size={11} /> {Math.abs(incomeChange)}%</span><span>vs. last month</span></>}</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Expenses this month</span><span className="stat-icon" style={{ background: '#fbf0e9', color: '#ba7954' }}><ArrowUpRight size={15} /></span></div><div className="stat-value">{formatPKR(data.summary.expensesThisMonth)}</div><div className="stat-foot">{expenseChange === null ? <span>No comparison yet</span> : <><span className={`stat-change ${expenseChange > 0 ? 'down' : ''}`}><TrendingDown size={11} /> {Math.abs(expenseChange)}%</span><span>vs. last month</span></>}</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Outstanding loans</span><span className="stat-icon" style={{ background: '#f3eff9', color: '#8266a3' }}><HandCoins size={15} /></span></div><div className="stat-value">{formatPKR(data.summary.outstandingLoans)}</div><div className="stat-foot"><span>{data.summary.activeLoans} active obligations</span></div></div>
          </section>

          <section className="dashboard-grid">
            <div className="panel" id="reports">
              <div className="panel-header"><div><div className="panel-title">Income & expenses</div><div className="panel-subtitle">Recorded income and expense activity</div></div><div className="period-select" role="tablist" aria-label="Chart period">{(['7 days', '30 days', '90 days'] as const).map((item) => <button key={item} role="tab" aria-selected={period === item} className={`period-button ${period === item ? 'selected' : ''}`} onClick={() => setPeriod(item)}>{item}</button>)}</div></div>
              <div className="chart-legend"><span className="legend-item"><i className="legend-dot" style={{ background: '#267b58' }} />Income</span><span className="legend-item"><i className="legend-dot" style={{ background: '#c6d9bd' }} />Expenses</span><span style={{ marginLeft: 'auto' }}>Amounts in thousands</span></div>
              <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 9, left: -13, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tickMargin={10} interval={period === '7 days' ? 0 : period === '30 days' ? 5 : 14} tickFormatter={(value: string) => chartLabel(value, period)} /><YAxis axisLine={false} tickLine={false} tickMargin={8} tickFormatter={(value) => `${value}`} /><Tooltip content={<CustomTooltip />} /><Line type="monotone" dataKey="income" name="Income" stroke="#267b58" strokeWidth={2.4} dot={false} activeDot={{ r: 4, fill: '#267b58', stroke: '#fff', strokeWidth: 2 }} /><Line type="monotone" dataKey="expenses" name="Expenses" stroke="#b9cfae" strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: '#b9cfae', stroke: '#fff', strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div>
            </div>
            <div className="panel cash-panel" id="accounts">
              <div className="panel-header"><div><div className="panel-title">Where your money is</div><div className="panel-subtitle">Recorded balance across accounts</div></div><button className="icon-button" aria-label="Account options" style={{ width: 29, height: 29 }} onClick={() => showToast('Account settings will be available soon.')}><MoreHorizontal size={16} /></button></div>
              <div className="cash-main"><div><div className="cash-amount">{formatPKR(data.summary.cashBalance)}</div><div className="cash-period">Total recorded balance</div></div><span className="cash-trend"><Wallet size={11} /> {data.accounts.length} accounts</span></div>
              <div className="balance-progress"><span style={{ width: `${data.summary.cashBalance > 0 ? Math.max(3, Math.min(100, data.accounts.reduce((max, account) => Math.max(max, account.balance), 0) / data.summary.cashBalance * 100)) : 0}%` }} /></div>
              {data.accounts.map((account) => <div className="account-row" key={account.id}><div className="account-left"><span className="account-icon">{account.type === 'BANK' ? <Landmark size={14} /> : <Wallet size={14} />}</span><span><div className="account-name">{account.name}</div><div className="account-kind">{account.type === 'BANK' ? 'Bank account' : 'Cash account'} · {account.currency}</div></span></div><span className="account-value">{formatPKR(account.balance)}</span></div>)}
              <button className="link-button" style={{ marginTop: 12 }} onClick={() => showToast('Account management is being built.')}>Account activity <ArrowRight size={11} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></button>
            </div>
          </section>

          <section className="lower-grid">
            <div className="panel" id="transactions">
              <div className="panel-header"><div><div className="panel-title">Recent transactions</div><div className="panel-subtitle">Your latest saved business activity</div></div><div className="table-actions"><button className="subtle-button" onClick={() => showToast('Transaction filtering is coming next.')}><Filter size={12} /> Filter</button><button className="link-button" onClick={() => showToast('The full transaction ledger is coming next.')}>See all <ArrowRight size={11} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></button></div></div>
              <div style={{ overflowX: 'auto' }}><table className="transaction-table"><thead><tr><th>Transaction</th><th>Date</th><th>Account</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead><tbody>{filteredTransactions.length ? filteredTransactions.map((item) => { const itemKind = displayKind(item.kind); const negative = ['EXPENSE', 'WITHDRAWAL', 'LOAN_GIVEN', 'LOAN_REPAYMENT_OUT'].includes(item.kind); const neutral = item.kind === 'TRANSFER'; return <tr key={item.id}><td><div className="transaction-title"><span className="transaction-icon" style={{ background: negative ? '#fbf1eb' : '#edf6ef', color: negative ? '#ba7954' : '#39825a' }}><KindIcon kind={itemKind} /></span><span><div className="transaction-name">{item.title}</div><div className="transaction-category">{item.category} · {itemKind}</div></span></div></td><td className="table-muted">{displayDate(item.date)}</td><td className="table-muted">{item.kind === 'TRANSFER' ? `${item.account} → ${item.destinationAccount}` : item.account}</td><td><span className={`status-pill ${item.status.toLowerCase()}`}><i className="legend-dot" style={{ width: 5, height: 5, background: 'currentColor' }} />{item.status === 'CLEARED' ? 'Cleared' : item.status === 'PENDING' ? 'Pending' : 'Voided'}</span></td><td className={neutral ? 'table-muted' : negative ? 'amount-negative' : 'amount-positive'} style={{ textAlign: 'right' }}>{neutral ? '' : negative ? '−' : '+'}{formatPKR(item.amount)}</td></tr>; }) : <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8b958e', padding: 24 }}>No matching activity found.</td></tr>}</tbody></table></div>
            </div>
            <div className="panel" id="owners">
              <div className="panel-header"><div><div className="panel-title">Ownership overview</div><div className="panel-subtitle">Recorded shares in {data.workspace.name}</div></div><button className="link-button" onClick={() => showToast('Ownership history and edits are coming next.')}>View details <ArrowRight size={11} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></button></div>
              <div className="owner-list">{data.owners.map((owner) => <div className="owner-row" key={owner.id}><div className="owner-avatar" style={{ background: '#e9f1e8' }}>{initials(owner.name)}</div><div className="owner-info"><div className="owner-name">{owner.name}{owner.name.trim().toLowerCase() === userName.trim().toLowerCase() && <span style={{ color: '#a0aaa2', fontSize: 8, fontWeight: 500 }}> · You</span>}</div><div className="owner-bar"><span style={{ width: `${owner.share}%` }} /></div></div><div className="owner-share">{Number(owner.share).toLocaleString('en-PK')}%</div></div>)}</div>
              <div className="owner-note"><ShieldCheck size={13} /><span>Shares are recorded as agreed by your team. Contributions and ownership are tracked separately.</span></div>
            </div>
          </section>

          <section className="panel loans-panel" id="loans">
            <div className="panel-header"><div><div className="panel-title">Loans & amounts due</div><div className="panel-subtitle">Keep track of what’s owed to and by your business</div></div>{['OWNER', 'ADMIN', 'BOOKKEEPER'].includes(userRole) && <button className="subtle-button" onClick={() => { setKind('Loan received'); setSaveError(''); setDialogOpen(true); }}><Plus size={12} /> Record a loan</button>}</div>
            {data.loans.length ? <div className="loan-list">{data.loans.map((loan) => <div className="loan-item" key={loan.id}><span className="loan-icon" style={loan.direction === 'RECEIVABLE' ? { background: '#edf5ee', color: '#4e8a61' } : undefined}>{loan.direction === 'RECEIVABLE' ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}</span><span><div className="loan-name">{loan.name}</div><div className="loan-due">{loan.direction === 'PAYABLE' ? 'Owed to' : 'Owed by'} {loan.counterparty || 'Unspecified'} · Due {shortDate(loan.dueAt)}</div></span><span className="loan-amount">{formatPKR(loan.outstanding)}<small>{loan.outstanding === 0 ? 'Settled' : loan.direction === 'PAYABLE' ? 'Payable' : 'Receivable'}</small><small>{formatPKR(loan.repaidAmount)} principal repaid</small></span>{loan.outstanding > 0 && ['OWNER', 'ADMIN', 'BOOKKEEPER'].includes(userRole) && <button className="loan-repay-button" onClick={() => openRepayment(loan)}>{loan.direction === 'PAYABLE' ? 'Repay' : 'Collect'}</button>}</div>)}</div> : <div className="empty-state">No outstanding loans or dues recorded.</div>}
          </section>
          <div className="footer-note" id="about">Hisaabook keeps your business records clear. For bookkeeping reference only — not legal, tax, or accounting advice.</div>
        </div>
      </main>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-card"><div className="dialog-header"><div><Dialog.Title className="dialog-title">Add a transaction</Dialog.Title><Dialog.Description className="dialog-description">Keep a clear record of money moving through your business.</Dialog.Description></div><Dialog.Close asChild><button className="close-button" aria-label="Close dialog"><X size={15} /></button></Dialog.Close></div>
        <form onSubmit={saveTransaction}><div className="form-grid">
          <label className="form-field full"><span className="form-label">Transaction type</span><select className="form-control" value={kind} onChange={(event) => setKind(event.target.value as TransactionKind)}><option>Expense</option><option>Income</option><option>Contribution</option><option>Withdrawal</option><option>Loan received</option><option>Loan given</option><option>Transfer</option></select></label>
          <label className="form-field"><span className="form-label">Amount (PKR)</span><input className="form-control" type="number" min="1" step="1" required placeholder="e.g. 12,500" value={amount} onChange={(event) => setAmount(event.target.value)} /><span className="field-hint">Enter whole PKR amounts for now.</span></label>
          <label className="form-field"><span className="form-label">Date</span><input className="form-control" type="date" required value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} /></label>
          <label className="form-field full"><span className="form-label">Description</span><input className="form-control" required maxLength={160} placeholder="What was this transaction for?" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="form-field"><span className="form-label">Category</span><select className="form-control" value={category} onChange={(event) => setCategory(event.target.value)}><option>General</option><option>Sales & services</option><option>Rent & utilities</option><option>Tools & software</option><option>Travel & transport</option><option>Owner funding</option><option>Loan repayment</option></select></label>
          <label className="form-field"><span className="form-label">{isOutgoing ? 'Paid from' : 'Received into'}</span><select className="form-control" required value={accountId} onChange={(event) => setAccountId(event.target.value)}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          {kind === 'Transfer' && <label className="form-field full"><span className="form-label">Transfer to</span><select className="form-control" required value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)}>{data.accounts.filter((account) => String(account.id) !== accountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}
          {(kind === 'Loan received' || kind === 'Loan given') && <><label className="form-field"><span className="form-label">{kind === 'Loan received' ? 'Lender' : 'Borrower'}</span><input className="form-control" maxLength={120} placeholder="Person or business" value={counterparty} onChange={(event) => setCounterparty(event.target.value)} /></label><label className="form-field"><span className="form-label">Due date (optional)</span><input className="form-control" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></>}
          <label className="form-field full"><span className="form-label">Note</span><textarea className="form-control" maxLength={1000} placeholder="Add a note or reference (optional)" value={note} onChange={(event) => setNote(event.target.value)} /></label>
        </div>{saveError && <div className="form-error" role="alert">{saveError}</div>}<div className="dialog-footer"><Dialog.Close asChild><button type="button" className="cancel-button" disabled={saving}>Cancel</button></Dialog.Close><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : <><Check size={14} /> Save transaction</>}</button></div></form>
      </Dialog.Content></Dialog.Portal></Dialog.Root>
      <Dialog.Root open={repaymentOpen} onOpenChange={setRepaymentOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-card"><div className="dialog-header"><div><Dialog.Title className="dialog-title">{repaymentLoan?.direction === 'PAYABLE' ? 'Record loan repayment' : 'Record loan collection'}</Dialog.Title><Dialog.Description className="dialog-description">{repaymentLoan ? `${repaymentLoan.name} · ${formatPKR(repaymentLoan.outstanding)} principal remaining. Principal changes the loan balance; any fee is recorded separately.` : 'Record a loan repayment or collection.'}</Dialog.Description></div><Dialog.Close asChild><button className="close-button" aria-label="Close repayment dialog"><X size={15} /></button></Dialog.Close></div>
        <form onSubmit={recordRepayment}><div className="form-grid">
          <label className="form-field"><span className="form-label">Principal amount (PKR)</span><input className="form-control" type="number" min="1" max={repaymentLoan?.outstanding} step="1" required value={repaymentPrincipal} onChange={(event) => setRepaymentPrincipal(event.target.value)} /></label>
          <label className="form-field"><span className="form-label">Date</span><input className="form-control" type="date" required value={repaymentDate} onChange={(event) => setRepaymentDate(event.target.value)} /></label>
          <label className="form-field full"><span className="form-label">{repaymentLoan?.direction === 'PAYABLE' ? 'Paid from' : 'Received into'}</span><select className="form-control" required value={repaymentAccount} onChange={(event) => setRepaymentAccount(event.target.value)}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label className="form-field"><span className="form-label">Optional interest or fee (PKR)</span><input className="form-control" type="number" min="0" step="1" value={repaymentFee} onChange={(event) => setRepaymentFee(event.target.value)} placeholder="0" /><span className="field-hint">Posted separately as {repaymentLoan?.direction === 'RECEIVABLE' ? 'income' : 'expense'}.</span></label>
          <label className="form-field"><span className="form-label">Fee / interest description</span><input className="form-control" maxLength={120} required={Number(repaymentFee) > 0} value={repaymentFeeDescription} onChange={(event) => setRepaymentFeeDescription(event.target.value)} placeholder="Required only when amount is entered" /></label>
          <label className="form-field full"><span className="form-label">Note</span><textarea className="form-control" maxLength={1000} value={repaymentNote} onChange={(event) => setRepaymentNote(event.target.value)} placeholder="Reference or repayment details (optional)" /></label>
        </div>{repaymentError && <div className="form-error" role="alert">{repaymentError}</div>}<div className="dialog-footer"><Dialog.Close asChild><button type="button" className="cancel-button" disabled={repaymentSaving}>Cancel</button></Dialog.Close><button type="submit" className="primary-button" disabled={repaymentSaving}>{repaymentSaving ? 'Saving…' : <><Check size={14} /> Record {repaymentLoan?.direction === 'PAYABLE' ? 'repayment' : 'collection'}</>}</button></div></form>
      </Dialog.Content></Dialog.Portal></Dialog.Root>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
