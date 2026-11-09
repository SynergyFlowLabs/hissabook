'use client';

import { useEffect, useState } from 'react';
import { Check, Landmark, Pencil, Plus, Smartphone, Trash2, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgetCache } from '@/lib/route-cache';
import { formatPKR } from '@/lib/format';

/**
 * Manage business accounts: add, rename, retype, set an opening balance, remove.
 *
 * Replaces a toast that said "Account management is being built." The screen
 * behind it already listed the accounts and their balances; the only thing
 * missing was a way to change them.
 *
 * Rules that are stated in the UI rather than only enforced on the server,
 * because a refusal the user cannot see coming feels like a bug:
 *
 *  - The balance itself is never typed. It is derived from the ledger. Only the
 *    opening balance is editable, and only while the account has no
 *    transactions — after that it is history.
 *  - An account with transactions can be renamed but not deleted, so the
 *    ledger's history stays readable.
 *  - The last account cannot be removed; the book needs somewhere to post.
 */

export type ManagedAccount = { id: number; name: string; type: string; balance: number };

const TYPE_LABEL: Record<string, string> = { CASH: 'Cash', BANK: 'Bank', MOBILE: 'Mobile wallet' };
const TYPE_ICON: Record<string, typeof Wallet> = { CASH: Wallet, BANK: Landmark, MOBILE: Smartphone };

type Draft = { name: string; accountType: string; openingBalance: string };
const EMPTY_DRAFT: Draft = { name: '', accountType: 'CASH', openingBalance: '0' };

export default function AccountsDialog({
  open,
  onOpenChange,
  accounts,
  canManage,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: ManagedAccount[];
  canManage: boolean;
  /** Receives the fresh dashboard payload so the page updates in place. */
  onSaved: (payload: unknown) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Every close resets the panel, so reopening never shows a half-finished edit.
  useEffect(() => {
    if (open) return;
    setAdding(false); setEditingId(null); setDraft(EMPTY_DRAFT); setError(''); setBusy(false);
  }, [open]);

  const startAdd = () => { setEditingId(null); setDraft(EMPTY_DRAFT); setError(''); setAdding(true); };
  const startEdit = (account: ManagedAccount) => {
    setAdding(false); setError('');
    setEditingId(account.id);
    setDraft({ name: account.name, accountType: account.type, openingBalance: String(account.balance) });
  };
  const cancel = () => { setAdding(false); setEditingId(null); setError(''); };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const editing = editingId !== null;
      const response = await fetch(editing ? `/api/accounts/${editingId}` : '/api/accounts', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          accountType: draft.accountType,
          // Only meaningful for a brand-new account; the server rejects changes
          // once transactions exist, and the field is hidden in that case.
          ...(editing ? {} : { openingBalance: Number(draft.openingBalance || 0) }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this account.');
      onSaved(result);
      // The dashboard payload is cached across navigation; drop it so a return
      // visit cannot show the pre-edit account list.
      forgetCache('dashboard');
      cancel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this account.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (account: ManagedAccount) => {
    if (!window.confirm(`Remove "${account.name}"? This cannot be undone.`)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not remove this account.');
      onSaved(result);
      forgetCache('dashboard');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove this account.');
    } finally {
      setBusy(false);
    }
  };

  const form = (adding || editingId !== null) && (
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card-soft)] p-4">
      <div className="form-field">
        <Label htmlFor="account-name" className="form-label">Account name</Label>
        <Input
          id="account-name"
          autoFocus
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder="e.g. Meezan Bank"
          className="h-11 rounded-full"
          maxLength={80}
        />
      </div>

      <div className="form-field mt-3">
        <Label className="form-label">Type</Label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
        <div className="form-field mt-3">
          <Label htmlFor="account-opening" className="form-label">Opening balance (PKR)</Label>
          <Input
            id="account-opening"
            type="number"
            inputMode="numeric"
            value={draft.openingBalance}
            onChange={(event) => setDraft({ ...draft, openingBalance: event.target.value })}
            className="h-11 rounded-full"
          />
          <span className="field-hint">What is already in this account today. Leave 0 to start empty.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button type="submit" className="h-11 rounded-full" disabled={busy || !draft.name.trim()}>
          {busy ? 'Saving…' : adding ? 'Add account' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" className="h-11 rounded-full" onClick={cancel} disabled={busy}>
          <X size={14} /> Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[560px] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">Business accounts</DialogTitle>
          <DialogDescription>
            Where your money sits. Balances come from the ledger; change what the account is called and where it starts.
          </DialogDescription>
        </DialogHeader>

        {error && <div className="form-error" role="alert">{error}</div>}

        {!canManage ? (
          <p className="card-subtitle" style={{ marginTop: 12 }}>
            Only owners and admins can add or change accounts.
          </p>
        ) : null}

        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {accounts.map((account) => {
            const Icon = TYPE_ICON[account.type] ?? Wallet;
            return (
              <div key={account.id} className="sk-list-row" style={{ alignItems: 'center' }}>
                <span className="account-icon" style={{ flex: '0 0 auto' }}><Icon size={16} /></span>
                <span className="sk-grow" style={{ minWidth: 0 }}>
                  <span className="account-name" style={{ display: 'block' }}>{account.name}</span>
                  <span className="account-type">{TYPE_LABEL[account.type] ?? account.type} · PKR</span>
                </span>
                <span className="account-balance" style={{ whiteSpace: 'nowrap' }}>{formatPKR(account.balance)}</span>
                {canManage && (
                  <span style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
                    <button type="button" className="icon-row-button" aria-label={`Rename ${account.name}`} onClick={() => startEdit(account)}>
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-row-button archive"
                      aria-label={`Remove ${account.name}`}
                      disabled={busy || accounts.length <= 1}
                      title={accounts.length <= 1 ? 'Keep at least one account' : undefined}
                      onClick={() => void remove(account)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {form}

        {canManage && !adding && editingId === null && (
          <Button type="button" variant="outline" className="mt-4 h-11 w-full rounded-full" onClick={startAdd}>
            <Plus size={15} /> Add an account
          </Button>
        )}

        <p className="field-hint" style={{ marginTop: 14 }}>
          <Check size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
          An account with transactions can be renamed but not removed, so the history stays readable.
        </p>
      </DialogContent>
    </Dialog>
  );
}
