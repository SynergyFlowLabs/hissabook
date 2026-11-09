'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Download, HandCoins, History, LogOut, PieChart, Plus, Printer,
  SlidersHorizontal, Receipt, Scale, ShieldCheck, UserPlus, UsersRound, Wallet, X,
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
  accruedEstimate: number;
  drawingsLifetime: number;
};
type Account = { id: number; name: string; type: string; currency: string };
type Member = { userId: number; name: string };
type DeedSettings = {
  partnerSalaryEnabled: boolean;
  interestOnCapitalEnabled: boolean;
  interestOnCapitalPct: number | null;
  interestOnDrawingsEnabled: boolean;
  interestOnDrawingsPct: number | null;
  drawingCapPct: number;
  settlementMethod: 'PAY' | 'LOAN';
};
type Overview = {
  workspace: { id: number; name: string; businessType: string; currency: string };
  accounts: Account[];
  partners: Partner[];
  members: Member[];
  settings: DeedSettings;
};
type WorkingsPayload = {
  from: string; to: string; days: number; lossPeriod: boolean; basisProfit: number;
  segments: Array<{ from: string; to: string; days: number; shares: Array<{ ownerId: number; share: number }> }>;
  psr: Array<{ ownerId: number; name: string; ratio: number; weight: number }>;
  salaries: Array<{ ownerId: number; name: string; amount: number }>;
  salaryTotal: number; salaryCapped: boolean;
  capitals: Array<{ ownerId: number; name: string; openingCapital: number; interest: number }>;
  interestCapitalTotal: number; interestCapitalCapped: boolean;
  drawingsInterest: Array<{ ownerId: number; name: string; interest: number }>;
  interestDrawingsTotal: number;
  residual: number; shareMismatchTotal: number;
  lines: Array<{ ownerId: number; name: string; salary: number; interestCapital: number; interestDrawings: number; share: number; total: number }>;
  roundingNote: string; notes: string[];
};
type DistributionItem = { id: number; periodFrom: string; periodTo: string; basisProfit: number; residual: number; status: 'POSTED' | 'VOID'; note: string; createdBy: string; createdAt: string };
type SettlementPayload = {
  partner: { id: number; name: string };
  asOf: string;
  mode: 'PAY' | 'LOAN';
  psr: Array<{ ownerId: number; name: string; ratio: number }>;
  continuing: Array<{ ownerId: number; name: string; absorbed: number }>;
  exitDistribution: null | { from: string; to: string; basisProfit: number; residual: number; lossPeriod: boolean; share: number; posted: boolean; distributionId: number | null };
  capitalBalance: number;
  currentPosition: number;
  undistributedShare: number;
  revaluations: Array<{ description: string; delta: number; share: number; allocations: Array<{ ownerId: number; name: string; amount: number }> }>;
  revaluationTotal: number;
  revaluationShare: number;
  goodwillValue: number;
  goodwillMethod: 'RAISE_WRITEOFF' | 'CASH_ADJUSTMENT';
  goodwillShare: number;
  currentSettled: number;
  capitalReturned: number;
  totalDue: number;
  firmPays: number;
  partnerOwes: number;
  shareMismatchTotal: number;
  notes: string[];
};
type ExitRevaluationRow = { id: number; description: string; delta: string };
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
type LegacyEntry = {
  transactionId: number;
  type: 'CONTRIBUTION' | 'WITHDRAWAL';
  amount: number;
  description: string;
  category: string;
  accountName: string;
  date: string;
  note: string;
  createdBy: string;
};

const money = (amount: number) => `PKR ${Math.abs(Math.round(amount)).toLocaleString('en-PK')}`;
const signed = (amount: number) => `${amount < 0 ? '−' : ''}PKR ${Math.abs(Math.round(amount)).toLocaleString('en-PK')}`;
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

  // deed settings dialog
  const [deedOpen, setDeedOpen] = useState(false);
  const [deedSalary, setDeedSalary] = useState(false);
  const [deedICap, setDeedICap] = useState(false);
  const [deedICapPct, setDeedICapPct] = useState('6');
  const [deedIDraw, setDeedIDraw] = useState(false);
  const [deedIDrawPct, setDeedIDrawPct] = useState('12');
  const [deedCap, setDeedCap] = useState('70');
  const [deedMethod, setDeedMethod] = useState<'PAY' | 'LOAN'>('PAY');

  // distribution dialog + history
  const [distOpen, setDistOpen] = useState(false);
  const [distFrom, setDistFrom] = useState(monthStartIso());
  const [distTo, setDistTo] = useState(todayIso());
  const [distPreset, setDistPreset] = useState<'month' | 'lastMonth' | 'quarter' | 'custom'>('month');
  const [salaryInputs, setSalaryInputs] = useState<Record<number, string>>({});
  const [distNote, setDistNote] = useState('');
  const [distPreview, setDistPreview] = useState<{ workings: WorkingsPayload; overlapDistributionId: number | null } | null>(null);
  const [distBusy, setDistBusy] = useState(false);
  const [distError, setDistError] = useState('');
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [distributions, setDistributions] = useState<DistributionItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [voidTarget, setVoidTarget] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);

  // exit settlement dialog
  const [exitOpen, setExitOpen] = useState(false);
  const [exitPartnerId, setExitPartnerId] = useState<number | null>(null);
  const [exitAsOf, setExitAsOf] = useState(todayIso());
  const [exitMode, setExitMode] = useState<'PAY' | 'LOAN'>('PAY');
  const [exitGoodwill, setExitGoodwill] = useState('0');
  const [exitGoodwillMethod, setExitGoodwillMethod] = useState<'RAISE_WRITEOFF' | 'CASH_ADJUSTMENT'>('RAISE_WRITEOFF');
  const [exitRevaluations, setExitRevaluations] = useState<ExitRevaluationRow[]>([]);
  const [exitRevaluationId, setExitRevaluationId] = useState(1);
  const [exitPreview, setExitPreview] = useState<SettlementPayload | null>(null);
  const [exitBusy, setExitBusy] = useState(false);
  const [exitError, setExitError] = useState('');
  const [exitConfirmMismatch, setExitConfirmMismatch] = useState(false);

  // legacy unattributed (pre-partners) rows
  const [legacyEntries, setLegacyEntries] = useState<LegacyEntry[]>([]);
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyChoice, setLegacyChoice] = useState<Record<number, string>>({});
  const [legacyBusyId, setLegacyBusyId] = useState<number | null>(null);
  const [legacyShowAll, setLegacyShowAll] = useState(false);

  // Remember what opened a dialog so focus lands back on it after Esc/close.
  const openerRef = useRef<HTMLElement | null>(null);
  const rememberOpener = () => { if (typeof document !== 'undefined') openerRef.current = document.activeElement as HTMLElement | null; };
  const restoreOpener = () => {
    const target = openerRef.current;
    openerRef.current = null;
    if (target && typeof target.focus === 'function') {
      window.setTimeout(() => target.focus({ preventScroll: true }), 0);
    }
  };

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

  const openAddPartner = () => { rememberOpener(); setFormError(''); setNpName(''); setNpRole('Partner'); setNpShare('50'); setNpDate(todayIso()); setNpUserId('none'); setAddOpen(true); };
  const openShare = () => { if (!data) return; rememberOpener(); setFormError(''); setShareInputs(Object.fromEntries(data.partners.map((partner) => [partner.id, String(partner.share)]))); setShareDate(todayIso()); setShareNote(''); setShareOpen(true); };
  const openFronted = () => {
    rememberOpener();
    setFormError(''); setFeAmount(''); setFeDescription(''); setFeCategory('Rent & utilities');
    setFeDate(todayIso()); setFeNote(''); setFeTreatAs('advance');
    const first = activePartners[0];
    setFeFunders(first ? [{ ownerId: String(first.id), amount: '' }] : []);
    setFrontedOpen(true);
  };
  const openMovement = (kind: MovementKind, partnerId: number) => {
    rememberOpener();
    setFormError(''); setMovementKind(kind); setMovementPartnerId(partnerId);
    setMAmount(kind === 'reimburse'
      ? String(activePartners.find((partner) => partner.id === partnerId)?.frontedOutstanding ?? '')
      : '');
    setMAccountId(data?.accounts[0] ? String(data.accounts[0].id) : '');
    setMDate(todayIso()); setMNote('');
    setMovementOpen(true);
  };
  const openStatement = (partnerId: number) => { rememberOpener(); setStatementPartnerId(partnerId); setStatement(null); setStatementFrom(monthStartIso()); setStatementTo(todayIso()); setStatementOpen(true); };

  const loadDistributions = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/partners/distribution', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) setDistributions(Array.isArray(payload.distributions) ? payload.distributions : []);
    } catch {
      // history is non-critical; keep silence and leave the list empty
    } finally { setHistoryLoading(false); }
  }, []);

  const loadLegacy = useCallback(async () => {
    setLegacyLoading(true);
    try {
      const response = await fetch('/api/partners/legacy', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        const entries = Array.isArray(payload.entries) ? payload.entries as LegacyEntry[] : [];
        setLegacyEntries(entries);
        setLegacyChoice((current) => {
          const next: Record<number, string> = {};
          for (const entry of entries) {
            const kept = current[entry.transactionId];
            next[entry.transactionId] = kept && kept !== 'none' ? kept : '';
          }
          return next;
        });
      }
    } catch {
      // The tray is auxiliary: a failure must never block the partner page.
    } finally { setLegacyLoading(false); }
  }, []);

  const attributeLegacy = async (entry: LegacyEntry) => {
    const chosen = legacyChoice[entry.transactionId];
    const ownerId = Number(chosen);
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
      toast.info('Choose a partner first', 'Pick whose money this row is, then tag it. Nothing is guessed from names.');
      return;
    }
    setLegacyBusyId(entry.transactionId);
    try {
      const response = await fetch('/api/partners/legacy', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: entry.transactionId, ownerId }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not attribute this row.');
      sounds.shimmer();
      toast.success('Legacy row attributed', `${entry.type === 'CONTRIBUTION' ? 'Capital contribution' : 'Counter drawing'} of ${money(entry.amount)} is now on ${payload.partnerName ?? 'the partner'}'s hisaab.`);
      await load();
      await loadLegacy();
    } catch (error) {
      toast.info('Could not attribute this row', error instanceof Error ? error.message : 'Please try again.');
    } finally { setLegacyBusyId(null); }
  };

  useEffect(() => {
    if (!data) return;
    void loadDistributions();
    if (canManage) void loadLegacy();
    // load once when the page data is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(data)]);

  const openDeed = () => {
    if (!data) return;
    rememberOpener();
    setFormError('');
    setDeedSalary(data.settings.partnerSalaryEnabled);
    setDeedICap(data.settings.interestOnCapitalEnabled);
    setDeedICapPct(String(data.settings.interestOnCapitalPct ?? 6));
    setDeedIDraw(data.settings.interestOnDrawingsEnabled);
    setDeedIDrawPct(String(data.settings.interestOnDrawingsPct ?? 12));
    setDeedCap(String(data.settings.drawingCapPct));
    setDeedMethod(data.settings.settlementMethod);
    setDeedOpen(true);
  };

  const saveDeed = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(''); setBusy(true);
    try {
      const response = await fetch('/api/partners/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerSalaryEnabled: deedSalary,
          interestOnCapitalEnabled: deedICap,
          interestOnCapitalPct: deedICap ? Number(deedICapPct) : null,
          interestOnDrawingsEnabled: deedIDraw,
          interestOnDrawingsPct: deedIDraw ? Number(deedIDrawPct) : null,
          drawingCapPct: Number(deedCap),
          settlementMethod: deedMethod,
        }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not save the deed settings.');
      sounds.shimmer();
      toast.success('Deed settings saved', 'Future distributions use these terms.');
      setDeedOpen(false);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the deed settings.');
    } finally { setBusy(false); }
  };

  const quarterStartIso = () => {
    const now = new Date();
    const quarterFirstMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(Date.UTC(now.getFullYear(), quarterFirstMonth, 1)).toISOString().slice(0, 10);
  };
  const lastMonthRange = () => {
    const now = new Date();
    const first = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
    const last = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0));
    return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
  };
  const applyDistPreset = (preset: 'month' | 'lastMonth' | 'quarter' | 'custom') => {
    setDistPreset(preset);
    setDistPreview(null);
    setDistError('');
    if (preset === 'month') { setDistFrom(monthStartIso()); setDistTo(todayIso()); }
    else if (preset === 'lastMonth') { const range = lastMonthRange(); setDistFrom(range.from); setDistTo(range.to); }
    else if (preset === 'quarter') { setDistFrom(quarterStartIso()); setDistTo(todayIso()); }
  };

  const openDistribution = () => {
    if (!data) return;
    rememberOpener();
    setDistError(''); setDistPreview(null); setDistNote(''); setConfirmMismatch(false);
    setSalaryInputs(Object.fromEntries(activePartners.map((partner) => [partner.id, ''])));
    applyDistPreset('month');
    setDistOpen(true);
  };

  const salariesQuery = () => Object.entries(salaryInputs)
    .map(([id, amount]) => [Number(id), Math.trunc(Number(amount))] as const)
    .filter(([, amount]) => Number.isSafeInteger(amount) && amount > 0)
    .map(([id, amount]) => `${id}:${amount}`)
    .join(',');

  const buildPreview = async () => {
    setDistBusy(true); setDistError('');
    try {
      const query = new URLSearchParams({ from: distFrom, to: distTo });
      const salaries = salariesQuery();
      if (salaries) query.set('salaries', salaries);
      const response = await fetch(`/api/partners/distribution/preview?${query.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not build the preview.');
      setDistPreview(payload as { workings: WorkingsPayload; overlapDistributionId: number | null });
      setConfirmMismatch(false);
    } catch (error) {
      setDistPreview(null);
      setDistError(error instanceof Error ? error.message : 'Could not build the preview.');
    } finally { setDistBusy(false); }
  };

  const postDistribution = async () => {
    if (!distPreview) return;
    setDistBusy(true); setDistError('');
    try {
      const salaries = Object.entries(salaryInputs)
        .map(([id, amount]) => ({ ownerId: Number(id), amount: Math.trunc(Number(amount)) }))
        .filter((item) => Number.isSafeInteger(item.amount) && item.amount > 0);
      const response = await fetch('/api/partners/distribution', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: distPreview.workings.from, to: distPreview.workings.to, salaries, note: distNote, confirmShareMismatch: confirmMismatch }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not post the distribution.');
      sounds.shimmer();
      toast.success('Profit distributed', `${money(payload.residual ?? distPreview.workings.residual)} appropriated and posted to the partner ledgers.`);
      setDistOpen(false);
      await load();
      await loadDistributions();
    } catch (error) {
      setDistError(error instanceof Error ? error.message : 'Could not post the distribution.');
    } finally { setDistBusy(false); }
  };

  const confirmVoid = async () => {
    if (voidTarget === null) return;
    setVoidBusy(true);
    try {
      const response = await fetch(`/api/partners/distribution/${voidTarget}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: voidReason }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not void the distribution.');
      sounds.shimmer();
      toast.success('Distribution voided', 'Reversing correction rows were posted to every affected partner ledger.');
      setVoidTarget(null);
      setVoidReason('');
      await load();
      await loadDistributions();
    } catch (error) {
      toast.info('Could not void', error instanceof Error ? error.message : 'Please try again.');
    } finally { setVoidBusy(false); }
  };

  const exitPartner = useMemo(() => (data?.partners ?? []).find((partner) => partner.id === exitPartnerId) ?? null, [data, exitPartnerId]);
  const openExit = (partnerId: number) => {
    if (!data) return;
    rememberOpener();
    setExitPartnerId(partnerId); setExitAsOf(todayIso()); setExitMode(data.settings.settlementMethod);
    setExitGoodwill('0'); setExitGoodwillMethod('RAISE_WRITEOFF'); setExitRevaluations([]); setExitRevaluationId(1);
    setExitPreview(null); setExitError(''); setExitConfirmMismatch(false); setExitOpen(true);
  };
  const revaluationsQuery = () => JSON.stringify(
    exitRevaluations
      .map((line) => ({ description: line.description.trim(), delta: Math.trunc(Number(line.delta)) }))
      .filter((line) => line.description.length > 0 && Number.isSafeInteger(line.delta) && line.delta !== 0),
  );
  const goodwillInt = Number.isFinite(Number(exitGoodwill)) ? Math.max(0, Math.trunc(Number(exitGoodwill))) : 0;
  const buildSettlementPreview = async () => {
    if (exitPartnerId === null) return;
    setExitBusy(true); setExitError('');
    try {
      const query = new URLSearchParams({ partnerId: String(exitPartnerId), asOf: exitAsOf, goodwillValue: String(goodwillInt), goodwillMethod: exitGoodwillMethod, mode: exitMode });
      const revaluations = revaluationsQuery();
      if (revaluations && revaluations !== '[]') query.set('revaluations', revaluations);
      const response = await fetch(`/api/partners/settlement/preview?${query.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not build the settlement preview.');
      setExitPreview(payload.workings as SettlementPayload);
      setExitConfirmMismatch(false);
    } catch (error) {
      setExitPreview(null);
      setExitError(error instanceof Error ? error.message : 'Could not build the settlement preview.');
    } finally { setExitBusy(false); }
  };
  const confirmSettlement = async () => {
    if (!exitPreview || exitPartnerId === null) return;
    setExitBusy(true); setExitError('');
    try {
      const response = await fetch('/api/partners/settlement', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: exitPartnerId, asOf: exitPreview.asOf, goodwillValue: exitPreview.goodwillValue, goodwillMethod: exitPreview.goodwillMethod, mode: exitPreview.mode,
          revaluations: exitRevaluations.map((line) => ({ description: line.description.trim(), delta: Math.trunc(Number(line.delta)) })).filter((line) => line.description && Number.isFinite(line.delta) && line.delta !== 0),
          confirmShareMismatch: exitConfirmMismatch,
        }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not post the settlement.');
      sounds.shimmer();
      toast.success('Exit settlement posted', exitPreview.firmPays > 0
        ? `${money(exitPreview.firmPays)} is owed to ${exitPreview.partner.name}${payload.loanCreated ? ' (booked as a loan payable)' : ''}. Their ledger is closed.`
        : exitPreview.partnerOwes > 0
          ? `${money(exitPreview.partnerOwes)} is owed by ${exitPreview.partner.name} (tracked as a loan receivable). Their ledger is closed.`
          : 'The partner settles at zero; their ledger is closed.');
      setExitOpen(false);
      await load();
      await loadDistributions();
    } catch (error) {
      setExitError(error instanceof Error ? error.message : 'Could not post the settlement.');
    } finally { setExitBusy(false); }
  };

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
      if (payload.capWarning) {
        toast.info('Over the drawing cap', `Lifetime drawings now PKR ${Number(payload.capWarning.drawnAfter).toLocaleString('en-PK')} vs a ${payload.capWarning.capPct}% cap on PKR ${Number(payload.capWarning.accrued).toLocaleString('en-PK')} accrued. Recorded in the audit log.`);
      } else {
        toast.ledger('Saved to partner ledger', movementMeta.title);
      }
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
  const drawingCapWarning = (() => {
    if (movementKind !== 'drawing' || !movementPartner || !data) return null;
    const amount = Math.trunc(Number(mAmount));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const accrued = movementPartner.accruedEstimate;
    if (accrued <= 0) return null;
    const drawnAfter = movementPartner.drawingsLifetime + amount;
    const capAmount = (data.settings.drawingCapPct / 100) * accrued;
    return drawnAfter > capAmount ? { drawnAfter, capPct: data.settings.drawingCapPct, capAmount: Math.floor(capAmount), accrued } : null;
  })();

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
              <a className="ghost-pill" href="/api/partners/movements?format=csv" download><Download size={13} /> Movements CSV</a>
              {canManage && <button className="ghost-pill" onClick={openDistribution}><PieChart size={13} /> Distribute profit</button>}
              {canManage && <button className="ghost-pill" onClick={openDeed}><SlidersHorizontal size={13} /> Deed terms</button>}
              {canManage && <button className="ghost-pill" onClick={openShare}><Scale size={13} /> Edit shares</button>}
              {canManage && <button className="lime-button" onClick={openAddPartner}><UserPlus size={15} strokeWidth={2.6} /> Add partner</button>}
            </div>
          </section>

          <div className="deed-chips" aria-label="Current deed terms">
            <span className="deed-chip-label">Deed</span>
            <button type="button" className="deed-chip" onClick={canManage ? openDeed : undefined} disabled={!canManage}>Salaries {data.settings.partnerSalaryEnabled ? 'on' : 'off'}</button>
            <button type="button" className="deed-chip" onClick={canManage ? openDeed : undefined} disabled={!canManage}>Interest on capital {data.settings.interestOnCapitalEnabled ? `${data.settings.interestOnCapitalPct ?? 0}% p.a.` : 'off'}</button>
            <button type="button" className="deed-chip" onClick={canManage ? openDeed : undefined} disabled={!canManage}>Interest on drawings {data.settings.interestOnDrawingsEnabled ? `${data.settings.interestOnDrawingsPct ?? 0}% p.a.` : 'off'}</button>
            <button type="button" className="deed-chip" onClick={canManage ? openDeed : undefined} disabled={!canManage}>Drawing cap {data.settings.drawingCapPct}%</button>
            <button type="button" className="deed-chip" onClick={canManage ? openDeed : undefined} disabled={!canManage}>Exit mode {data.settings.settlementMethod === 'LOAN' ? 'loan' : 'pay'}</button>
          </div>

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

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" style={{ marginTop: 14 }} aria-label="Partners">
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
                    {canEdit && partner.status === 'active' && <button className="ghost-pill" onClick={() => { setFormError(''); setFrontedOpen(true); setFeFunders([{ ownerId: String(partner.id), amount: '' }]); }}><Receipt size={12} /> Out of pocket</button>}
                    {canEdit && partner.status === 'active' && <button className="ghost-pill" onClick={() => openMovement('drawing', partner.id)}><ArrowDownLeft size={12} /> Counter drawing</button>}
                    {canEdit && partner.status === 'active' && <button className="ghost-pill" onClick={() => openMovement('reimburse', partner.id)}><HandCoins size={12} /> Reimburse{partner.frontedOutstanding > 0 ? ` (${money(partner.frontedOutstanding)})` : ''}</button>}
                    {canEdit && partner.status === 'active' && <button className="ghost-pill" onClick={() => openMovement('contribution', partner.id)}><Plus size={12} /> Add capital</button>}
                    <button className="ghost-pill" onClick={() => openStatement(partner.id)}><Printer size={12} /> Statement</button>
                    {canEdit && partner.status === 'active' && partner.capitalBalance > 0 && <button className="text-link" style={{ fontSize: 10 }} onClick={() => openMovement('capital-return', partner.id)}>Return capital <ArrowRight size={12} /></button>}
                    {canManage && partner.status === 'active' && <button className="text-link" style={{ fontSize: 10, color: 'var(--ink-soft)' }} onClick={() => openExit(partner.id)}><LogOut size={12} style={{ verticalAlign: '-2px' }} /> Exit partner</button>}
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

          {canManage && (legacyEntries.length > 0 || legacyLoading) && (
            <section className="soft-card" style={{ marginTop: 14 }} aria-label="Unattributed legacy entries">
              <div className="card-header-row">
                <div>
                  <h2 className="card-title"><History size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Unattributed (pre-partners)</h2>
                  <p className="card-subtitle">Contributions and withdrawals recorded before partners existed. They sit outside every partner hisaab until you tag them, one row at a time.</p>
                </div>
                <span className="legacy-count">{legacyLoading ? 'Loading…' : `${legacyEntries.length} ${legacyEntries.length === 1 ? 'row' : 'rows'}`}</span>
              </div>
              <p className="field-hint" style={{ marginTop: 4 }}>Hisaabook never guesses an owner from a description. Tagging posts the matching partner entry and locks the row.</p>
              <div className="legacy-list">
                {(legacyShowAll ? legacyEntries : legacyEntries.slice(0, 6)).map((entry) => (
                  <div className="legacy-row" key={entry.transactionId}>
                    <div className="legacy-main">
                      <div className="legacy-title">
                        <span className="legacy-type">{entry.type === 'CONTRIBUTION' ? 'Contribution' : 'Withdrawal'}</span>
                        <span className="status-chip legacy">Unattributed</span>
                      </div>
                      <div className="legacy-desc">{entry.description || 'No description'}</div>
                      <div className="cell-sub">{dateLabel(entry.date)} · {entry.accountName}{entry.note ? ` · ${entry.note}` : ''}</div>
                    </div>
                    <div className="legacy-side">
                      <span className="legacy-amount">{money(entry.amount)}</span>
                      <div className="legacy-tag">
                        <label className="sr-only" htmlFor={`legacy-partner-${entry.transactionId}`}>Partner for this row</label>
                        <Select value={legacyChoice[entry.transactionId] || 'none'}
                          onValueChange={(value) => setLegacyChoice({ ...legacyChoice, [entry.transactionId]: value })}>
                          <SelectTrigger id={`legacy-partner-${entry.transactionId}`} className="h-10 rounded-xl legacy-select"><SelectValue placeholder="Choose partner" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Choose partner</SelectItem>
                            {activePartners.map((partner) => <SelectItem value={String(partner.id)} key={partner.id}>{partner.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <button type="button" className="lime-button legacy-tag-button"
                          disabled={legacyBusyId === entry.transactionId || !legacyChoice[entry.transactionId] || legacyChoice[entry.transactionId] === 'none'}
                          onClick={() => void attributeLegacy(entry)}>
                          <Check size={14} strokeWidth={2.8} />{legacyBusyId === entry.transactionId ? 'Tagging…' : 'Tag'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {legacyEntries.length > 6 && (
                <button type="button" className="text-link" style={{ fontSize: 10, marginTop: 10 }} onClick={() => setLegacyShowAll(!legacyShowAll)}>
                  {legacyShowAll ? 'Show fewer rows' : `Show all ${legacyEntries.length} rows`} <ArrowRight size={11} />
                </button>
              )}
            </section>
          )}

          <section className="soft-card" style={{ marginTop: 14 }} aria-label="Distribution history">
            <div className="card-header-row">
              <div>
                <h2 className="card-title"><PieChart size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Distribution history</h2>
                <p className="card-subtitle">Every appropriation posted to the partner ledgers, newest first.</p>
              </div>
              <div className="flex items-center gap-2">
                <a className="ghost-pill" href="/api/partners/distribution?format=csv" download><Download size={12} /> CSV</a>
                {canManage && <button className="lime-button" onClick={openDistribution}><PieChart size={14} /> Distribute profit</button>}
              </div>
            </div>
            {historyLoading && distributions.length === 0 && <div className="empty-state">Loading distribution history…</div>}
            {!historyLoading && distributions.length === 0 && <div className="empty-state">No distributions yet. When the month closes, run the appropriation here and every partner ledger posts itself.</div>}
            <div className="history-list">
              {distributions.map((item) => (
                <div className="history-row" key={item.id}>
                  <div className="min-w-0 flex-1">
                    <div className="cell-title" style={{ fontSize: 11 }}>{dateLabel(item.periodFrom)} to {dateLabel(item.periodTo)}{item.status === 'VOID' && <span className="status-chip void">VOID</span>}</div>
                    <div className="cell-sub">Basis {item.basisProfit < 0 ? '−' : ''}{money(item.basisProfit)} · {item.createdBy} · {dateLabel(item.createdAt)}{item.note ? ` · ${item.note}` : ''}</div>
                  </div>
                  <div className="text-right" style={{ flex: '0 0 auto' }}>
                    <div className="cell-num" style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{item.residual < 0 ? '−' : ''}{money(item.residual)}</div>
                    {canManage && item.status === 'POSTED' && <button type="button" className="text-link" style={{ fontSize: 9 }} onClick={() => { setVoidTarget(item.id); setVoidReason(''); }}>Void <ArrowRight size={10} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <p className="footer-note" id="about">Hisaabook records the shares and terms you agree. For bookkeeping reference only, not legal, tax, or accounting advice.</p>
        </div>
      </main>

      {/* Add partner dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) restoreOpener(); }}>
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
      <Dialog open={shareOpen} onOpenChange={(open) => { setShareOpen(open); if (!open) restoreOpener(); }}>
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
      <Dialog open={frontedOpen} onOpenChange={(open) => { setFrontedOpen(open); if (!open) restoreOpener(); }}>
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
              <p className={`mt-2 text-[10px] font-bold ${feAmountInt > 0 && feTotal === feAmountInt ? 'text-[var(--positive)]' : 'text-[var(--muted)]'}`}>Funders total PKR {feTotal.toLocaleString('en-PK')}{feAmountInt > 0 ? ` of PKR ${feAmountInt.toLocaleString('en-PK')}` : ''}</p>
            </div>

            <div className="form-field full"><Label htmlFor="fe-note">Note (optional)</Label><Input id="fe-note" maxLength={1000} value={feNote} onChange={(event) => setFeNote(event.target.value)} placeholder="Receipt, bill number, anything auditors should see" className="h-11 rounded-xl" /></div>
            {formError && <p className="form-field full form-error" role="alert">{formError}</p>}
            <DialogFooter className="form-field full sm:justify-end"><Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setFrontedOpen(false)}>Cancel</Button><button type="submit" className="lime-button" disabled={busy || feFunders.length === 0 || feTotal !== feAmountInt || feAmountInt <= 0}>{busy ? 'Saving…' : 'Save out of pocket'}</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generic movement dialog (drawing / contribution / capital-return / reimburse) */}
      <Dialog open={movementOpen} onOpenChange={(open) => { setMovementOpen(open); if (!open) restoreOpener(); }}>
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
            {drawingCapWarning && (
              <p className="warn-box form-field full" role="status">
                Over the drawing cap: lifetime drawings would reach {money(drawingCapWarning.drawnAfter)}, above {drawingCapWarning.capPct}% of the accrued {money(drawingCapWarning.accrued)} (cap {money(drawingCapWarning.capAmount)}). {role === 'BOOKKEEPER' ? 'This will be flagged in the audit log.' : 'You can still proceed; it will be flagged in the audit log.'}
              </p>
            )}
            {formError && <p className="form-field full form-error" role="alert">{formError}</p>}
            <DialogFooter className="form-field full sm:justify-end"><Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setMovementOpen(false)}>Cancel</Button><button type="submit" className="lime-button" disabled={busy}>{busy ? 'Saving…' : movementMeta.confirm}</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Statement dialog */}
      <Dialog open={statementOpen} onOpenChange={(open) => { setStatementOpen(open); if (!open) restoreOpener(); }}>
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
      {/* Exit settlement dialog */}
      <Dialog open={exitOpen} onOpenChange={(open) => { setExitOpen(open); if (!open) restoreOpener(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:max-w-xl" onOpenAutoFocus={(event) => { event.preventDefault(); document.getElementById('exit-date')?.focus(); }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Exit settlement{exitPartner ? ` - ${exitPartner.name}` : ''}</DialogTitle>
            <DialogDescription>Computes everything the partner is owed or owes, in the s.48 order: losses first, then advances, then capital, then the residue. Preview posts nothing; the ledger changes only on confirm.</DialogDescription>
          </DialogHeader>
          <div className="form-grid" style={{ marginTop: 4 }}>
            <div className="form-field"><Label htmlFor="exit-date">Exit date</Label><Input id="exit-date" type="date" required max={todayIso()} value={exitAsOf} onChange={(event) => { setExitAsOf(event.target.value); setExitPreview(null); }} className="h-11 rounded-xl" /></div>
            <div className="form-field"><Label htmlFor="exit-mode">Settle as</Label>
              <Select value={exitMode} onValueChange={(value) => { setExitMode(value as 'PAY' | 'LOAN'); setExitPreview(null); }}><SelectTrigger id="exit-mode" className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PAY">Pay out in cash</SelectItem><SelectItem value="LOAN">Convert to firm loan</SelectItem></SelectContent></Select>
              <span className="field-hint">Default comes from the deed terms.</span>
            </div>
            <div className="form-field"><Label htmlFor="exit-goodwill">Goodwill value (PKR)</Label><Input id="exit-goodwill" type="number" min="0" step="1" inputMode="numeric" value={exitGoodwill} onChange={(event) => { setExitGoodwill(event.target.value); setExitPreview(null); }} className="h-11 rounded-xl" /></div>
            {goodwillInt > 0 && (
              <div className="form-field"><Label htmlFor="exit-gw-method">Goodwill method</Label>
                <Select value={exitGoodwillMethod} onValueChange={(value) => { setExitGoodwillMethod(value as 'RAISE_WRITEOFF' | 'CASH_ADJUSTMENT'); setExitPreview(null); }}><SelectTrigger id="exit-gw-method" className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RAISE_WRITEOFF">Raise and write off (old PSR)</SelectItem><SelectItem value="CASH_ADJUSTMENT">Cash adjustment (remaining partners)</SelectItem></SelectContent></Select>
              </div>
            )}
          </div>
          <div className="form-field full" style={{ marginTop: 12 }}>
            <Label>Revaluation lines (optional)</Label>
            <p className="field-hint">Assets and liabilities at fair value. A positive delta increases asset values, a negative delta reduces them. Split by the exit-date PSR.</p>
            {exitRevaluations.map((line) => (
              <div className="exit-reval-row" key={line.id}>
                <Input className="exit-reval-desc h-10 rounded-xl" placeholder="e.g. Delivery van revalued" aria-label="Revaluation description" maxLength={80} value={line.description} onChange={(event) => { setExitRevaluations(exitRevaluations.map((row) => row.id === line.id ? { ...row, description: event.target.value } : row)); setExitPreview(null); }} />
                <Input className="exit-reval-delta h-10 rounded-xl tabular-nums" type="number" step="1" inputMode="numeric" placeholder="+/-" aria-label="Revaluation delta in PKR" value={line.delta} onChange={(event) => { setExitRevaluations(exitRevaluations.map((row) => row.id === line.id ? { ...row, delta: event.target.value } : row)); setExitPreview(null); }} />
                <button type="button" className="ghost-pill exit-reval-remove" aria-label="Remove revaluation line" onClick={() => { setExitRevaluations(exitRevaluations.filter((row) => row.id !== line.id)); setExitPreview(null); }}><X size={12} /></button>
              </div>
            ))}
            {exitRevaluations.length < 24 && <button type="button" className="text-link" style={{ fontSize: 10, marginTop: 8 }} onClick={() => { setExitRevaluations([...exitRevaluations, { id: exitRevaluationId, description: '', delta: '' }]); setExitRevaluationId(exitRevaluationId + 1); }}>+ Add revaluation line</button>}
          </div>
          <div className="flex items-center justify-between gap-2" style={{ marginTop: 10 }}>
            <span className="field-hint">Preview only; nothing posts until you confirm.</span>
            <button type="button" className="ghost-pill" onClick={() => void buildSettlementPreview()} disabled={exitBusy || !exitAsOf}>{exitBusy && !exitPreview ? 'Computing…' : 'Preview'}</button>
          </div>
          {exitError && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{exitError}</p>}
          {exitPreview && (
            <div className="dist-panel">
              {exitPreview.exitDistribution && (
                <p className="warn-box" role="status">Step 1 posts the distribution for {dateLabel(exitPreview.exitDistribution.from)} to {dateLabel(exitPreview.exitDistribution.to)} first (residual {signed(exitPreview.exitDistribution.residual)}). {exitPreview.partner.name} keeps {money(exitPreview.exitDistribution.share)} of it, paid exactly once here.</p>
              )}
              <div className="dist-row"><span>Capital balance</span><strong>{signed(exitPreview.capitalBalance)}</strong></div>
              <div className="dist-row"><span>Current account (fronts − drawings + appropriations)</span><strong>{signed(exitPreview.currentPosition)}</strong></div>
              {exitPreview.undistributedShare > 0 && <div className="dist-row"><span>Share of un-distributed profit (step 1)</span><strong>+ {money(exitPreview.undistributedShare)}</strong></div>}
              {exitPreview.revaluations.map((line, index) => (
                <div className="dist-row" key={`${index}-${line.description}`}>
                  <span>Revaluation · {line.description}<br /><small className="table-muted">{line.allocations.map((allocation) => `${allocation.name.split(' ')[0]} ${signed(allocation.amount)}`).join(' · ')}</small></span>
                  <strong>{signed(line.share)}</strong>
                </div>
              ))}
              {exitPreview.goodwillValue > 0 && <div className="dist-row"><span>Goodwill · {exitPreview.goodwillMethod === 'RAISE_WRITEOFF' ? 'raise and write off (old PSR)' : 'cash adjustment (remaining partners)'}</span><strong>{exitPreview.goodwillMethod === 'RAISE_WRITEOFF' ? `+ ${money(exitPreview.goodwillShare)}` : `${money(exitPreview.goodwillShare)} personal claim`}</strong></div>}
              <div className="dist-row"><span>Current account settled</span><strong>{signed(exitPreview.currentSettled)}</strong></div>
              <div className="dist-row"><span>Capital returned</span><strong>{money(exitPreview.capitalReturned)}</strong></div>
              <div className="dist-row dist-total"><span>{exitPreview.firmPays > 0 ? `Firm pays ${exitPreview.partner.name}` : exitPreview.partnerOwes > 0 ? `${exitPreview.partner.name} owes the firm` : 'Settles at zero'}{exitMode === 'LOAN' && exitPreview.firmPays > 0 ? ' (as a loan)' : ''}</span><strong>{money(Math.max(exitPreview.firmPays, exitPreview.partnerOwes))}</strong></div>
              {exitPreview.continuing.length > 0 && (
                <div className="dist-psr" aria-label="Continuing partners absorb">
                  <div className="dist-psr-row"><span>Continuing partners absorb</span><span>{exitPreview.continuing.map((entry) => entry.absorbed === 0 ? null : `${entry.name.split(' ')[0]} ${entry.absorbed >= 0 ? '−' : '+'} ${money(entry.absorbed)}`).filter(Boolean).join(' · ')}</span></div>
                </div>
              )}
              {exitPreview.notes.map((note) => <p className="field-hint" key={note}>{note}</p>)}
              {Math.abs(exitPreview.shareMismatchTotal - 100) > 0.01 && (
                <label className="dist-confirm" htmlFor="exit-confirm-mismatch">
                  <input id="exit-confirm-mismatch" type="checkbox" checked={exitConfirmMismatch} onChange={(event) => setExitConfirmMismatch(event.target.checked)} />
                  <span>Recorded shares total {exitPreview.shareMismatchTotal}% (not 100). Settle anyway using the recorded day-weighted weights.</span>
                </label>
              )}
            </div>
          )}
          <DialogFooter className="form-field full sm:justify-end" style={{ marginTop: 12 }}>
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setExitOpen(false)}>Close</Button>
            <button type="button" className="lime-button" disabled={!exitPreview || exitBusy || (Math.abs(exitPreview.shareMismatchTotal - 100) > 0.01 && !exitConfirmMismatch)} onClick={() => void confirmSettlement()}>{exitBusy ? 'Posting…' : 'Post exit settlement'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deed settings dialog */}
      <Dialog open={deedOpen} onOpenChange={(open) => { setDeedOpen(open); if (!open) restoreOpener(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6" onOpenAutoFocus={(event) => { event.preventDefault(); document.getElementById('deed-salary')?.focus(); }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Deed terms</DialogTitle>
            <DialogDescription>What your partnership deed allows, as data. Everything stays off until you turn it on; Hisaabook never invents terms you have not agreed.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveDeed} className="form-grid" style={{ marginTop: 4 }}>
            <label className="deed-toggle form-field full" htmlFor="deed-salary">
              <input id="deed-salary" type="checkbox" checked={deedSalary} onChange={(event) => setDeedSalary(event.target.checked)} />
              <span><strong>Partner salary</strong><small>Deed-fixed salary paid before profit share (s.13(a)). The amounts are entered per distribution.</small></span>
            </label>
            <label className="deed-toggle form-field full" htmlFor="deed-icap">
              <input id="deed-icap" type="checkbox" checked={deedICap} onChange={(event) => setDeedICap(event.target.checked)} />
              <span><strong>Interest on capital</strong><small>Only out of profits remaining after salary (s.13(c)). Paid on each partner’s opening capital.</small></span>
            </label>
            {deedICap && (
              <div className="form-field"><Label htmlFor="deed-icap-pct">Rate (% p.a.)</Label><Input id="deed-icap-pct" type="number" min="0" max="50" step="0.5" required value={deedICapPct} onChange={(event) => setDeedICapPct(event.target.value)} className="h-11 rounded-xl" /></div>
            )}
            <label className="deed-toggle form-field full" htmlFor="deed-idraw">
              <input id="deed-idraw" type="checkbox" checked={deedIDraw} onChange={(event) => setDeedIDraw(event.target.checked)} />
              <span><strong>Interest on drawings</strong><small>Each drawing accrues from its date to the period end, added back to distributable profit.</small></span>
            </label>
            {deedIDraw && (
              <div className="form-field"><Label htmlFor="deed-idraw-pct">Rate (% p.a.)</Label><Input id="deed-idraw-pct" type="number" min="0" max="50" step="0.5" required value={deedIDrawPct} onChange={(event) => setDeedIDrawPct(event.target.value)} className="h-11 rounded-xl" /></div>
            )}
            <div className="form-field"><Label htmlFor="deed-cap">Drawing cap (%)</Label><Input id="deed-cap" type="number" min="0" max="100" step="1" required value={deedCap} onChange={(event) => setDeedCap(event.target.value)} className="h-11 rounded-xl" /><span className="field-hint">Warn when lifetime drawings exceed this % of accrued (posted + estimated) share. Never blocks; flagged in the audit log.</span></div>
            <div className="form-field"><Label htmlFor="deed-method">On partner exit</Label>
              <Select value={deedMethod} onValueChange={(value) => setDeedMethod(value as 'PAY' | 'LOAN')}><SelectTrigger id="deed-method" className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PAY">Pay out in cash</SelectItem><SelectItem value="LOAN">Convert to firm loan</SelectItem></SelectContent></Select>
              <span className="field-hint">Default for the exit settlement and for how an exited partner is paid.</span>
            </div>
            {formError && <p className="form-field full form-error" role="alert">{formError}</p>}
            <DialogFooter className="form-field full sm:justify-end"><Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setDeedOpen(false)}>Cancel</Button><button type="submit" className="lime-button" disabled={busy}>{busy ? 'Saving…' : 'Save deed terms'}</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Distribution dialog */}
      <Dialog open={distOpen} onOpenChange={(open) => { setDistOpen(open); if (!open) restoreOpener(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Distribute profit</DialogTitle>
            <DialogDescription>Salary first, interest on capital capped by what remains, interest on drawings added back, residual by day-weighted PSR. Preview is read-only; nothing posts until you confirm.</DialogDescription>
          </DialogHeader>
          <div className="dist-presets" role="group" aria-label="Period presets">
            <button type="button" className={`deed-chip${distPreset === 'month' ? ' active' : ''}`} onClick={() => applyDistPreset('month')}>This month</button>
            <button type="button" className={`deed-chip${distPreset === 'lastMonth' ? ' active' : ''}`} onClick={() => applyDistPreset('lastMonth')}>Last month</button>
            <button type="button" className={`deed-chip${distPreset === 'quarter' ? ' active' : ''}`} onClick={() => applyDistPreset('quarter')}>Quarter to date</button>
            <button type="button" className={`deed-chip${distPreset === 'custom' ? ' active' : ''}`} onClick={() => applyDistPreset('custom')}>Custom</button>
          </div>
          <div className="form-grid" style={{ marginTop: 8 }}>
            <div className="form-field"><Label htmlFor="dist-from">From</Label><Input id="dist-from" type="date" value={distFrom} onChange={(event) => { setDistPreset('custom'); setDistFrom(event.target.value); setDistPreview(null); }} className="h-11 rounded-xl" /></div>
            <div className="form-field"><Label htmlFor="dist-to">To</Label><Input id="dist-to" type="date" value={distTo} onChange={(event) => { setDistPreset('custom'); setDistTo(event.target.value); setDistPreview(null); }} className="h-11 rounded-xl" /></div>
          </div>
          {data.settings.partnerSalaryEnabled && (
            <div className="form-field full" style={{ marginTop: 10 }}>
              <Label>Salaries for this period (optional)</Label>
              <div className="mt-2 grid gap-2">
                {activePartners.map((partner) => (
                  <div key={partner.id} className="flex items-center gap-2">
                    <span className="w-28 truncate text-[11px] font-semibold">{partner.name.split(' ')[0]}</span>
                    <Input type="number" min="0" step="1" inputMode="numeric" placeholder="0" aria-label={`Salary for ${partner.name}`} value={salaryInputs[partner.id] ?? ''} onChange={(event) => { setSalaryInputs({ ...salaryInputs, [partner.id]: event.target.value }); setDistPreview(null); }} className="h-10 rounded-xl tabular-nums" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="form-field full" style={{ marginTop: 10 }}><Label htmlFor="dist-note">Note (optional)</Label><Input id="dist-note" maxLength={300} value={distNote} onChange={(event) => setDistNote(event.target.value)} placeholder="e.g. October distribution as per deed" className="h-10 rounded-xl" /></div>
          <div className="flex items-center justify-between gap-2" style={{ marginTop: 10 }}>
            <span className="field-hint">Basis: CLEARED income − expenses. Partner-funded expenses already count.</span>
            <button type="button" className="ghost-pill" onClick={() => void buildPreview()} disabled={distBusy}>{distBusy && !distPreview ? 'Computing…' : 'Preview'}</button>
          </div>
          {distError && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{distError}</p>}
          {distPreview && (
            <div className="dist-panel">
              {distPreview.overlapDistributionId !== null && <p className="warn-box" role="alert">This period overlaps distribution #{distPreview.overlapDistributionId} (already posted). Posting is blocked until that distribution is voided.</p>}
              {distPreview.workings.lossPeriod && <p className="warn-box" role="alert">Loss period. Salaries and interest on capital are not paid (s.13(c)); the loss is shared by PSR.</p>}
              <div className="dist-row"><span>Basis profit · {dateLabel(distPreview.workings.from)} to {dateLabel(distPreview.workings.to)} ({distPreview.workings.days}d)</span><strong>{signed(distPreview.workings.basisProfit)}</strong></div>
              {distPreview.workings.salaries.map((line) => (<div className="dist-row" key={`sal-${line.ownerId}`}><span>Salary · {line.name}</span><strong>− {money(line.amount)}</strong></div>))}
              {distPreview.workings.salaryCapped && <p className="field-hint">Salaries exceeded the profit and were scaled pro-rata to the available amount.</p>}
              {distPreview.workings.capitals.filter((line) => line.openingCapital > 0).map((line) => (<div className="dist-row" key={`cap-${line.ownerId}`}><span>Interest on capital · {line.name} · opening {money(line.openingCapital)}</span><strong>− {money(line.interest)}</strong></div>))}
              {distPreview.workings.interestCapitalCapped && <p className="field-hint">Interest on capital was capped by the profit remaining after salary (s.13(c)).</p>}
              {distPreview.workings.drawingsInterest.filter((line) => line.interest > 0).map((line) => (<div className="dist-row" key={`draw-${line.ownerId}`}><span>Interest on drawings · {line.name}</span><strong>+ {money(line.interest)}</strong></div>))}
              <div className="dist-row dist-total"><span>Residual to share by PSR</span><strong>{signed(distPreview.workings.residual)}</strong></div>
              <div className="dist-psr" aria-label="Day-weighted profit shares">
                {distPreview.workings.segments.map((segment) => (
                  <div className="dist-psr-row" key={segment.from}><span>{dateLabel(segment.from)} to {dateLabel(segment.to)} · {segment.days}d</span><span>{segment.shares.filter((share) => share.share > 0).map((share) => `${activePartners.find((partner) => partner.id === share.ownerId)?.name.split(' ')[0] ?? share.ownerId} ${Number(share.share).toLocaleString('en-PK')}%`).join(' · ')}</span></div>
                ))}
                <div className="dist-psr-row"><span>Effective period ratio</span><span>{distPreview.workings.psr.filter((entry) => entry.ratio > 0).map((entry) => `${entry.name.split(' ')[0]} ${(entry.ratio * 100).toFixed(2)}%`).join(' · ')}</span></div>
              </div>
              <div className="data-table-wrap" style={{ marginTop: 10 }}>
                <table className="data-table">
                  <thead><tr><th>Partner</th><th>Salary</th><th>Int. capital</th><th>Profit / (Loss)</th><th>Drawings int.</th></tr></thead>
                  <tbody>{distPreview.workings.lines.map((line) => (
                    <tr key={line.ownerId}><td><div className="cell-title" style={{ fontSize: 10 }}>{line.name}</div></td><td className="cell-num">{line.salary > 0 ? money(line.salary) : '-'}</td><td className="cell-num">{line.interestCapital > 0 ? money(line.interestCapital) : '-'}</td><td className="cell-num">{signed(line.share)}</td><td className="cell-num">{line.interestDrawings > 0 ? money(line.interestDrawings) : '-'}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="field-hint" style={{ marginTop: 6 }}>{distPreview.workings.roundingNote}</p>
              {Math.abs(distPreview.workings.shareMismatchTotal - 100) > 0.01 && (
                <label className="dist-confirm" htmlFor="dist-confirm-mismatch">
                  <input id="dist-confirm-mismatch" type="checkbox" checked={confirmMismatch} onChange={(event) => setConfirmMismatch(event.target.checked)} />
                  <span>Recorded shares total {distPreview.workings.shareMismatchTotal}% (not 100). Distribute anyway using the recorded day-weighted weights.</span>
                </label>
              )}
            </div>
          )}
          <DialogFooter className="form-field full sm:justify-end" style={{ marginTop: 12 }}>
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setDistOpen(false)}>Close</Button>
            <button type="button" className="lime-button" disabled={!distPreview || distBusy || distPreview.overlapDistributionId !== null || (Math.abs(distPreview.workings.shareMismatchTotal - 100) > 0.01 && !confirmMismatch)} onClick={() => void postDistribution()}>{distBusy ? 'Posting…' : 'Post distribution'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void distribution dialog */}
      <Dialog open={voidTarget !== null} onOpenChange={(open) => { if (!open) { setVoidTarget(null); restoreOpener(); } }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Void distribution #{voidTarget}</DialogTitle>
            <DialogDescription>Posts reversing correction rows for every entry of this distribution. The original stays visible in history, marked void, forever.</DialogDescription>
          </DialogHeader>
          <div className="form-field full" style={{ marginTop: 4 }}><Label htmlFor="void-reason">Reason (required)</Label><Input id="void-reason" maxLength={200} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="e.g. Posted for the wrong period" className="h-11 rounded-xl" autoFocus /></div>
          <DialogFooter className="form-field full sm:justify-end" style={{ marginTop: 12 }}>
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setVoidTarget(null)}>Cancel</Button>
            <button type="button" className="lime-button" disabled={voidBusy || !voidReason.trim()} onClick={() => void confirmVoid()}>{voidBusy ? 'Voiding…' : 'Void distribution'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
