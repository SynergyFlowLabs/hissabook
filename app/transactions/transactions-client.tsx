'use client';

import { DateField } from '@/components/date-field';
import { SkList, SkStatus, SkTableRows } from '@/components/skeletons';
import Topbar from '@/components/topbar';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpRight,
  ChevronDown, Download, FilterX, Search, SlidersHorizontal, Wallet, X,
} from 'lucide-react';
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
const OUTFLOW = ['EXPENSE', 'WITHDRAWAL', 'LOAN_GIVEN', 'LOAN_REPAYMENT_OUT'];

function formatPKR(value: number) {
  return `PKR ${Math.abs(Number(value)).toLocaleString('en-PK')}`;
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

function statusLabel(status: string) {
  return status === 'CLEARED' ? 'Cleared' : status === 'PENDING' ? 'Pending' : 'Voided';
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

export default function TransactionsClient({ userName, userRole, initialQuery = '' }: { userName: string; userRole: string; initialQuery?: string }) {
  // The topbar search lands here as `?q=`. Without this the term was dropped on
  // the floor: the bar navigated, the ledger opened unfiltered, and the search
  // looked broken on every screen except Overview.
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [creator, setCreator] = useState(ALL);
  const [accountId, setAccountId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Phones get the filter card folded away: eight fields used to push the first
  // record below two screens of scrolling, so the ledger looked empty. Search
  // stays visible, everything else is one tap behind "Filters". Desktop ignores
  // this flag and renders the grid open (see `.ledger-filters` in globals.css).
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const limit = 50;
  const filterParams = useMemo(() => makeFilters(query, kind, category, creator, accountId, status, from, to), [query, kind, category, creator, accountId, status, from, to]);
  const exportUrl = `/api/transactions?${filterParams.toString()}${filterParams.size ? '&' : ''}format=csv`;

  const selects = [kind, category, creator, accountId, status].filter((value) => value !== ALL).length;
  const advancedCount = selects + (from ? 1 : 0) + (to ? 1 : 0);
  const hasFilters = Boolean(query.trim()) || advancedCount > 0;

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
  const total = data?.total ?? 0;

  return (
    <div className="app-shell">
      <main className="main-area">
        <Topbar back={{ href: '/#overview', label: 'Overview' }} />
        <div className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />Business records</span>
              <h1 className="page-title">Transaction ledger</h1>
              <p className="page-subtitle">Search, filter, and export recorded transactions and loan repayments.</p>
            </div>
            <div className="page-heading-actions">
              <a className="lime-button" href={exportUrl} style={{ textDecoration: 'none' }}><Download size={15} aria-hidden="true" /> Export CSV</a>
            </div>
          </section>

          <section className="soft-card" aria-label="Transaction filters">
            <div className="card-header-row">
              <div>
                <div className="card-title">Find activity</div>
                <div className="card-subtitle">Filters apply to both transactions and loan repayments.</div>
              </div>
              <button type="button" className="text-link" onClick={clearFilters} disabled={!hasFilters}>
                <FilterX size={13} aria-hidden="true" /> Clear filters
              </button>
            </div>

            <div className="ledger-search-row">
              <div className="form-field ledger-search">
                <Label htmlFor="ledger-q" className="form-label">Search</Label>
                <span className="ledger-search-control">
                  <Search size={15} aria-hidden="true" />
                  <Input
                    id="ledger-q"
                    type="search"
                    maxLength={120}
                    placeholder="Description, payee, note…"
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setOffset(0); }}
                    className="pr-11"
                  />
                  {query ? (
                    <button
                      type="button"
                      className="ledger-search-clear"
                      aria-label="Clear search"
                      onClick={() => { setQuery(''); setOffset(0); }}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </span>
              </div>

              {/* Phones only: the grid below is one tap away. Hidden from 701px
                  up, where every filter is already on screen. */}
              <button
                type="button"
                className={`filter-toggle${filtersOpen ? ' is-open' : ''}`}
                aria-expanded={filtersOpen}
                aria-controls="ledger-filters"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <SlidersHorizontal size={15} aria-hidden="true" />
                <span>Filters</span>
                {advancedCount > 0 ? <span className="filter-count">{advancedCount}</span> : null}
                <ChevronDown size={14} className="filter-chevron" aria-hidden="true" />
              </button>
            </div>

            <div id="ledger-filters" className={`ledger-filters${filtersOpen ? ' is-open' : ''}`}>
              <div className="form-field">
                <Label htmlFor="ledger-kind" className="form-label">Activity type</Label>
                <Select value={kind} onValueChange={(value) => { setKind(value); setOffset(0); }}>
                  <SelectTrigger id="ledger-kind"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>All types</SelectItem>{kinds.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="form-field">
                <Label htmlFor="ledger-category" className="form-label">Category</Label>
                <Select value={category} onValueChange={(value) => { setCategory(value); setOffset(0); }}>
                  <SelectTrigger id="ledger-category"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>All categories</SelectItem>{(data?.categories ?? []).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="form-field">
                <Label htmlFor="ledger-status" className="form-label">Status</Label>
                <Select value={status} onValueChange={(value) => { setStatus(value); setOffset(0); }}>
                  <SelectTrigger id="ledger-status"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>All statuses</SelectItem><SelectItem value="CLEARED">Cleared</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="VOID">Voided</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="form-field">
                <Label htmlFor="ledger-account" className="form-label">Account</Label>
                <Select value={accountId} onValueChange={(value) => { setAccountId(value); setOffset(0); }}>
                  <SelectTrigger id="ledger-account"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>All accounts</SelectItem>{(data?.accounts ?? []).map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="form-field ledger-creator-field">
                <Label htmlFor="ledger-creator" className="form-label">Recorded by</Label>
                <Select value={creator} onValueChange={(value) => { setCreator(value); setOffset(0); }}>
                  <SelectTrigger id="ledger-creator"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>All members</SelectItem>{(data?.creators ?? []).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* The two dates are one field so they always sit side by side. As
                  two separate grid items they were split across rows, which left
                  a lone empty box labelled "To" under everything else. */}
              <div className="form-field ledger-dates">
                <span className="form-label" id="ledger-dates-label">Date range</span>
                <div className="ledger-date-pair" role="group" aria-labelledby="ledger-dates-label">
                  <DateField
                    id="ledger-from"
                    aria-label="From date"
                    placeholder="From"
                    value={from}
                    max={to || undefined}
                    onChange={(value) => { setFrom(value); setOffset(0); }}
                  />
                  <DateField
                    id="ledger-to"
                    aria-label="To date"
                    placeholder="To"
                    value={to}
                    min={from || undefined}
                    onChange={(value) => { setTo(value); setOffset(0); }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="soft-card" style={{ marginTop: 14 }} aria-label="Transaction results">
            <div className="card-header-row">
              <div>
                <div className="card-title">All activity</div>
                <div className="card-subtitle" aria-live="polite">
                  {loading ? 'Loading matching records…' : `${total.toLocaleString()} matching ${total === 1 ? 'record' : 'records'}`}
                  {!loading && hasFilters ? ' · filtered' : ''}
                </div>
              </div>
              <span className="ledger-page-count">{total ? `Page ${pageNumber} of ${pageCount}` : ''}</span>
            </div>

            {error ? <div className="ledger-message error" role="alert">{error} <button className="text-link" onClick={() => setRetry((current) => current + 1)}>Try again</button></div> : null}
            <SkStatus label={loading ? 'Loading matching records' : `${total.toLocaleString()} matching records loaded`} />

            {/* Phones: the 8-column table needs 1060px, so a phone only ever saw
                its first three headings. Below 701px the same records are drawn
                as rows a thumb can read; the table takes over above that. */}
            {loading && !data ? <div className="ledger-mobile-only" style={{ marginTop: 12 }}><SkList rows={4} /></div> : null}
            {data && data.transactions.length > 0 ? (
              <ul className={`activity-list${loading ? ' is-refreshing' : ''}`} aria-label="Matching activity">
                {data.transactions.map((item) => {
                  const negative = OUTFLOW.includes(item.kind);
                  const neutral = item.kind === 'TRANSFER';
                  const Icon = neutral ? ArrowLeftRight : negative ? ArrowUpRight : ArrowDownLeft;
                  return (
                    <li key={`${item.kind}-${item.id}`} className="activity-item">
                      <span className={`activity-icon ${neutral ? 'neutral' : negative ? 'out' : 'in'}`} aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <div className="activity-body">
                        <div className="activity-title">{item.title}</div>
                        <div className="activity-meta">
                          {displayKind(item.kind)} · {displayDate(item.date)}
                        </div>
                        <div className="activity-meta">
                          {neutral ? `${item.account} → ${item.destinationAccount}` : item.account}
                          {item.category ? ` · ${item.category}` : ''}
                        </div>
                        {item.status !== 'CLEARED' ? (
                          <div className="activity-tags"><span className={statusPill(item.status)}>{statusLabel(item.status)}</span></div>
                        ) : null}
                      </div>
                      <div className={`activity-amount ${neutral ? '' : negative ? 'out' : 'in'}`}>
                        {neutral ? formatPKR(item.amount) : `${negative ? '−' : '+'}${formatPKR(item.amount)}`}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {data && data.transactions.length === 0 && !loading ? (
              <p className="activity-empty" role="status">
                No activity matches these filters. <button type="button" className="text-link" onClick={clearFilters}>Clear filters</button>
              </p>
            ) : null}

            <div className={`data-table-wrap ledger-wide${loading && data ? ' is-refreshing' : ''}`} aria-busy={loading}>
              <table className="data-table ledger-table-min">
                <thead><tr><th>Type</th><th>Date</th><th>Description</th><th>Account</th><th>Category</th><th>Recorded by</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>
                  {loading && !data ? <SkTableRows rows={8} columns={8} /> : data?.transactions.length ? data.transactions.map((item) => {
                    const negative = OUTFLOW.includes(item.kind);
                    const neutral = item.kind === 'TRANSFER';
                    return <tr key={`${item.kind}-${item.id}`}>
                      <td><span className={`ledger-kind ${negative ? 'outflow' : ''}`}>{negative ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}{displayKind(item.kind)}</span></td>
                      <td className="table-muted" style={{ whiteSpace: 'nowrap' }}>{displayDate(item.date)}</td>
                      <td><div className="ledger-description">{item.title}</div>{item.counterparty && <div className="ledger-secondary">{item.counterparty}</div>}{item.note && <div className="ledger-note" title={item.note}>{item.note}</div>}</td>
                      <td className="table-muted">{item.kind === 'TRANSFER' ? `${item.account} → ${item.destinationAccount}` : item.account}</td>
                      <td className="table-muted">{item.category}</td>
                      <td className="table-muted ledger-creator">{item.createdBy || '-'}</td>
                      <td><span className={statusPill(item.status)}>{statusLabel(item.status)}</span></td>
                      <td className={neutral ? 'table-muted' : negative ? 'amount-negative' : 'amount-positive'} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{neutral ? '' : negative ? '−' : '+'}{formatPKR(item.amount)}</td>
                    </tr>;
                  }) : !loading && <tr><td colSpan={8} className="ledger-message">No activity matches these filters. Try clearing or changing your filters.</td></tr>}
                  {loading && data && data.transactions.length === 0 ? <SkTableRows rows={6} columns={8} /> : null}
                </tbody>
              </table>
            </div>

            <div className="ledger-pagination">
              <span className="ledger-page-count">
                {total ? `Showing ${offset + 1} to ${Math.min(offset + (data?.transactions.length ?? 0), total)} of ${total.toLocaleString()}` : '0 records'}
              </span>
              <div className="ledger-pagination-actions">
                <Button variant="outline" className="rounded-full" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>
                  <ArrowLeft size={13} aria-hidden="true" /> Previous
                </Button>
                <Button variant="outline" className="rounded-full" disabled={!data?.hasMore || loading} onClick={() => setOffset(offset + limit)}>
                  Next <ArrowRight size={13} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </section>
          <p className="footer-note"><Wallet size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />Exports include only activity in this workspace and the filters currently selected.</p>
        </div>
      </main>
    </div>
  );
}
