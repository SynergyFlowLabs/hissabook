'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Download, HandCoins, Pencil, Plus, Printer,
  Receipt, Scale, ShieldCheck, UserPlus, UsersRound, Wallet, X,
} from 'lucide-react';
import AppSidebar from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { sounds } from '@/lib/sounds';

type Partner = {
  id: number;
  name: string;
  role: string;
  share: number;
  baselineShare: number;
  effectiveAt: string;
  userId: number | null;
  status: string;
  capitalBalance: number;
  settleable: number;
  frontedOutstanding: number;
  appropriationsNet: number;
  drawingsTotal: number;
  netValue: number;
  month: { fronts: number; reimbursed: number; drawings: number };
  lastMovements: Array<{ id: number; entryType: string; direction: 'CREDIT' | 'DEBIT'; amount: number; date: string; note: string }>;
};
type Account = { id: number; name: string; type: string; currency: string };
type Member = { userId: number; name: string };
type Overview = {
  workspace: { id: number; name: string; businessType: string; currency: string };
  accounts: Account[];
  partners: Partner[];
  members: Member[];
  settings: { drawingCapPct: number };
};
type StatementRow = { id: number; entryType: string; direction: 'CREDIT' | 'DEBIT'; amount: number; note: string; date: string; label: string; bucket: 'capital' | 'current'; runningCurrent: number; runningCapital: number };
type StatementPayload = {
  partner: { id: number; name: string; role: string };
  from: string; to: string;
  opening: { capital: number; current: number };
  rows: StatementRow[];
  closing: { capital: number; current: number };
  summary: { fronted: number; reimbursed: number; drawings: number };
};
type MovementKind = 'drawing' | 'contribution' | 'capital-return' | 'reimburse';

const money = (amount: number) => `₨ ${Math.abs(Math.round(amount)).toLocaleString('en-PK')}`;
const signed = (amount: number) => `${amount < 0 ? '−' : ''}₨ ${Math.abs(Math.round(amount)).toLocaleString('en-PK')}`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const monthStartIso = () => `${todayIso().slice(0, 7)}-01`;
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' });
const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const ENTRY_LABEL: Record<string, string> = {
  CAPITAL_CONTRIBUTION: 'Capital added',
  CAPITAL_RETURN: 'Capital returned',
  EXPENSE_PAID: 'Fronted expense',
  ADVANCE_REIMBURSED: 'Reimbursed',
  CASH_WITHDRAWAL: 'Counter drawing',
  INTEREST_ON_CAPITAL: 'Interest on capital',
  INTEREST_ON_DRAWINGS: 'Interest on drawings',
  PARTNER_SALARY: 'Partner salary',
  PARTNER_COMMISSION: 'Partner commission',
  PROFIT_SHARE: 'Share of profit',
  LOSS_SHARE: 'Share of loss',
  SETTLEMENT: 'Settlement',
  CORRECTION: 'Correction',
};
const FRONT_CATEGORIES = ['General', 'Sales & services', 'Rent & utilities', 'Tools & software', 'Travel & transport', 'Inventory & stock', 'Marketing & ads', 'Salaries & wages'];

export default function PartnersClient({ userName, role }: { userName: string; role: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState('');
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const canEdit = canManage || role === 'BOOKKEEPER';

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/partners', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      setData(await response.json() as Overview);
      setLoadError('');
    } catch {
      setLoadError('Partner records could not be loaded. Please refresh.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // ------- dialogs -------
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [frontedOpen, setFrontedOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementKind, setMovementKind] = useState<MovementKind>('drawing');
  const [movementPartnerId, setMovementPartnerId] = useState<number | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementPartnerId, setStatementPartnerId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // add partner form
  const [npName, setNpName] = useState('');
  const [npRole, setNpRole] = useState('Partner');
  const [npShare, setNpShare] = useState('50');
  const [npDate, setNpDate] = useState(todayIso());
  const [npUserId, setNpUserId] = useState<string>('none');

  // share form
  const [shareInputs, setShareInputs] = useState<Record<number, string>>({});
  const [shareDate, setShareDate] = useState(todayIso());
  const [shareNote, setShareNote] = useState('');

  // fronted expense form
  const [feAmount, setFeAmount] = useState('');
  const [feDescription, setFeDescription] = useState('');
  const [feCategory, setFeCategory] = useState('Rent & utilities');
  const [feDate, setFeDate] = useState(todayIso());
  const [feNote, setFeNote] = useState('');
  const [feTreatAs, setFeTreatAs] = useState<'advance' | 'capital'>('advance');
  const [feFunders, setFeFunders] = useState<Array<{ ownerId: string; amount: string }>>([]);

  // generic movement form
  const [mAmount, setMAmount] = useState('');
  const [mAccountId, setMAccountId] = useState('');
  const [mDate, setMDate] = useState(todayIso());
  const [mNote, setMNote] = useState('');

  // statement
  const [statementFrom, setStatementFrom] = useState(monthStartIso());
  const [statementTo, setStatementTo] = useState(todayIso());
  const [statement, setStatement] = useState<StatementPayload | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  const activePartners = useMemo(() => (data?.partners ?? []).filter((partner) => partner.status === 'active'), [data]);
  const totals = useMemo(() => {
    const list = data?.partners ?? [];
    return {
      active: list.filter((partner) => partner.status === 'active').length,
      fronts: list.reduce((sum, partner) => sum + partner.month.fronts, 0),
      drawings: list.reduce((sum, partner) => sum + partner.month.drawings, 0),
      owed: list.reduce((sum, partner) => sum + partner.settleable, 0),
    };
  }, [data]);

  const openAddPartner = () => { setFormError(''); setNpName(''); setNpRole('Partner'); setNpShare('50'); setNpDate(todayIso()); setNpUserId('none'); setAddOpen(true); };
  const openShare = () => { if (!data) return; setFormError(''); setShareInputs(Object.fromEntries(data.partners.map((partner) => [partner.id, String(partner.share)]))); setShareDate(todayIso()); setShareNote(''); setShareOpen(true); };
  const openFronted = () => {
    setFormError(''); setFeAmount(''); setFeDescription(''); setFeCategory('Rent & utilities');
    setFeDate(todayIso()); setFeNote(''); setFeTreatAs('advance');
    const first = activePartners[0];
    setFeFunders(first ? [{ ownerId: String(first.id), amount: '' }] : []);
    setFrontedOpen(true);
  };
  const openMovement = (kind: MovementKind, partnerId: number) => {
    setFormError(''); setMovementKind(kind); setMovementPartnerId(partnerId);
    setMAmount(kind === 'reimburse'
      ? String(activePartners.find((partner) => partner.id === partnerId)?.frontedOutstanding ?? '')
      : '');
    setMAccountId(data?.accounts[0] ? String(data.accounts[0].id) : '');
    setMDate(todayIso()); setMNote('');
    setMovementOpen(true);
  };
  const openStatement = (partnerId: number) => { setStatementPartnerId(partnerId); setStatement(null); setStatementFrom(monthStartIso()); setStatementTo(todayIso()); setStatementOpen(true); };

  const savePartner = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(''); setBusy(true);
    try {
      const response = await fetch('/api/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: npName, role: npRole, share: Number(npShare), effectiveAt: npDate, userId: npUserId === 'none' ? null : Number(npUserId) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not add this partner.');
      sounds.shimmer();
      toast.success('Partner added', `${npName.trim()} is now on the partner list.`);
      setAddOpen(false);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not add this partner.');
    } finally { setBusy(false); }
  };

  const shareTotal = useMemo(() => Object.values(shareInputs).reduce((sum, value) => sum + (Number(value) || 0), 0), [shareInputs]);

  const saveShares = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!data) return;
    setBusy(true);
    try {
      const changes = data.partners.map((partner) => ({ ownerId: partner.id, share: Number(shareInputs[partner.id] ?? partner.share), effectiveAt: shareDate, note: shareNote }));
      const response = await fetch('/api/partners/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not record the share change.');
      sounds.shimmer();
      toast.success('Shares updated', `Share history recorded effective ${dateLabel(shareDate)}.`);
      setShareOpen(false);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not record the share change.');
    } finally { setBusy(false); }
  };

  const feTotal = feFunders.reduce((sum, funder) => sum + (Number.isFinite(Number(funder.amount)) ? Math.trunc(Number(funder.amount)) : 0), 0);
  const feAmountInt = Number.isFinite(Number(feAmount)) ? Math.trunc(Number(feAmount)) : 0;

  const splitFrontedEqually = () => {
    const total = feAmountInt;
    const count = feFunders.length;
    if (!total || total <= 0 || count === 0) return;
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    setFeFunders(feFunders.map((funder, index) => ({ ...funder, amount: String(base + (index < remainder ? 1 : 0)) })));
  };

  const saveFronted = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(''); setBusy(true);
    try {
      const splits = feFunders.map((funder) => ({ ownerId: Number(funder.ownerId), amount: Math.trunc(Number(funder.amount)) }));
      if (splits.some((split) => !Number.isSafeInteger(split.ownerId) || !Number.isSafeInteger(split.amount) || split.amount <= 0)) {
        throw new Error('Every funder needs a positive whole-number amount.');
      }
      if (splits.reduce((sum, split) => sum + split.amount, 0) !== feAmountInt) {
        throw new Error('Funder amounts must add up exactly to the expense.');
      }
      if (!feDescription.trim()) throw new Error('Add a description for this expense.');
      const response = await fetch('/api/partners/movement', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'expense-fronted', amount: feAmountInt, description: feDescription.trim(), category: feCategory, treatAs: feTreatAs, splits, transactionDate: feDate, note: feNote }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not save this expense.');
      sounds.shimmer();
      toast.ledger('Fronted expense saved', feTreatAs === 'advance' ? 'Partner will be owed this amount until reimbursed.' : 'Counted as partner capital.');
      setFrontedOpen(false);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this expense.');
    } finally { setBusy(false); }
  };

  const movementMeta = {
    drawing: { title: 'Counter drawing', hint: 'Cash this partner took from the till or an account.', confirm: 'Record drawing', max: null as number | null },
    contribution: { title: 'Add capital', hint: 'New money this partner invested in the business.', confirm: 'Record contribution', max: null },
    'capital-return': { title: 'Return capital', hint: 'Part of this partner’s capital paid back.', confirm: 'Record return', max: data?.partners.find((partner) => partner.id === movementPartnerId)?.capitalBalance ?? null },
    reimburse: { title: 'Reimburse partner', hint: 'Pay back expenses this partner fronted.', confirm: 'Record reimbursement', max: data?.partners.find((partner) => partner.id === movementPartnerId)?.frontedOutstanding ?? null },
  }[movementKind];

  const saveMovement = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(''); setBusy(true);
    try {
      const amount = Math.trunc(Number(mAmount));
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Amount must be a positive whole number of PKR.');
      if (movementMeta.max !== null && amount > movementMeta.max) throw new Error(`Amount exceeds the available maximum of ${money(movementMeta.max)}.`);
      const partnerId = movementPartnerId;
      if (!partnerId) throw new Error('Choose a valid partner.');
      const response = await fetch('/api/partners/movement', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: movementKind, partnerId, accountId: Number(mAccountId), amount, transactionDate: mDate, note: mNote }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not save this movement.');
      sounds.shimmer();
      toast.ledger('Saved to partner ledger', movementMeta.title);
      setMovementOpen(false);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this movement.');
    } finally { setBusy(false); }
  };

  const fetchStatement = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!statementPartnerId) return;
    setStatementLoading(true); setFormError('');
    try {
      const response = await fetch(`/api/partners/statement?ownerId=${statementPartnerId}&from=${statementFrom}&to=${statementTo}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not build the statement.');
      setStatement(payload as StatementPayload);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not build the statement.');
    } finally { setStatementLoading(false); }
  };

  const statementCsvHref = statementPartnerId ? `/api/partners/statement?ownerId=${statementPartnerId}&from=${statementFrom}&to=${statementTo}&format=csv` : '#';
  const movementPartner = activePartners.find((partner) => partner.id === movementPartnerId) ?? null;

  if (loadError) {
    return (<div className="app-shell" id="overview"><AppSidebar workspaceName="Hisaabook" businessType="Partners" userName={userName} userRole={role} current="partners" />
      <main className="main-area"><div className="content"><div className="empty-state" role="alert">{loadError}</div></div></main></div>);
  }
  if (!data) {
    return (<div className="app-shell" id="overview"><AppSidebar workspaceName="Hisaabook" businessType="Partners" userName={userName} userRole={role} current="partners" />
      <main className="main-area"><div className="content"><div className="empty-state">Loading partner records…</div></div></main></div>);
  }

  return (
    <div className="app-shell" id="overview">
      <AppSidebar workspaceName={data.workspace.name} businessType="Ownership & partner money" userName={userName} userRole={role} current="partners" />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><a href="/#overview" style={{ color: 'inherit', textDecoration: 'none' }}>Workspace</a><span aria-hidden="true">›</span><strong>Partners & shares</strong></div>
          <div className="top-actions"><span className="currency-badge">PRIVATE · PKR</span></div>
        </header>
        <div className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />Ownership & money</span>
              <h1 className="page-title">Partners & shares</h1>
              <p className="page-subtitle">Who fronts what, who draws from the counter, and what each partner is owed.</p>
            </div>
            <div className="inventory-heading-actions">
              {canManage && <button className="ghost-pill" onClick={openShare}><Scale size={13} /> Edit shares</button>}
              {canManage && <button className="lime-button" onClick={openAddPartner}><UserPlus size={15} strokeWidth={2.6} /> Add partner</button>}
            </div>
          </section>

          <div className="payroll-notice">
            <ShieldCheck size={17} />
            <span><strong>One running hisaab per partner.</strong> Fronting an expense credits the partner; a counter drawing debits them. The balance settles at profit distribution or when someone exits. Contributions build capital and are settled separately.</span>
          </div>

          <section className="stat-grid" aria-label="Partner money summary">
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Active partners</span><span className="stat-icon lime"><UsersRound size={16} /></span></div><div className="stat-value">{totals.active}</div><div className="stat-foot">Recorded shares in {data.workspace.name}</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Fronted this month</span><span className="stat-icon green"><Receipt size={16} /></span></div><div className="stat-value">{money(totals.fronts)}</div><div className="stat-foot">Business expenses paid from partner pockets</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Drawings this month</span><span className="stat-icon terra"><ArrowDownLeft size={16} /></span></div><div className="stat-value">{money(totals.drawings)}</div><div className="stat-foot">Taken from the counter and accounts</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Owed to partners</span><span className="stat-icon slate"><Wallet size={16} /></span></div><div className="stat-value">{signed(totals.owed)}</div><div className="stat-foot">{totals.owed >= 0 ? 'Fronts and appropriations net of drawings' : 'Partners have drawn more than they fronted'}</div></div>
          </section>

          {canEdit && (
            <section className="quick-actions" aria-label="Quick actions" style={{ marginTop: 14 }}>
              <button className="quick-action primary" onClick={openFronted}><span className="quick-action-icon"><Receipt size={17} /></span><span>Out of pocket</span></button>
              <button className="quick-action" onClick={() => openMovement('drawing', activePartners[0]?.id ?? (data.partners[0]?.id ?? 0))}><span className="quick-action-icon"><ArrowDownLeft size={17} /></span><span>Counter drawing</span></button>
              <button className="quick-action" onClick={() => openMovement('reimburse', activePartners[0]?.id ?? (data.partners[0]?.id ?? 0))}><span className="quick-action-icon"><HandCoins size={17} /></span><span>Reimburse</span></button>
            </section>
          )}

          <section className="grid gap-4 xl:grid-cols-2" style={{ marginTop: 14 }} aria-label="Partners">
            {data.partners.map((partner) => {
              const overdrawn = partner.settleable < 0;
              return (
                <article className="soft-card partner-card" key={partner.id}>
                  <div className="card-header-row">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="owner-avatar" aria-hidden="true">{initials(partner.name)}</span>
                      <div className="min-w-0">
                        <div className="owner-name" style={{ fontSize: 13 }}>{partner.name}{partner.name.trim().toLowerCase() === userName.trim().toLowerCase() && <span className="ml-1.5 text-[8px] font-bold uppercase tracking-wide text-[var(--faint)]">· You</span>}</div>
                        <div className="card-subtitle" style={{ marginTop: 2 }}>{partner.role}{partner.status === 'exited' ? ' · Exited' : ''}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="owner-share" style={{ fontSize: 17 }}>{Number(partner.share).toLocaleString('en-PK')}%</div>
                      <div className="card-subtitle" style={{ marginTop: 2 }}>Share · from {dateLabel(partner.effectiveAt)}</div>
                    </div>
                  </div>
                  <div className="owner-bar" style={{ marginTop: 10 }} aria-hidden="true"><span style={{ width: `${Math.min(100, Number(partner.share) || 0)}%` }} /></div>

                  <div className="partner-stats">
                    <div className="partner-stat"><span>Capital in</span><strong>{money(partner.capitalBalance)}</strong></div>
                    <div className="partner-stat"><span>{overdrawn ? 'Overdrawn by' : 'Owed to partner'}</span><strong className={overdrawn ? 'partner-negative' : 'partner-positive'}>{money(partner.settleable)}</strong></div>
                    <div className="partner-stat"><span>Drew this month</span><strong>{money(partner.month.drawings)}</strong></div>
                  </div>

                  {partner.lastMovements.length > 0 && (
                    <div className="partner-movements">
                      {partner.lastMovements.map((movement) => (
                        <div className="partner-movement-row" key={movement.id}>
                          <span className={`partner-movement-icon ${movement.direction === 'CREDIT' ? 'credit' : 'debit'}`}>{movement.direction === 'CREDIT' ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}</span>
                          <span className="partner-movement-text"><strong>{ENTRY_LABEL[movement.entryType] ?? movement.entryType}</strong><small>{dateLabel(movement.date)}{movement.note ? ` · ${movement.note}` : ''}</small></span>
                          <span className="partner-movement-amount">{movement.direction === 'CREDIT' ? '+' : '−'}{money(movement.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="partner-actions">
                    {canEdit && <button className="ghost-pill" onClick={() => { setFormError(''); setFrontedOpen(true); setFeFunders([{ ownerId: String(partner.id), amount: '' }]); }}><Receipt size={12} /> Out of pocket</button>}
                    {canEdit && <button className="ghost-pill" onClick={() => openMovement('drawing', partner.id)}><ArrowDownLeft size={12} /> Counter drawing</button>}
                    {canEdit && <button className="ghost-pill" onClick={() => openMovement('reimburse', partner.id)}><HandCoins size={12} /> Reimburse{partner.frontedOutstanding > 0 ? ` (${money(partner.frontedOutstanding)})` : ''}</button>}
                    {canEdit && <button className="ghost-pill" onClick={() => openMovement('contribution', partner.id)}><Plus size={12} /> Add capital</button>}
                    <button className="ghost-pill" onClick={() => openStatement(partner.id)}><Printer size={12} /> Statement</button>
                    {canEdit && partner.capitalBalance > 0 && <button className="text-link" style={{ fontSize: 10 }} onClick={() => openMovement('capital-return', partner.id)}>Return capital <ArrowRight size={12} /></button>}
                  </div>
                </article>
              );
            })}
            {data.partners.length === 0 && (
              <div className="soft-card" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-state">No partners recorded yet. Add the first partner to start the running hisaab.</div>
                {canManage && <div style={{ textAlign: 'center', paddingBottom: 18 }}><button className="lime-button" onClick={openAddPartner}><UserPlus size={15} strokeWidth={2.6} /> Add partner</button></div>}
              </div>
            )}
          </section>

          <p className="footer-note" id="about">Hisaabook records the shares and terms you agree. For bookkeeping reference only, not legal, tax, or accounting advice.</p>
        </div>
      </main>

      {/* Add partner dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Add a partner</DialogTitle>
            <DialogDescription>Partners can have shares recorded without app accounts. Link one if they should see their own statement.</DialogDescription>
          </DialogHeader>
          <form onSubmit={savePartner} className="form-grid" style={{ marginTop: 4 }}>
            <div className="form-field full"><Label htmlFor="np-name">Full name</Label><Input id="np-name" required maxLength={80} value={npName} onChange={(event) => setNpName(event.target.value)} placeholder="e.g. Hamza Malik" className="h-11 rounded-xl" /></div>
            <div className="form-field"><Label htmlFor="np-role">Role title</Label><Input id="np-role" maxLength={40} value={npRole} onChange={(event) => setNpRole(event.target.value)} placeholder="Partner" className="h-11 rounded-xl" /></div>
            <div className="form-field"><Label htmlFor="np-share">Share (%)</Label><Input id="np-share" type="number" min="0" max="100" step="0.5" required value={npShare} onChange={(event) => setNpShare(event.target.value)} className="h-11 rounded-xl" /></div>
            <div className="form-field"><Label htmlFor="np-date">Share effective from</Label><Input id="np-date" type="date" required value={npDate} onChange={(event) => setNpDate(event.target.value)} className="h-11 rounded-xl" /></div>
            <div className="form-field full"><Label htmlFor="np-user">Link workspace member (optional)</Label>
              <Select value={npUserId} onValueChange={setNpUserId}>
                <SelectTrigger id="np-user" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">No app account</SelectItem>{data.members.map((member) => <SelectItem key={member.userId} value={String(member.userId)}>{member.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {formError && <p className="form-field full form-error" role="alert">{formError}</p>}
            <DialogFooter className="form-field full sm:justify-end"><Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setAddOpen(false)}>Cancel</Button><button type="submit" className="lime-button" disabled={busy}>{busy ? 'Saving…' : 'Add partner'}</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Share change dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Record share change</DialogTitle>
            <DialogDescription>Changes are effective-dated and kept as history. Historical profit splits always recompute from these rows.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveShares} className="form-grid" style={{ marginTop: 4 }}>
            <div className="form-field full"><Label htmlFor="share-date">Effective from</Label><Input id="share-date" type="date" required value={shareDate} onChange={(event) => setShareDate(event.target.value)} className="h-11 rounded-xl" /></div>
            {data.partners.map((partner) => (
              <div className="form-field" key={partner.id}>
                <Label htmlFor={`share-${partner.id}`}>{partner.name.split(' ')[0]} (%)</Label>
                <Input id={`share-${partner.id}`} type="number" min="0" max="100" step="0.5" required value={shareInputs[partner.id] ?? ''} onChange={(event) => setShareInputs({ ...shareInputs, [partner.id]: event.target.value })} className="h-11 rounded-xl" />
              </div>
            ))}
            <div className="form-field full"><Label htmlFor="share-note">Note</Label><Input id="share-note" maxLength={200} value={shareNote} onChange={(event) => setShareNote(event.target.value)} placeholder="e.g. Sara buys 5% more from Areeba" className="h-11 rounded-xl" /></div>
            <p className={`form-field full text-[10px] font-bold ${Math.abs(shareTotal - 100) < 0.001 ? 'text-[var(--positive)]' : 'text-[#b45309]'}`}>Shares total {shareTotal.toLocaleString('en-PK')}%{Math.abs(shareTotal - 100) < 0.001 ? '' : '. Not 100% is allowed, distributions will ask you to confirm.'}</p>
            {formError && <p className="form-field full form-error" role="alert">{formError}</p>}
            <DialogFooter className="form-field full sm:justify-end"><Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setShareOpen(false)}>Cancel</Button><button type="submit" className="lime-button" disabled={busy}>{busy ? 'Saving…' : 'Record shares'}</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fronted expense dialog */}
      <Dialog open={frontedOpen} onOpenChange={setFrontedOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Partner paid out of pocket</DialogTitle>
            <DialogDescription>Records the business expense and credits the paying partner. Advance stays reimbursable; capital does not.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveFronted} className="form-grid" style={{ marginTop: 4 }}>
            <div className="form-field full"><Label htmlFor="fe-description">What was it for?</Label><Input id="fe-description" required maxLength={160} value={feDescription} onChange={(event) => setFeDescription(event.target.value)} placeholder="e.g. Electricity bill, Unit 2" className="h-11 rounded-xl" autoFocus /></div>
            <div className="form-field"><Label htmlFor="fe-amount">Amount (PKR)</Label><Input id="fe-amount" type="number" min="1" step="1" required placeholder="e.g. 18,500" value={feAmount} onChange={(event) => setFeAmount(event.target.value)} className="h-11 rounded-xl" /></div>
            <div className="form-field"><Label htmlFor="fe-date">Date</Label><Input id="fe-date" type="date" required value={feDate} onChange={(event) => setFeDate(event.target.value)} className="h-11 rounded-xl" /></div>
            <div className="form-field"><Label htmlFor="fe-category">Category</Label>
              <Select value={feCategory} onValueChange={setFeCategory}><SelectTrigger id="fe-category" className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{FRONT_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="form-field"><Label htmlFor="fe-treat">Count as</Label>
              <Select value={feTreatAs} onValueChange={(value) => setFeTreatAs(value as 'advance' | 'capital')}><SelectTrigger id="fe-treat" className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="advance">Advance, reimbursable</SelectItem><SelectItem value="capital">Partner capital</SelectItem></SelectContent></Select>
            </div>

            <div className="form-field full">
              <div className="flex items-center justify-between gap-2"><Label>Who paid, and how much</Label><button type="button" className="text-link" style={{ fontSize: 10 }} onClick={splitFrontedEqually}>Split equally</button></div>
              <div className="mt-2 grid gap-2">
                {feFunders.map((funder, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select value={funder.ownerId} onValueChange={(value) => setFeFunders(feFunders.map((row, i) => i === index ? { ...row, ownerId: value } : row))}>
                      <SelectTrigger aria-label={`Funder ${index + 1}`} className="h-11 flex-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{activePartners.map((partner) => <SelectItem key={partner.id} value={String(partner.id)}>{partner.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min="1" step="1" aria-label={`Funder ${index + 1} amount`} placeholder="0" value={funder.amount} onChange={(event) => setFeFunders(feFunders.map((row, i) => i === index ? { ...row, amount: event.target.value } : row))} className="h-11 w-28 rounded-xl tabular-nums" />
                    {feFunders.length > 1 && <button type="button" className="ghost-icon-button" aria-label="Remove funder" onClick={() => setFeFunders(feFunders.filter((_, i) => i !== index))}><X size={14} /></button>}
                  </div>
                ))}
              </div>
              {feFunders.length < activePartners.length && feFunders.length > 0 && (
                <button type="button" className="text-link" style={{ fontSize: 10, marginTop: 8 }} onClick={() => setFeFunders([...feFunders, { ownerId: String(activePartners.find((partner) => !feFunders.some((funder) => funder.ownerId === String(partner.id)))?.id ?? ''), amount: '' }])}><Plus size={11} /> Another partner paid part of it</button>
              )}
              <p className={`mt-2 text-[10px] font-bold ${feAmountInt > 0 && feTotal === feAmountInt ? 'text-[var(--positive)]' : 'text-[var(--muted)]'}`}>Funders total ₨ {feTotal.toLocaleString('en-PK')}{feAmountInt > 0 ? ` of ₨ ${feAmountInt.toLocaleString('en-PK')}` : ''}</p>
            </div>

            <div className="form-field full"><Label htmlFor="fe-note">Note (optional)</Label><Input id="fe-note" maxLength={1000} value={feNote} onChange={(event) => setFeNote(event.target.value)} placeholder="Receipt, bill number, anything auditors should see" className="h-11 rounded-xl" /></div>
            {formError && <p className="form-field full form-error" role="alert">{formError}</p>}
            <DialogFooter className="form-field full sm:justify-end"><Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setFrontedOpen(false)}>Cancel</Button><button type="submit" className="lime-button" disabled={busy || feFunders.length === 0 || feTotal !== feAmountInt || feAmountInt <= 0}>{busy ? 'Saving…' : 'Save out of pocket'}</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generic movement dialog (drawing / contribution / capital-return / reimburse) */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">{movementMeta.title}</DialogTitle>
            <DialogDescription>{movementMeta.hint}{movementPartner ? ` Partner: ${movementPartner.name}.` : ''}</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveMovement} className="form-grid" style={{ marginTop: 4 }}>
            <div className="form-field full"><Label htmlFor="m-amount">Amount (PKR)</Label><Input id="m-amount" type="number" min="1" step="1" required inputMode="numeric" placeholder="e.g. 25,000" value={mAmount} onChange={(event) => setMAmount(event.target.value)} className="h-12 rounded-xl text-lg font-extrabold tracking-tight" autoFocus />
              {movementMeta.max !== null && <span className="field-hint">Available maximum: {money(movementMeta.max)}</span>}
            </div>
            <div className="form-field"><Label htmlFor="m-account">{movementKind === 'contribution' ? 'Paid into' : 'Paid from'}</Label>
              <Select value={mAccountId} onValueChange={setMAccountId}><SelectTrigger id="m-account" className="h-11 rounded-xl"><SelectValue placeholder="Choose account" /></SelectTrigger><SelectContent>{data.accounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="form-field"><Label htmlFor="m-date">Date</Label><Input id="m-date" type="date" required value={mDate} onChange={(event) => setMDate(event.target.value)} className="h-11 rounded-xl" /></div>
            <div className="form-field full"><Label htmlFor="m-note">Note (optional)</Label><Input id="m-note" maxLength={1000} value={mNote} onChange={(event) => setMNote(event.target.value)} placeholder="Why, and against which bill" className="h-11 rounded-xl" /></div>
            {formError && <p className="form-field full form-error" role="alert">{formError}</p>}
            <DialogFooter className="form-field full sm:justify-end"><Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setMovementOpen(false)}>Cancel</Button><button type="submit" className="lime-button" disabled={busy}>{busy ? 'Saving…' : movementMeta.confirm}</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Statement dialog */}
      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Partner statement</DialogTitle>
            <DialogDescription>Every entry between the firm and this partner, with running balances. Print it or take the CSV.</DialogDescription>
          </DialogHeader>
          <form onSubmit={fetchStatement} className="flex flex-wrap items-end gap-2" style={{ marginTop: 4 }}>
            <div><Label htmlFor="st-from">From</Label><Input id="st-from" type="date" required value={statementFrom} onChange={(event) => setStatementFrom(event.target.value)} className="mt-1 h-11 rounded-xl" /></div>
            <div><Label htmlFor="st-to">To</Label><Input id="st-to" type="date" required value={statementTo} onChange={(event) => setStatementTo(event.target.value)} className="mt-1 h-11 rounded-xl" /></div>
            <button type="submit" className="lime-button" disabled={statementLoading}>{statementLoading ? 'Building…' : 'Build'}</button>
            <a className="ghost-pill" href={statementCsvHref} download><Download size={12} /> CSV</a>
          </form>
          {formError && <p className="form-error" role="alert" style={{ marginTop: 8 }}>{formError}</p>}
          {statement && (
            <div className="statement-print" style={{ marginTop: 12 }}>
              <div className="statement-meta">
                <div><strong>{statement.partner.name}</strong> · {statement.partner.role}</div>
                <div className="table-muted">{dateLabel(statement.from)} to {dateLabel(statement.to)} · Opening current {signed(statement.opening.current)} · Capital {signed(statement.opening.capital)}</div>
              </div>
              <div className="statement-summary"><span>Fronted {money(statement.summary.fronted)}</span><span>Reimbursed {money(statement.summary.reimbursed)}</span><span>Drawings {money(statement.summary.drawings)}</span></div>
              <div className="data-table-wrap" style={{ marginTop: 8 }}>
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Entry</th><th>Amount</th><th>Balance</th></tr></thead>
                  <tbody>{statement.rows.map((row) => (
                    <tr key={row.id}><td className="table-muted">{dateLabel(row.date)}</td><td><div className="cell-title" style={{ fontSize: 10 }}>{row.label}</div>{row.note && <div className="cell-sub">{row.note}</div>}</td><td className="cell-num">{row.direction === 'CREDIT' ? '+' : '−'}{money(row.amount)}</td><td className="cell-num">{signed(row.bucket === 'capital' ? row.runningCapital : row.runningCurrent)}</td></tr>
                  ))}</tbody>
                </table>
                {statement.rows.length === 0 && <div className="empty-state">No entries in this period.</div>}
              </div>
              <div className="statement-closing">Closing current {signed(statement.closing.current)} · Capital {signed(statement.closing.capital)}</div>
              <div className="no-print" style={{ marginTop: 10, textAlign: 'right' }}><button className="ghost-pill" onClick={() => window.print()}><Printer size={12} /> Print statement</button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
