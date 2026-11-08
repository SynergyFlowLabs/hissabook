'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Download, FilterX, Search, Wallet } from 'lucide-react';
import AppSidebar from '@/components/app-sidebar';

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
};

type LedgerResponse = {
  transactions: Activity[];
  accounts: Array<{ id: number; name: string }>;
  categories: string[];
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

function makeFilters(query: string, kind: string, category: string, accountId: string, status: string, from: string, to: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (kind) params.set('kind', kind);
  if (category) params.set('category', category);
  if (accountId) params.set('accountId', accountId);
  if (status) params.set('status', status);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return params;
}

export default function TransactionsClient({ userName, userRole }: { userName: string; userRole: string }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const limit = 50;
  const filterParams = useMemo(() => makeFilters(query, kind, category, accountId, status, from, to), [query, kind, category, accountId, status, from, to]);
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
    setQuery(''); setKind(''); setCategory(''); setAccountId(''); setStatus(''); setFrom(''); setTo(''); setOffset(0);
  };
  const pageNumber = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  return <div className="app-shell"><AppSidebar workspaceName="My Business" businessType="Business workspace" userName={userName} userRole={userRole} current="transactions" loanCount={0} />
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><a href="/#overview">Workspace</a><span>/</span><strong>Transactions</strong></div><div className="top-actions"><a className="subtle-button ledger-back-link" href="/#overview"><ArrowLeft size={13} /> Overview</a></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">Business records</div><h1 className="page-title">Transaction ledger</h1><div className="page-subtitle">Search, filter, and export recorded transactions and loan repayments.</div></div>
          <a className="primary-button ledger-export" href={exportUrl}><Download size={14} /> Export CSV</a>
        </div>

        <section className="panel ledger-panel" aria-label="Transaction filters">
          <div className="ledger-filter-heading"><div><div className="panel-title">Find activity</div><div className="panel-subtitle">Filters apply to both transactions and loan repayments.</div></div><button type="button" className="link-button" onClick={clearFilters}><FilterX size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Clear filters</button></div>
          <div className="ledger-filters">
            <label className="form-field ledger-search"><span className="form-label">Search</span><span className="ledger-search-control"><Search size={14} /><input className="form-control" type="search" maxLength={120} placeholder="Description, payee, note…" value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} /></span></label>
            <label className="form-field"><span className="form-label">Activity type</span><select className="form-control" value={kind} onChange={(event) => { setKind(event.target.value); setOffset(0); }}><option value="">All types</option>{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="form-field"><span className="form-label">Category</span><select className="form-control" value={category} onChange={(event) => { setCategory(event.target.value); setOffset(0); }}><option value="">All categories</option>{(data?.categories ?? []).map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="form-field"><span className="form-label">Account</span><select className="form-control" value={accountId} onChange={(event) => { setAccountId(event.target.value); setOffset(0); }}><option value="">All accounts</option>{(data?.accounts ?? []).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label className="form-field"><span className="form-label">Status</span><select className="form-control" value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}><option value="">All statuses</option><option value="CLEARED">Cleared</option><option value="PENDING">Pending</option><option value="VOID">Voided</option></select></label>
            <label className="form-field"><span className="form-label">From</span><input className="form-control" type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setOffset(0); }} /></label>
            <label className="form-field"><span className="form-label">To</span><input className="form-control" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setOffset(0); }} /></label>
          </div>
        </section>

        <section className="panel ledger-results" aria-label="Transaction results">
          <div className="panel-header"><div><div className="panel-title">All activity</div><div className="panel-subtitle">{loading ? 'Loading matching records…' : `${(data?.total ?? 0).toLocaleString()} matching ${(data?.total ?? 0) === 1 ? 'record' : 'records'}`}</div></div><span className="ledger-page-count">{data?.total ? `Page ${pageNumber} of ${pageCount}` : ''}</span></div>
          {error ? <div className="ledger-message error" role="alert">{error} <button className="link-button" onClick={() => setRetry((current) => current + 1)}>Try again</button></div> : null}
          <div className="ledger-table-wrap"><table className="transaction-table ledger-table"><thead><tr><th>Type</th><th>Date</th><th>Description</th><th>Account</th><th>Category</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead><tbody>
            {loading && !data ? <tr><td colSpan={7} className="ledger-message">Loading activity…</td></tr> : data?.transactions.length ? data.transactions.map((item) => {
              const negative = ['EXPENSE', 'WITHDRAWAL', 'LOAN_GIVEN', 'LOAN_REPAYMENT_OUT'].includes(item.kind);
              const neutral = item.kind === 'TRANSFER';
              return <tr key={`${item.kind}-${item.id}`}>
                <td><span className={`ledger-kind ${negative ? 'outflow' : ''}`}>{negative ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}{displayKind(item.kind)}</span></td>
                <td className="table-muted">{displayDate(item.date)}</td>
                <td><div className="ledger-description">{item.title}</div>{item.counterparty && <div className="ledger-secondary">{item.counterparty}</div>}{item.note && <div className="ledger-note" title={item.note}>{item.note}</div>}</td>
                <td className="table-muted">{item.kind === 'TRANSFER' ? `${item.account} → ${item.destinationAccount}` : item.account}</td>
                <td className="table-muted">{item.category}</td>
                <td><span className={`status-pill ${item.status.toLowerCase()}`}>{item.status === 'CLEARED' ? 'Cleared' : item.status === 'PENDING' ? 'Pending' : 'Voided'}</span></td>
                <td className={neutral ? 'table-muted' : negative ? 'amount-negative' : 'amount-positive'} style={{ textAlign: 'right' }}>{neutral ? '' : negative ? '−' : '+'}{formatPKR(item.amount)}</td>
              </tr>;
            }) : !loading && <tr><td colSpan={7} className="ledger-message">No activity matches these filters. Try clearing or changing your filters.</td></tr>}
          </tbody></table></div>
          <div className="ledger-pagination"><span className="panel-subtitle">Showing {data?.total ? `${offset + 1}–${Math.min(offset + (data?.transactions.length ?? 0), data.total)} of ${data.total.toLocaleString()}` : '0 records'}</span><div><button type="button" className="subtle-button" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}><ArrowLeft size={12} /> Previous</button><button type="button" className="subtle-button" disabled={!data?.hasMore || loading} onClick={() => setOffset(offset + limit)}>Next <ArrowRight size={12} /></button></div></div>
        </section>
        <div className="footer-note"><Wallet size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Exports include only activity in this workspace and the filters currently selected.</div>
      </div>
    </main>
  </div>;
}
