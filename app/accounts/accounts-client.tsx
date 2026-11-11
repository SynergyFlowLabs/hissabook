'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, Info, Landmark, Lock, MoreHorizontal, Pencil, Plus, ShieldCheck,
  Smartphone, Trash2, Wallet, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Topbar from '@/components/topbar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SkPageBody, SkStatus } from '@/components/skeletons';
import { forgetCache, readCache, writeCache } from '@/lib/route-cache';
import { formatPKR } from '@/lib/format';

/**
 * Business accounts: the page that manages where money sits.
 *
 * Previously this lived in a dialog on the dashboard. It outgrew a dialog: every
 * account needs its balance, its ledger context, and the reason a change is or
 * is not allowed. A page has room to say that plainly instead of relying on a
 * refusal arriving as a surprise.
 *
 * Two rules are stated in the UI as well as enforced by the API, because a
 * refusal the user cannot see coming reads as a bug:
 *
 *  - The running balance is never typed. It is derived from the ledger; a typed
 *    balance would invent money no transaction explains.
 *  - An account with history can be renamed but not removed, so the ledger stays
 *    readable. The last account cannot be removed at all.
 */

type Account = {
  id: number;
  name: string;
  type: string;
  currency: string;
  openingBalance: number;
  balance: number;
  entryCount: number;
  hasHistory: boolean;
};

type Payload = {
  accounts: Account[];
  total: number;
  workspace: { name: string; businessType: string; currency: string };
};

const CACHE = 'accounts';
const TYPE_LABEL: Record<string, string> = { CASH: 'Cash', BANK: 'Bank', MOBILE: 'Mobile wallet' };
const TYPE_ICON: Record<string, typeof Wallet> = { CASH: Wallet, BANK: Landmark, MOBILE: Smartphone };

type Draft = { name: string; accountType: string; openingBalance: string };
const EMPTY_DRAFT: Draft = { name: '', accountType: 'CASH', openingBalance: '0' };

/**
 * Whether removal is offered for an account at all. Mirrors the two rules the
 * API enforces: the book keeps one account, and an account with entries stays so
 * its history remains readable.
 */
function removable(account: Account, total: number) {
  return total > 1 && !account.hasHistory;
}

export default function AccountsClient({ userRole, initial }: { userName: string; userRole: string; initial?: Payload }) {
  const canManage = ['OWNER', 'ADMIN'].includes(userRole);
  // `initial` came from the server in the same render as this HTML, so it beats
  // any cached snapshot from a previous visit: the rows are correct on the very
  // first paint, and the skeleton below is only what a caller that passes no
  // seed would see. The cache covers a client-side return to this route.
  const [data, setData] = useState<Payload | null>(() => initial ?? readCache<Payload>(CACHE));
  const [loadError, setLoadError] = useState('');

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/accounts', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load your accounts.');
        return result as Payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        writeCache(CACHE, payload);
        setLoadError('');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setLoadError(reason instanceof Error ? reason.message : 'Could not load your accounts.');
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const apply = (payload: Payload) => {
    setData(payload);
    writeCache(CACHE, payload);
    // The dashboard shows the same balances; drop its cache so it refetches.
    forgetCache('dashboard');
  };

  const startAdd = () => { setEditingId(null); setDraft(EMPTY_DRAFT); setFormError(''); setNotice(''); setAdding(true); };
  const startEdit = (account: Account) => {
    setAdding(false); setFormError(''); setNotice('');
    setEditingId(account.id);
    setDraft({ name: account.name, accountType: account.type, openingBalance: String(account.balance) });
  };
  const cancel = () => { setAdding(false); setEditingId(null); setFormError(''); };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setFormError(''); setNotice('');
    try {
      const editing = editingId !== null;
      const response = await fetch(editing ? `/api/accounts/${editingId}` : '/api/accounts', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          accountType: draft.accountType,
          // Only meaningful for a brand-new account; once entries exist the
          // opening balance is history and the API locks it.
          ...(editing ? {} : { openingBalance: Number(draft.openingBalance || 0) }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this account.');
      cancel();
      setNotice(editing ? 'Account updated.' : `“${draft.name.trim()}” added.`);
      // The API returns the dashboard payload; refetch the page-shaped one.
      void result;
      const refreshed = await fetch('/api/accounts', { cache: 'no-store' });
      if (refreshed.ok) apply(await refreshed.json() as Payload);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Could not save this account.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (account: Account) => {
    if (!window.confirm(`Remove “${account.name}”? This cannot be undone.`)) return;
    setBusy(true); setFormError(''); setNotice('');
    try {
      const response = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not remove this account.');
      const refreshed = await fetch('/api/accounts', { cache: 'no-store' });
      if (refreshed.ok) apply(await refreshed.json() as Payload);
      setNotice(`“${account.name}” removed.`);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Could not remove this account.');
    } finally {
      setBusy(false);
    }
  };

  // One summary of what the accounts actually are, rather than the workspace's
  // business type as a caption under the count (which read as "3 Creative agency").
  const typeSummary = useMemo(() => {
    if (!data) return '';
    const names = Array.from(new Set(data.accounts.map((account) => TYPE_LABEL[account.type] ?? account.type)));
    return names.length ? names.join(' · ') : 'No accounts yet';
  }, [data]);

  if (!data) {
    if (loadError) {
      return (
        <div className="loading-screen">
          <div className="icon-badge"><Wallet size={20} /></div>
          <strong>Your accounts could not be loaded</strong>
          <span>{loadError}</span>
          <Button
            className="lime-button"
            onClick={() => { setLoadError(''); setReloadKey((key) => key + 1); }}
          >
            Try again
          </Button>
        </div>
      );
    }
    return (
      <div className="app-shell" id="overview">
        <main className="main-area">
          <Topbar crumb="Accounts" />
          <div className="content">
            <SkStatus label="Loading your accounts" />
            <section className="page-heading">
              <div>
                <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />Where money sits</span>
                <h1 className="page-title">Accounts</h1>
                <p className="page-subtitle">Cash boxes, bank accounts and mobile wallets, with balances that come from the ledger.</p>
              </div>
            </section>
            <SkPageBody stats={3} tableColumns={5} tableRows={4} extra="two-cards" />
          </div>
        </main>
      </div>
    );
  }

  const form = (adding || editingId !== null) && (
    <form onSubmit={submit} className="soft-card account-form" aria-label={adding ? 'Add an account' : 'Edit account'}>
      <div className="card-header-row account-form-head">
        <div>
          <div className="card-title">{adding ? 'Add an account' : 'Edit account'}</div>
          <div className="card-subtitle">
            {adding
              ? 'Where the money currently sits. The opening balance is what is already there today.'
              : 'Rename it, or change what kind of account it is.'}
          </div>
        </div>
        <button type="button" className="account-form-close" aria-label="Close form" onClick={cancel} disabled={busy}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="form-field">
          <Label htmlFor="account-name" className="form-label">Account name</Label>
          <Input
            id="account-name"
            autoFocus
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="e.g. Meezan Bank"
            maxLength={80}
          />
        </div>

        <div className="form-field">
          <Label className="form-label">Type</Label>
          <div className="account-type-options">
            {(['CASH', 'BANK', 'MOBILE'] as const).map((type) => {
              const Icon = TYPE_ICON[type];
              const active = draft.accountType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDraft({ ...draft, accountType: type })}
                  aria-pressed={active}
                  className={`ghost-pill ${active ? 'active' : ''}`}
                  style={active ? { borderColor: 'var(--lime-strong)', color: 'var(--ink)' } : undefined}
                >
                  <Icon size={13} /> {TYPE_LABEL[type]}
                </button>
              );
            })}
          </div>
        </div>

        {adding && (
          <div className="form-field full">
            <Label htmlFor="account-opening" className="form-label">Opening balance (PKR)</Label>
            <Input
              id="account-opening"
              type="number"
              inputMode="numeric"
              value={draft.openingBalance}
              onChange={(event) => setDraft({ ...draft, openingBalance: event.target.value })}
            />
            <span className="field-hint">What is already in this account today. Leave 0 to start empty.</span>
          </div>
        )}
      </div>

      {formError && <div className="form-error" role="alert">{formError}</div>}

      <div className="form-actions is-inline">
        <Button type="submit" className="lime-button" disabled={busy || !draft.name.trim()}>
          {busy ? 'Saving…' : adding ? 'Add account' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <div className="app-shell" id="overview">
      <main className="main-area">
        <Topbar />

        <div className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />Where money sits</span>
              <h1 className="page-title">Accounts</h1>
              <p className="page-subtitle">Cash boxes, bank accounts and mobile wallets, with balances that come from the ledger.</p>
            </div>
            {canManage && (
              <div className="page-heading-actions">
                <Button className="lime-button" onClick={startAdd} disabled={adding}>
                  <Plus size={15} aria-hidden="true" /> Add account
                </Button>
              </div>
            )}
          </section>

          {notice && <div className="notice-bar" role="status"><Check size={13} aria-hidden="true" />{notice}</div>}
          {formError && !adding && editingId === null && <div className="form-error" role="alert">{formError}</div>}

          {/* One wide balance tile, then two equal cards. Three tiles in a
              two-column grid left a hole in the last row and gave the shortest
              card a ragged height of its own. */}
          <section className="stat-grid is-summary" aria-label="Accounts summary">
            <div className="stat-card stat-card-wide">
              <div className="stat-top"><span className="stat-label">Total recorded</span><span className="stat-icon lime"><Wallet size={16} aria-hidden="true" /></span></div>
              <div className="stat-value lg">{formatPKR(data.total)}</div>
              <div className="stat-sub">Across {data.accounts.length} {data.accounts.length === 1 ? 'account' : 'accounts'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span className="stat-label">Accounts</span><span className="stat-icon green"><Landmark size={16} aria-hidden="true" /></span></div>
              <div className="stat-value">{data.accounts.length}</div>
              <div className="stat-sub">{typeSummary}</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span className="stat-label">Your role</span><span className="stat-icon slate"><ShieldCheck size={16} aria-hidden="true" /></span></div>
              <div className="stat-value role">{userRole.toLowerCase()}</div>
              <div className="stat-sub">{canManage ? 'You can add and change accounts' : 'Read only'}</div>
            </div>
          </section>

          {form}

          <section className="soft-card account-card" aria-label="Business accounts">
            <div className="card-header-row">
              <div><div className="card-title">Business accounts</div><div className="card-subtitle">Balances come from cleared ledger entries, never typed by hand.</div></div>
            </div>

            {!canManage && (
              <div className="payroll-notice" style={{ marginTop: 12 }}>
                <ShieldCheck size={17} aria-hidden="true" />
                <span><strong>Read only.</strong> Only owners and admins can add or change accounts.</span>
              </div>
            )}

            <div className="account-list">
              {data.accounts.length === 0 ? (
                <p className="empty-state">No accounts yet. Add the cash box, bank account or wallet the money sits in.</p>
              ) : null}
              {data.accounts.map((account) => {
                const Icon = TYPE_ICON[account.type] ?? Wallet;
                const canRemove = removable(account, data.accounts.length);
                const entries = account.entryCount === 0
                  ? 'No entries yet'
                  : `${account.entryCount} ${account.entryCount === 1 ? 'entry' : 'entries'}`;
                return (
                  <div key={account.id} className="account-item">
                    <span className={`account-item-icon ${account.type === 'CASH' ? 'cash' : account.type === 'BANK' ? 'bank' : 'mobile'}`} aria-hidden="true"><Icon size={17} /></span>
                    <div className="account-item-body">
                      <strong title={account.name}>{account.name}</strong>
                      <small>{TYPE_LABEL[account.type] ?? account.type} · {account.currency} · {entries}</small>
                    </div>
                    <div className={`account-item-figure${account.balance < 0 ? ' is-negative' : ''}`}>{formatPKR(account.balance)}</div>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="account-menu-button" aria-label={`Actions for ${account.name}`} disabled={busy}>
                            <MoreHorizontal size={17} aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel className="account-menu-title">{account.name}</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => startEdit(account)}>
                            <Pencil size={14} aria-hidden="true" /> Rename account
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {canRemove ? (
                            <DropdownMenuItem variant="destructive" onSelect={() => void remove(account)}>
                              <Trash2 size={14} aria-hidden="true" /> Remove account
                            </DropdownMenuItem>
                          ) : (
                            // Offered as a visible but disabled action, with the rule
                            // spelled out: the account cannot be removed, and hiding
                            // the row entirely would look like a missing feature.
                            <>
                              <DropdownMenuItem disabled>
                                <Lock size={14} aria-hidden="true" /> Remove account
                              </DropdownMenuItem>
                              <DropdownMenuLabel className="account-menu-hint">
                                {account.hasHistory
                                  ? `${account.name} has entries, so it cannot be removed.`
                                  : 'The book needs at least one account.'}
                              </DropdownMenuLabel>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="card-note">
              <Info size={14} aria-hidden="true" />
              <span>An account with transactions can be renamed but not removed, so the ledger stays readable. The opening balance is fixed once the first entry is recorded.</span>
            </div>
          </section>

          <p className="footer-note" style={{ marginTop: 16 }}>
            <Link className="text-link" href="/">Back to the overview <ArrowRight size={11} aria-hidden="true" /></Link>
          </p>
        </div>
      </main>
    </div>
  );
}
