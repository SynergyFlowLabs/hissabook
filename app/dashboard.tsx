'use client';

import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight,
  Bell, BriefcaseBusiness, Check, ChevronDown, FileText, Filter, HandCoins,
  Landmark, LayoutDashboard, Menu, MoreHorizontal, Plus, Search, Settings2,
  ShieldCheck, ShoppingBag, TrendingDown, TrendingUp, Users, Wallet, X,
} from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

type TransactionKind = 'Income' | 'Expense' | 'Contribution' | 'Withdrawal' | 'Loan received' | 'Loan given' | 'Transfer';
type Transaction = {
  id: number;
  title: string;
  category: string;
  date: string;
  amount: number;
  kind: TransactionKind;
  account: string;
  status: 'Cleared' | 'Pending';
};

const chartSets = {
  '7 days': [
    { day: 'Mon', income: 84, expenses: 32 }, { day: 'Tue', income: 105, expenses: 48 },
    { day: 'Wed', income: 76, expenses: 39 }, { day: 'Thu', income: 134, expenses: 57 },
    { day: 'Fri', income: 119, expenses: 42 }, { day: 'Sat', income: 169, expenses: 72 }, { day: 'Sun', income: 148, expenses: 50 },
  ],
  '30 days': [
    { day: 'Oct 12', income: 52, expenses: 32 }, { day: 'Oct 16', income: 87, expenses: 44 },
    { day: 'Oct 20', income: 67, expenses: 38 }, { day: 'Oct 24', income: 128, expenses: 54 },
    { day: 'Oct 28', income: 103, expenses: 47 }, { day: 'Nov 1', income: 158, expenses: 70 },
    { day: 'Nov 5', income: 139, expenses: 52 }, { day: 'Nov 8', income: 186, expenses: 62 },
  ],
  '90 days': [
    { day: 'Sep 8', income: 48, expenses: 29 }, { day: 'Sep 20', income: 80, expenses: 42 },
    { day: 'Oct 2', income: 65, expenses: 34 }, { day: 'Oct 14', income: 119, expenses: 51 },
    { day: 'Oct 26', income: 93, expenses: 45 }, { day: 'Nov 8', income: 171, expenses: 66 },
  ],
};

const initialTransactions: Transaction[] = [
  { id: 1, title: 'Website project', category: 'Client payment · Income', date: 'Today, 10:42 AM', amount: 85000, kind: 'Income', account: 'Bank account', status: 'Cleared' },
  { id: 2, title: 'Studio rent', category: 'Rent & utilities · Expense', date: 'Today, 9:15 AM', amount: -32000, kind: 'Expense', account: 'Bank account', status: 'Cleared' },
  { id: 3, title: 'Hamza · Capital', category: 'Owner contribution', date: 'Yesterday', amount: 50000, kind: 'Contribution', account: 'Cash wallet', status: 'Cleared' },
  { id: 4, title: 'Software subscriptions', category: 'Tools & software · Expense', date: 'Nov 06, 2026', amount: -12500, kind: 'Expense', account: 'Bank account', status: 'Pending' },
];

const navigation = [
  { label: 'Overview', href: '#overview', icon: LayoutDashboard },
  { label: 'Transactions', href: '#transactions', icon: ArrowLeftRight },
  { label: 'Accounts', href: '#accounts', icon: Wallet },
  { label: 'Loans & dues', href: '#loans', icon: HandCoins, badge: '2' },
  { label: 'Owners', href: '#owners', icon: Users },
  { label: 'Reports', href: '#reports', icon: FileText },
];

function formatPKR(value: number) {
  return `₨ ${Math.abs(value).toLocaleString('en-PK')}`;
}

function KindIcon({ kind }: { kind: TransactionKind }) {
  if (kind === 'Income') return <ArrowDownLeft size={14} />;
  if (kind === 'Expense') return <ShoppingBag size={13} />;
  if (kind === 'Contribution') return <HandCoins size={14} />;
  if (kind === 'Withdrawal') return <ArrowUpRight size={14} />;
  return <ArrowLeftRight size={14} />;
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <a href="#overview" className="brand" aria-label="Hisaabook home">
        <span className="brand-mark"><BriefcaseBusiness size={19} strokeWidth={2.1} /></span>
        <span className="brand-copy"><span className="brand-name">hisaabook</span><span className="brand-caption">Business, in balance</span></span>
      </a>
      <button className="workspace-switcher" onClick={() => window.alert('Business switching will be available when workspaces are connected.')}>
        <span className="workspace-avatar">SS</span>
        <span className="workspace-meta"><span className="workspace-name">Safa Studio</span><span className="workspace-type">Creative agency</span></span>
        <ChevronDown size={14} color="#89958d" />
      </button>
      <div className="nav-label">Workspace</div>
      <nav className="nav-list" aria-label="Main navigation">
        {navigation.map(({ label, href, icon: Icon, badge }, index) => (
          <a key={label} className={`nav-link ${index === 0 ? 'active' : ''}`} href={href}>
            <Icon size={16} strokeWidth={1.8} /><span>{label}</span>{badge && <span className="nav-badge">{badge}</span>}
          </a>
        ))}
      </nav>
      <div className="nav-label" style={{ marginTop: 24 }}>Manage</div>
      <nav className="nav-list" aria-label="Management navigation">
        <a className="nav-link" href="#owners"><Settings2 size={16} strokeWidth={1.8} /><span>Business settings</span></a>
      </nav>
      <div className="sidebar-spacer" />
      <div className="help-card"><div className="help-title">A better way to work together</div><div className="help-copy">Keep your business records clear and everyone on the same page.</div><a href="#about" className="help-link">Explore Hisaabook <ArrowRight size={12} /></a></div>
      <div className="user-profile"><div className="profile-avatar">AK</div><div className="profile-meta"><div className="profile-name">Areeba Khan</div><div className="profile-role">Business owner</div></div><MoreHorizontal size={17} color="#89958d" /></div>
    </aside>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><div className="chart-tooltip-label">{label}</div>{payload.map((item) => <div className="chart-tooltip-value" key={item.name} style={{ color: item.color }}>{item.name}: ₨ {item.value}k</div>)}</div>;
}

export default function Dashboard() {
  const [period, setPeriod] = useState<keyof typeof chartSets>('30 days');
  const [transactions, setTransactions] = useState(initialTransactions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<TransactionKind>('Expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [account, setAccount] = useState('Bank account');

  const filteredTransactions = useMemo(() => transactions.filter((item) => `${item.title} ${item.category} ${item.account}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5), [transactions, query]);
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };
  const saveTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount.replace(/,/g, ''));
    if (!numericAmount || !description.trim()) return;
    const outgoing = kind === 'Expense' || kind === 'Withdrawal' || kind === 'Loan given';
    const fresh: Transaction = {
      id: Date.now(), title: description.trim(), category: `${category} · ${kind}`, date: 'Just now',
      amount: outgoing ? -numericAmount : numericAmount, kind, account, status: 'Cleared',
    };
    setTransactions((existing) => [fresh, ...existing]);
    setDialogOpen(false);
    setAmount(''); setDescription(''); setCategory('General');
    showToast('Transaction added to your business ledger.');
  };

  return (
    <div className="app-shell" id="overview">
      <Sidebar />
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu" onClick={() => showToast('Use the navigation links to explore your workspace.')}><Menu size={17} /></button>
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Overview</strong></div>
          <div className="top-actions">
            {searchOpen && <input aria-label="Search transactions" autoFocus className="form-control" style={{ width: 175, height: 34 }} placeholder="Search activity…" value={query} onChange={(event) => setQuery(event.target.value)} />}
            <button className="icon-button" aria-label="Search transactions" onClick={() => { setSearchOpen((open) => !open); setQuery(''); }}><Search size={16} /></button>
            <button className="icon-button" aria-label="Notifications" onClick={() => showToast('You’re all caught up.') }><Bell size={16} /><span className="notification-dot" /></button>
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div><div className="eyebrow">Sunday, November 8, 2026</div><h1 className="page-title">Good morning, Areeba <span aria-hidden="true">✳</span></h1><div className="page-subtitle">Here’s what’s happening with your business today.</div></div>
            <button className="primary-button" onClick={() => setDialogOpen(true)}><Plus size={15} strokeWidth={2.5} /> Add transaction</button>
          </section>

          <section className="stats-grid" aria-label="Business summary">
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Total cash balance</span><span className="stat-icon" style={{ background: '#eaf4ee', color: '#247451' }}><Wallet size={15} /></span></div><div className="stat-value">₨ 486,250</div><div className="stat-foot"><span className="stat-change"><TrendingUp size={11} /> 8.2%</span><span>vs. last month</span></div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Income this month</span><span className="stat-icon" style={{ background: '#eef4fb', color: '#597fa6' }}><ArrowDownLeft size={15} /></span></div><div className="stat-value">₨ 385,000</div><div className="stat-foot"><span className="stat-change"><TrendingUp size={11} /> 12.4%</span><span>vs. last month</span></div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Expenses this month</span><span className="stat-icon" style={{ background: '#fbf0e9', color: '#ba7954' }}><ArrowUpRight size={15} /></span></div><div className="stat-value">₨ 142,800</div><div className="stat-foot"><span className="stat-change down"><TrendingDown size={11} /> 3.1%</span><span>vs. last month</span></div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Outstanding loans</span><span className="stat-icon" style={{ background: '#f3eff9', color: '#8266a3' }}><HandCoins size={15} /></span></div><div className="stat-value">₨ 75,000</div><div className="stat-foot"><span>2 active obligations</span><span style={{ marginLeft: 'auto', color: '#b77b38', fontWeight: 700 }}>1 due soon</span></div></div>
          </section>

          <section className="dashboard-grid">
            <div className="panel" id="reports">
              <div className="panel-header"><div><div className="panel-title">Income & expenses</div><div className="panel-subtitle">A look at your business cash flow</div></div><div className="period-select" role="tablist" aria-label="Chart period">{(['7 days', '30 days', '90 days'] as const).map((item) => <button key={item} role="tab" aria-selected={period === item} className={`period-button ${period === item ? 'selected' : ''}`} onClick={() => setPeriod(item)}>{item}</button>)}</div></div>
              <div className="chart-legend"><span className="legend-item"><i className="legend-dot" style={{ background: '#267b58' }} />Income</span><span className="legend-item"><i className="legend-dot" style={{ background: '#c6d9bd' }} />Expenses</span><span style={{ marginLeft: 'auto' }}>Amounts in thousands</span></div>
              <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartSets[period]} margin={{ top: 10, right: 9, left: -13, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tickMargin={10} /><YAxis axisLine={false} tickLine={false} tickMargin={8} tickFormatter={(value) => `${value}`} /><Tooltip content={<CustomTooltip />} /><Line type="monotone" dataKey="income" name="Income" stroke="#267b58" strokeWidth={2.4} dot={false} activeDot={{ r: 4, fill: '#267b58', stroke: '#fff', strokeWidth: 2 }} /><Line type="monotone" dataKey="expenses" name="Expenses" stroke="#b9cfae" strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: '#b9cfae', stroke: '#fff', strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div>
            </div>
            <div className="panel cash-panel" id="accounts">
              <div className="panel-header"><div><div className="panel-title">Where your money is</div><div className="panel-subtitle">Available across business accounts</div></div><button className="icon-button" aria-label="Account options" style={{ width: 29, height: 29 }} onClick={() => showToast('Account settings are coming soon.')}><MoreHorizontal size={16} /></button></div>
              <div className="cash-main"><div><div className="cash-amount">₨ 486,250</div><div className="cash-period">Total recorded balance</div></div><span className="cash-trend"><TrendingUp size={11} /> 8.2%</span></div>
              <div className="balance-progress"><span /></div>
              <div className="account-row"><div className="account-left"><span className="account-icon"><Landmark size={14} /></span><span><div className="account-name">Business bank</div><div className="account-kind">Meezan Bank · PKR</div></span></div><span className="account-value">₨ 421,250</span></div>
              <div className="account-row"><div className="account-left"><span className="account-icon" style={{ background: '#f8f2e7', color: '#a18b5c' }}><Wallet size={14} /></span><span><div className="account-name">Cash in hand</div><div className="account-kind">Petty cash · PKR</div></span></div><span className="account-value">₨ 65,000</span></div>
              <button className="link-button" style={{ marginTop: 12 }} onClick={() => showToast('Account management will be available soon.')}>View all accounts <ArrowRight size={11} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></button>
            </div>
          </section>

          <section className="lower-grid">
            <div className="panel" id="transactions">
              <div className="panel-header"><div><div className="panel-title">Recent transactions</div><div className="panel-subtitle">Your latest business activity</div></div><div className="table-actions"><button className="subtle-button" onClick={() => showToast('Filters will be available with the full ledger.')}><Filter size={12} /> Filter</button><button className="link-button" onClick={() => showToast('Showing the latest transactions in this preview.')}>See all <ArrowRight size={11} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></button></div></div>
              <div style={{ overflowX: 'auto' }}><table className="transaction-table"><thead><tr><th>Transaction</th><th>Date</th><th>Account</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead><tbody>{filteredTransactions.length ? filteredTransactions.map((item) => <tr key={item.id}><td><div className="transaction-title"><span className="transaction-icon" style={{ background: item.amount < 0 ? '#fbf1eb' : '#edf6ef', color: item.amount < 0 ? '#ba7954' : '#39825a' }}><KindIcon kind={item.kind} /></span><span><div className="transaction-name">{item.title}</div><div className="transaction-category">{item.category}</div></span></div></td><td className="table-muted">{item.date}</td><td className="table-muted">{item.account}</td><td><span className={`status-pill ${item.status.toLowerCase()}`}><i className="legend-dot" style={{ width: 5, height: 5, background: 'currentColor' }} />{item.status}</span></td><td className={item.amount < 0 ? 'amount-negative' : 'amount-positive'} style={{ textAlign: 'right' }}>{item.amount < 0 ? '−' : '+'}{formatPKR(item.amount)}</td></tr>) : <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8b958e', padding: 24 }}>No matching activity found.</td></tr>}</tbody></table></div>
            </div>
            <div className="panel" id="owners">
              <div className="panel-header"><div><div className="panel-title">Ownership overview</div><div className="panel-subtitle">Agreed shares in Safa Studio</div></div><button className="link-button" onClick={() => showToast('Ownership history will be available with your business records.')}>View details <ArrowRight size={11} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></button></div>
              <div className="owner-list">
                <div className="owner-row"><div className="owner-avatar" style={{ background: '#e9f1e8' }}>AK</div><div className="owner-info"><div className="owner-name">Areeba Khan <span style={{ color: '#a0aaa2', fontSize: 8, fontWeight: 500 }}>· You</span></div><div className="owner-bar"><span style={{ width: '45%' }} /></div></div><div className="owner-share">45%</div></div>
                <div className="owner-row"><div className="owner-avatar" style={{ background: '#edf2e1' }}>HM</div><div className="owner-info"><div className="owner-name">Hamza Malik</div><div className="owner-bar"><span style={{ width: '35%' }} /></div></div><div className="owner-share">35%</div></div>
                <div className="owner-row"><div className="owner-avatar" style={{ background: '#f5eee1' }}>SA</div><div className="owner-info"><div className="owner-name">Sara Ahmed</div><div className="owner-bar"><span style={{ width: '20%' }} /></div></div><div className="owner-share">20%</div></div>
              </div>
              <div className="owner-note"><ShieldCheck size={13} /><span>Shares are recorded as agreed by your team. Contributions and ownership are tracked separately.</span></div>
            </div>
          </section>

          <section className="panel loans-panel" id="loans">
            <div className="panel-header"><div><div className="panel-title">Loans & amounts due</div><div className="panel-subtitle">Keep track of what’s owed to and by your business</div></div><button className="subtle-button" onClick={() => { setKind('Loan received'); setDialogOpen(true); }}><Plus size={12} /> Record a loan</button></div>
            <div className="loan-list">
              <div className="loan-item"><span className="loan-icon"><ArrowDownLeft size={15} /></span><span><div className="loan-name">Short-term business loan</div><div className="loan-due">Owed to Fariha · Due Dec 15</div></span><span className="loan-amount">₨ 50,000<small>Payable · 1 active</small></span></div>
              <div className="loan-item"><span className="loan-icon" style={{ background: '#edf5ee', color: '#4e8a61' }}><ArrowUpRight size={15} /></span><span><div className="loan-name">Advance to vendor</div><div className="loan-due">Owed by Print House · Due Nov 20</div></span><span className="loan-amount">₨ 25,000<small>Receivable · 1 active</small></span></div>
            </div>
          </section>
          <div className="footer-note" id="about">Hisaabook keeps your business records clear. For bookkeeping reference only — not legal, tax, or accounting advice.</div>
        </div>
      </main>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-card"><div className="dialog-header"><div><Dialog.Title className="dialog-title">Add a transaction</Dialog.Title><Dialog.Description className="dialog-description">Keep a clear record of money moving through your business.</Dialog.Description></div><Dialog.Close asChild><button className="close-button" aria-label="Close dialog"><X size={15} /></button></Dialog.Close></div>
        <form onSubmit={saveTransaction}><div className="form-grid">
          <label className="form-field full"><span className="form-label">Transaction type</span><select className="form-control" value={kind} onChange={(event) => setKind(event.target.value as TransactionKind)}><option>Expense</option><option>Income</option><option>Contribution</option><option>Withdrawal</option><option>Loan received</option><option>Loan given</option><option>Transfer</option></select></label>
          <label className="form-field"><span className="form-label">Amount (PKR)</span><input className="form-control" type="number" min="1" step="1" required placeholder="e.g. 12,500" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label className="form-field"><span className="form-label">Date</span><input className="form-control" type="date" defaultValue="2026-11-08" /></label>
          <label className="form-field full"><span className="form-label">Description</span><input className="form-control" required placeholder="What was this transaction for?" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="form-field"><span className="form-label">Category</span><select className="form-control" value={category} onChange={(event) => setCategory(event.target.value)}><option>General</option><option>Sales & services</option><option>Rent & utilities</option><option>Tools & software</option><option>Travel & transport</option><option>Owner funding</option><option>Loan repayment</option></select></label>
          <label className="form-field"><span className="form-label">Business account</span><select className="form-control" value={account} onChange={(event) => setAccount(event.target.value)}><option>Bank account</option><option>Cash in hand</option></select></label>
          <div className="form-field full"><span className="form-label">Note</span><textarea className="form-control" placeholder="Add a note or reference (optional)" /></div>
        </div><div className="dialog-footer"><Dialog.Close asChild><button type="button" className="cancel-button">Cancel</button></Dialog.Close><button type="submit" className="primary-button"><Check size={14} /> Save transaction</button></div></form>
      </Dialog.Content></Dialog.Portal></Dialog.Root>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
