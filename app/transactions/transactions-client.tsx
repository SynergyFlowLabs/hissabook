'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Download, FilterX, Search, Wallet } from 'lucide-react';
import AppSidebar from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Activity = {
  id: number;
  title: string;
  category: string;
  date: string;
  amount: number;
  kind: string;
  account: string;
  accountId: number;
  destinationAccount: string | null;
  destinationAccountId: number | null;
  status: string;
  counterparty: string;
  note: string;
  createdBy: string;
};

type LedgerResponse = {
  transactions: Activity[];
  accounts: Array<{ id: number; name: string }>;
  categories: string[];
  creators: string[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

const kinds = [
  ['INCOME', 'Income'], ['EXPENSE', 'Expense'], ['CONTRIBUTION', 'Contribution'], ['WITHDRAWAL', 'Withdrawal'],
  ['LOAN_RECEIVED', 'Loan received'], ['LOAN_GIVEN', 'Loan given'], ['LOAN_REPAYMENT_OUT', 'Loan repayment'],
  ['LOAN_REPAYMENT_IN', 'Loan collection'], ['TRANSFER', 'Transfer'],
] as const;

const ALL = '__all__';

function formatPKR(value: number) {
  return `₨ ${Math.abs(Number(value)).toLocaleString('en-PK')}`;
}

function displayKind(value: string) {
  return kinds.find(([key]) => key === value)?.[1] ?? value.replaceAll('_', ' ').toLowerCase();
}

function displayDate(value: string) {
  const day = value.slice(0, 10);
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusPill(status: string) {
  if (status === 'CLEARED') return 'pill good';
  if (status === 'PENDING') return 'pill warn';
  return 'pill neutral';
}

function makeFilters(query: string, kind: string, category: string, creator: string, accountId: string, status: string, from: string, to: string) {
  const params = new URLSearchParams();
  const unwrap = (value: string) => (value === ALL ? '' : value);
  if (query.trim()) params.set('q', query.trim());
  if (unwrap(kind)) params.set('kind', unwrap(kind));
  if (unwrap(category)) params.set('category', unwrap(category));
  if (unwrap(creator)) params.set('creator', unwrap(creator));
  if (unwrap(accountId)) params.set('accountId', unwrap(accountId));
  if (unwrap(status)) params.set('status', unwrap(status));
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return params;
}

export default function TransactionsClient({ userName, userRole }: { userName: string; userRole: string }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [creator, setCreator] = useState(ALL);
  const [accountId, setAccountId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const limit = 50;
  const filterParams = useMemo(() => makeFilters(query, kind, category, creator, accountId, status, from, to), [query, kind, category, creator, accountId, status, from, to]);
  const exportUrl = `/api/transactions?${filterParams.toString()}${filterParams.size ? '&' : ''}format=csv`;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(filterParams);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    setLoading(true);
    setError('');
    fetch(`/api/transactions?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load transactions.');
        return result as LedgerResponse;
      })
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Could not load transactions.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filterParams, offset, retry]);

  const clearFilters = () => {
    setQuery(''); setKind(ALL); setCategory(ALL); setCreator(ALL); setAccountId(ALL); setStatus(ALL); setFrom(''); setTo(''); setOffset(0);
  };
  const pageNumber = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  return (
    <div className="app-shell">
      <AppSidebar workspaceName="My Business" businessType="Business workspace" userName={userName} userRole={userRole} current="transactions" loanCount={0} />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><a href="/#overview" style={{ color: 'inherit', textDecoration: 'none' }}>Workspace</a><span aria-hidden="true">›</span><strong>Transactions</strong></div>
          <div className="top-actions"><a className="ghost-pill" href="/#overview"><ArrowLeft size={13} /> Overview</a></div>
        </header>
        <div className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />Business records</span>
              <h1 className="page-title">Transaction ledger</h1>
              <p className="page-subtitle">Search, filter, and export recorded transactions and loan repayments.</p>
            </div>
            <a className="lime-button" href={exportUrl} style={{ textDecoration: 'none' }}><Download size={15} /> Export CSV</a>
          </section>

          <section className="soft-card" aria-label="Transaction filters">
            <div className="card-header-row">
              <div><div className="card-title">Find activity</div><div className="card-subtitle">Filters apply to both transactions and loan repayments.</div></div>
              <button type="button" className="text-link" onClick={clearFilters}><FilterX size={13} /> Clear filters</button>
            </div>
            <div className="ledger-filters" style={{ marginTop: 14 }}>
              <div className="form-field ledger-search"><Label htmlFor="ledger-q" className="form-label">Search</Label><span className="ledger-search-control"><Search size={15} /><Input id="ledger-q" type="search" maxLength={120} placeholder="Description, payee, note…" value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} className="h-11 rounded-full" /></span></div>
              <div className="form-field"><Label htmlFor="ledger-kind" className="form-label">Activity type</Label>
                <Select value={kind} onValueChange={(value) => { setKind(value); setOffset(0); }}>
                  <SelectTrigger id="ledger-kind" className="h-11 rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>All types</SelectItem>{kinds.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="form-field"><Label htmlFor="ledger-category" className="form-label">Category</Label>
                <Select value={category} onValueChange={(value) => { setCategory(value); setOffset(0); }}>
                  <SelectTrigger id="ledger-category" className="h-11 rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>All categories</SelectItem>{(data?.categories ?? []).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="form-field"><Label htmlFor="ledger-creator" className="form-label">Recorded by</Label>
                <Select value={creator} onValueChange={(value) => { setCreator(value); setOffset(0); }}>
                  <SelectTrigger id="ledger-creator" className="h-11 rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>All members</SelectItem>{(data?.creators ?? []).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="form-field"><Label htmlFor="ledger-account" className="form-label">Account</Label>
                <Select value={accountId} onValueChange={(value) => { setAccountId(value); setOffset(0); }}>
                  <SelectTrigger id="ledger-account" className="h-11 rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>All accounts</SelectItem>{(data?.accounts ?? []).map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="form-field"><Label htmlFor="ledger-status" className="form-label">Status</Label>
                <Select value={status} onValueChange={(value) => { setStatus(value); setOffset(0); }}>
                  <SelectTrigger id="ledger-status" className="h-11 rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>All statuses</SelectItem><SelectItem value="CLEARED">Cleared</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="VOID">Voided</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="form-field"><Label htmlFor="ledger-from" className="form-label">From</Label><Input id="ledger-from" type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setOffset(0); }} className="h-11 rounded-full" /></div>
              <div className="form-field"><Label htmlFor="ledger-to" className="form-label">To</Label><Input id="ledger-to" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setOffset(0); }} className="h-11 rounded-full" /></div>
            </div>
          </section>

          <section className="soft-card" style={{ marginTop: 14 }} aria-label="Transaction results">
            <div className="card-header-row">
              <div><div className="card-title">All activity</div><div className="card-subtitle">{loading ? 'Loading matching records…' : `${(data?.total ?? 0).toLocaleString()} matching ${(data?.total ?? 0) === 1 ? 'record' : 'records'}`}</div></div>
              <span className="ledger-page-count">{data?.total ? `Page ${pageNumber} of ${pageCount}` : ''}</span>
            </div>
            {error ? <div className="ledger-message error" role="alert">{error} <button className="text-link" onClick={() => setRetry((current) => current + 1)}>Try again</button></div> : null}
            <div className="data-table-wrap"><table className="data-table ledger-table-min"><thead><tr><th>Type</th><th>Date</th><th>Description</th><th>Account</th><th>Category</th><th>Recorded by</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead><tbody>
              {loading && !data ? <tr><td colSpan={8} className="ledger-message">Loading activity…</td></tr> : data?.transactions.length ? data.transactions.map((item) => {
                const negative = ['EXPENSE', 'WITHDRAWAL', 'LOAN_GIVEN', 'LOAN_REPAYMENT_OUT'].includes(item.kind);
                const neutral = item.kind === 'TRANSFER';
                return <tr key={`${item.kind}-${item.id}`}>
                  <td><span className={`ledger-kind ${negative ? 'outflow' : ''}`}>{negative ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}{displayKind(item.kind)}</span></td>
                  <td className="table-muted" style={{ whiteSpace: 'nowrap' }}>{displayDate(item.date)}</td>
                  <td><div className="ledger-description">{item.title}</div>{item.counterparty && <div className="ledger-secondary">{item.counterparty}</div>}{item.note && <div className="ledger-note" title={item.note}>{item.note}</div>}</td>
                  <td className="table-muted">{item.kind === 'TRANSFER' ? `${item.account} → ${item.destinationAccount}` : item.account}</td>
                  <td className="table-muted">{item.category}</td>
                  <td className="table-muted ledger-creator">{item.createdBy || '-'}</td>
                  <td><span className={statusPill(item.status)}>{item.status === 'CLEARED' ? 'Cleared' : item.status === 'PENDING' ? 'Pending' : 'Voided'}</span></td>
                  <td className={neutral ? 'table-muted' : negative ? 'amount-negative' : 'amount-positive'} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{neutral ? '' : negative ? '−' : '+'}{formatPKR(item.amount)}</td>
                </tr>;
              }) : !loading && <tr><td colSpan={8} className="ledger-message">No activity matches these filters. Try clearing or changing your filters.</td></tr>}
            </tbody></table></div>
            <div className="ledger-pagination"><span className="ledger-page-count">Showing {data?.total ? `${offset + 1} to ${Math.min(offset + (data?.transactions.length ?? 0), data.total)} of ${data.total.toLocaleString()}` : '0 records'}</span><div style={{ display: 'flex', gap: 8 }}><Button variant="outline" className="rounded-full" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}><ArrowLeft size={13} /> Previous</Button><Button variant="outline" className="rounded-full" disabled={!data?.hasMore || loading} onClick={() => setOffset(offset + limit)}>Next <ArrowRight size={13} /></Button></div></div>
          </section>
          <p className="footer-note"><Wallet size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />Exports include only activity in this workspace and the filters currently selected.</p>
        </div>
      </main>
    </div>
  );
}
