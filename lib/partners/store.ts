/**
 * Partner ledger — data access shared by API routes and demo seeding.
 * All postings run inside the caller's db.transaction (or open one).
 */
import { db } from '@/lib/database';
import { ENTRY_DIRECTION, addDays, apportion, computeAppropriation, dayWeightedPsr, daysBetweenInclusive, periodSegments, positionFromLines, shareAt, type PositionLine, type SharePoint } from './ledger';

export const CLEARING_ACCOUNT_NAME = 'Partner out-of-pocket (clearing)';

export type PartnerMovementKind = 'expense-fronted' | 'drawing' | 'contribution' | 'capital-return' | 'reimburse';

export type PartnerRow = {
  id: number;
  name: string;
  role: string;
  share: number;
  effectiveAt: string;
  userId: number | null;
  status: string;
};

export type PartnerOverviewEntry = {
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
  accruedEstimate: number;
  drawingsLifetime: number;
  month: { fronts: number; reimbursed: number; drawings: number };
  lastMovements: Array<{ id: number; entryType: string; direction: string; amount: number; date: string; note: string }>;
};

const isoDate = (value: string | undefined, fallback: string) => {
  const v = (value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback;
};
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Lazily-created hidden clearing account anchoring partner-funded expenses. */
export async function getOrCreateClearingAccount(workspaceId: number): Promise<number> {
  await db.prepare(`INSERT INTO accounts (workspace_id, name, account_type, currency, opening_balance, is_system)
    VALUES (?, ?, 'PARTNER_ADVANCE', 'PKR', 0, 1) ON CONFLICT (workspace_id, name) DO NOTHING`)
    .run(workspaceId, CLEARING_ACCOUNT_NAME);
  const row = await db.prepare('SELECT id FROM accounts WHERE workspace_id = ? AND name = ?').get(workspaceId, CLEARING_ACCOUNT_NAME) as { id: number } | undefined;
  if (!row) throw new Error('PARTNER_CLEARING_ACCOUNT_FAILED');
  return Number(row.id);
}

/** Effective current PSR per partner (latest share change on/before `asOf`). */
export async function getEffectiveShares(workspaceId: number, asOf = today()) {
  const rows = await db.prepare(`SELECT owner_id AS ownerId, share, effective_at AS effectiveAt
    FROM owner_share_changes WHERE workspace_id = ? AND substr(effective_at, 1, 10) <= ?
    ORDER BY owner_id, substr(effective_at, 1, 10) DESC, id DESC`).all(workspaceId, asOf) as Array<{ ownerId: number; share: number; effectiveAt: string }>;
  const map = new Map<number, { share: number; effectiveAt: string }>();
  for (const row of rows) {
    if (!map.has(row.ownerId)) map.set(row.ownerId, { share: Number(row.share), effectiveAt: String(row.effectiveAt).slice(0, 10) });
  }
  return map;
}

export async function getPartnerPositions(workspaceId: number) {
  const rows = await db.prepare(`SELECT owner_id AS ownerId, entry_type AS entryType, direction, SUM(amount) AS total
    FROM partner_entries WHERE workspace_id = ? GROUP BY owner_id, entry_type, direction`).all(workspaceId) as Array<{ ownerId: number; entryType: string; direction: 'CREDIT' | 'DEBIT'; total: number }>;
  const byOwner = new Map<number, PositionLine[]>();
  for (const row of rows) {
    const list = byOwner.get(row.ownerId) ?? [];
    list.push({ entryType: row.entryType, direction: row.direction, amount: Number(row.total) });
    byOwner.set(row.ownerId, list);
  }
  return byOwner;
}

export async function getPartnerOverview(workspaceId: number): Promise<PartnerOverviewEntry[]> {
  const owners = await db.prepare('SELECT id, name, role, share, effective_at AS effectiveAt, user_id AS userId, status FROM owners WHERE workspace_id = ? ORDER BY id')
    .all(workspaceId) as Array<{ id: number; name: string; role: string; share: number; effectiveAt: string; userId: number | null; status: string }>;
  if (owners.length === 0) return [];
  const shares = await getEffectiveShares(workspaceId);
  const positionLines = await getPartnerPositions(workspaceId);
  const month = await db.prepare(`SELECT owner_id AS ownerId,
      SUM(CASE WHEN entry_type = 'EXPENSE_PAID' THEN amount ELSE 0 END) AS fronts,
      SUM(CASE WHEN entry_type = 'ADVANCE_REIMBURSED' THEN amount ELSE 0 END) AS reimbursed,
      SUM(CASE WHEN entry_type = 'CASH_WITHDRAWAL' THEN amount ELSE 0 END) AS drawings
    FROM partner_entries WHERE workspace_id = ? AND substr(transaction_date, 1, 10) >= ? GROUP BY owner_id`)
    .all(workspaceId, monthStart()) as Array<{ ownerId: number; fronts: number; reimbursed: number; drawings: number }>;
  const monthMap = new Map(month.map((m) => [m.ownerId, m]));
  const lastMovements = await db.prepare(`SELECT id, owner_id AS ownerId, entry_type AS entryType, direction, amount,
      substr(transaction_date, 1, 10) AS date, note FROM partner_entries WHERE workspace_id = ?
    ORDER BY substr(transaction_date, 1, 10) DESC, id DESC`).all(workspaceId) as Array<{ id: number; ownerId: number; entryType: string; direction: string; amount: number; date: string; note: string }>;
  const lastMap = new Map<number, PartnerOverviewEntry['lastMovements']>();
  for (const row of lastMovements) {
    const list = lastMap.get(row.ownerId) ?? [];
    if (list.length < 4) list.push({ id: row.id, entryType: row.entryType, direction: row.direction, amount: Number(row.amount), date: row.date, note: row.note });
    lastMap.set(row.ownerId, list);
  }
  const estimates = await computeAccruedEstimates(workspaceId, owners.map((owner) => Number(owner.id)));
  return owners.map((owner) => {
    const eff = shares.get(owner.id);
    const pos = positionFromLines(positionLines.get(owner.id) ?? []);
    const m = monthMap.get(owner.id);
    return {
      id: owner.id,
      name: owner.name,
      role: owner.role,
      share: eff?.share ?? Number(owner.share),
      baselineShare: Number(owner.share),
      effectiveAt: eff?.effectiveAt ?? String(owner.effectiveAt).slice(0, 10),
      userId: owner.userId === null ? null : Number(owner.userId),
      status: owner.status,
      capitalBalance: pos.capitalBalance,
      settleable: pos.settleable,
      frontedOutstanding: pos.frontedOutstanding,
      appropriationsNet: pos.appropriationsNet,
      drawingsTotal: pos.drawingsTotal,
      netValue: pos.netValue,
      accruedEstimate: estimates.get(Number(owner.id))?.accrued ?? 0,
      drawingsLifetime: estimates.get(Number(owner.id))?.drawingsLifetime ?? 0,
      month: { fronts: Number(m?.fronts ?? 0), reimbursed: Number(m?.reimbursed ?? 0), drawings: Number(m?.drawings ?? 0) },
      lastMovements: lastMap.get(owner.id) ?? [],
    };
  });
}

async function assertPartner(workspaceId: number, ownerId: number) {
  const partner = await db.prepare('SELECT id, name FROM owners WHERE id = ? AND workspace_id = ?').get(ownerId, workspaceId) as { id: number; name: string } | undefined;
  if (!partner) throw new MovementError('The selected partner was not found in this business.');
  return partner;
}

async function assertRealAccount(workspaceId: number, accountId: number) {
  const account = await db.prepare('SELECT id, name FROM accounts WHERE id = ? AND workspace_id = ? AND is_system = 0').get(accountId, workspaceId) as { id: number; name: string } | undefined;
  if (!account) throw new MovementError('The selected account was not found in this business.');
  return account;
}

export class MovementError extends Error {}

async function insertEntry(workspaceId: number, ownerId: number, entryType: keyof typeof ENTRY_DIRECTION | 'SETTLEMENT' | 'CORRECTION',
  direction: 'CREDIT' | 'DEBIT', amount: number, transactionId: number | null, date: string, note: string, actorName: string, splitShare: number | null = null) {
  await db.prepare(`INSERT INTO partner_entries (workspace_id, owner_id, entry_type, direction, amount, transaction_id, split_share, note, transaction_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(workspaceId, ownerId, entryType, direction, amount, transactionId, splitShare, note.slice(0, 300), `${date}T12:00:00.000Z`, actorName);
}

async function insertTransaction(workspaceId: number, accountId: number, type: string, amount: number, description: string,
  category: string, counterparty: string, note: string, date: string, createdBy: string,
  partnerId: number | null = null, fundingKind: 'ACCOUNT' | 'PARTNER_ADVANCE' | 'PARTNER_CAPITAL' | null = null) {
  const result = await db.prepare(`INSERT INTO transactions
    (workspace_id, account_id, type, amount, description, category, counterparty, note, transaction_date, status, created_by, partner_id, funding_kind)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CLEARED', ?, ?, ?)`)
    .run(workspaceId, accountId, type, amount, description, category.slice(0, 80), counterparty.slice(0, 120), note.slice(0, 1000), `${date}T12:00:00.000Z`, createdBy, partnerId, fundingKind);
  return Number(result.lastInsertRowid);
}

async function audit(workspaceId: number, transactionId: number | null, action: string, details: unknown, actorName: string) {
  await db.prepare('INSERT INTO audit_events (workspace_id, transaction_id, action, details, actor) VALUES (?, ?, ?, ?, ?)')
    .run(workspaceId, transactionId, action, JSON.stringify(details), actorName);
}

export type PostMovementInput =
  | { kind: 'expense-fronted'; amount: number; description: string; category?: string; treatAs: 'advance' | 'capital';
      splits: Array<{ ownerId: number; amount: number }>; transactionDate?: string; note?: string }
  | { kind: 'drawing'; partnerId: number; accountId: number; amount: number; transactionDate?: string; note?: string }
  | { kind: 'reimburse'; partnerId: number; accountId: number; amount: number; transactionDate?: string; note?: string }
  | { kind: 'contribution'; partnerId: number; accountId: number; amount: number; transactionDate?: string; note?: string }
  | { kind: 'capital-return'; partnerId: number; accountId: number; amount: number; transactionDate?: string; note?: string };

/** Posts one partner movement atomically: activity row + sub-ledger rows + audit. */
export async function postPartnerMovement(workspaceId: number, input: PostMovementInput, actor: { name: string; userId: number | null }) {
  const post = db.transaction(async () => {
    const date = isoDate('transactionDate' in input ? input.transactionDate : undefined, today());
    if (!isValidDate(date)) throw new MovementError('Enter a valid date.');
    const actorName = actor.name || 'Workspace member';

    if (input.kind === 'expense-fronted') {
      const amount = input.amount;
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new MovementError('Amount must be a positive whole number of PKR.');
      const description = input.description.trim();
      if (!description) throw new MovementError('Add a description for this expense.');
      if (!Array.isArray(input.splits) || input.splits.length === 0) throw new MovementError('Choose at least one partner funding this expense.');
      const splits = input.splits.map((split) => ({ ownerId: Number(split.ownerId), amount: Number(split.amount) }));
      const seen = new Set<number>();
      const names = new Map<number, string>();
      for (const split of splits) {
        if (!Number.isSafeInteger(split.ownerId) || seen.has(split.ownerId)) throw new MovementError('Invalid partner split.');
        seen.add(split.ownerId);
        if (!Number.isSafeInteger(split.amount) || split.amount <= 0) throw new MovementError('Each partner split must be a positive whole number of PKR.');
        const partner = await assertPartner(workspaceId, split.ownerId);
        names.set(split.ownerId, partner.name);
      }
      const splitTotal = splits.reduce((sum, split) => sum + split.amount, 0);
      if (splitTotal !== amount) throw new MovementError(`Splits add up to ₨ ${splitTotal.toLocaleString('en-PK')}, not ₨ ${amount.toLocaleString('en-PK')}. Make them equal.`);
      const treatAs = input.treatAs === 'capital' ? 'capital' : 'advance';
      const clearingId = await getOrCreateClearingAccount(workspaceId);
      const funderSummary = splits.map((split) => `${names.get(split.ownerId)} ₨ ${split.amount.toLocaleString('en-PK')}`).join(' + ');
      const note = [funderSummary, (input.note ?? '').trim()].filter(Boolean).join(' · ').slice(0, 1000);
      const partnerId = splits.length === 1 ? splits[0].ownerId : null;
      const transactionId = await insertTransaction(workspaceId, clearingId, 'EXPENSE', amount, description,
        (input.category ?? 'Partner-funded').trim() || 'Partner-funded', '', note, date, actorName, partnerId, treatAs === 'advance' ? 'PARTNER_ADVANCE' : 'PARTNER_CAPITAL');
      for (const split of splits) {
        const splitShare = split.amount / amount;
        if (treatAs === 'advance') {
          await insertEntry(workspaceId, split.ownerId, 'EXPENSE_PAID', 'CREDIT', split.amount, transactionId, date, description, actorName, splitShare);
        } else {
          await insertEntry(workspaceId, split.ownerId, 'CAPITAL_CONTRIBUTION', 'CREDIT', split.amount, transactionId, date, `Fronts ${description} (capital)`, actorName, splitShare);
        }
      }
      await audit(workspaceId, transactionId, 'PARTNER_EXPENSE_FRONTED', { amount, description, treatAs, splits }, actorName);
      return { transactionId, title: 'Partner fronted expense', body: `₨ ${amount.toLocaleString('en-PK')} · ${description}` };
    }

    if (input.kind === 'drawing' || input.kind === 'reimburse' || input.kind === 'contribution' || input.kind === 'capital-return') {
      const partnerId = Number(input.partnerId);
      if (!Number.isSafeInteger(partnerId)) throw new MovementError('Choose a valid partner.');
      const partner = await assertPartner(workspaceId, partnerId);
      const accountId = Number(input.accountId);
      if (!Number.isSafeInteger(accountId)) throw new MovementError('Choose a valid account.');
      const account = await assertRealAccount(workspaceId, accountId);
      const amount = Number(input.amount);
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new MovementError('Amount must be a positive whole number of PKR.');
      const note = (input.note ?? '').trim();
      const base = { workspaceId, accountId, amount, date, note };

      if (input.kind === 'drawing') {
        // Drawing cap guard (plan §6.4): warn + audit-flag, never block.
        const settings = await getDeedSettings(workspaceId);
        const estimates = await computeAccruedEstimates(workspaceId, [partnerId]);
        const partnerEstimate = estimates.get(partnerId);
        const drawnAfter = Number(partnerEstimate?.drawingsLifetime ?? 0) + amount;
        const accrued = Number(partnerEstimate?.accrued ?? 0);
        const capAmount = (settings.drawingCapPct / 100) * accrued;
        const capWarning = accrued > 0 && drawnAfter > capAmount
          ? { drawnAfter, capPct: settings.drawingCapPct, capAmount: Math.floor(capAmount), accrued }
          : null;
        const transactionId = await insertTransaction(workspaceId, base.accountId, 'WITHDRAWAL', amount, `${partner.name} · Counter drawing`, 'Partner drawing', '', note, date, actorName, partnerId, 'ACCOUNT');
        await insertEntry(workspaceId, partnerId, 'CASH_WITHDRAWAL', 'DEBIT', amount, transactionId, date, note || 'Counter drawing', actorName);
        await audit(workspaceId, transactionId, 'PARTNER_DRAWING', { amount, accountId, partnerId, ...(capWarning ? { capWarning } : {}) }, actorName);
        return { transactionId, title: 'Counter drawing recorded', body: `₨ ${amount.toLocaleString('en-PK')} · ${partner.name} · ${account.name}`, capWarning };
      }
      if (input.kind === 'reimburse') {
        const positions = await getPartnerPositions(workspaceId);
        const pos = positionFromLines(positions.get(partnerId) ?? []);
        const outstanding = pos.frontedOutstanding;
        if (amount > outstanding) throw new MovementError(`Reimbursement exceeds ${partner.name}'s outstanding claims by ₨ ${(amount - outstanding).toLocaleString('en-PK')}.`);
        const transactionId = await insertTransaction(workspaceId, base.accountId, 'WITHDRAWAL', amount, `${partner.name} · Expense reimbursed`, 'Partner reimbursement', '', note, date, actorName, partnerId, 'ACCOUNT');
        await insertEntry(workspaceId, partnerId, 'ADVANCE_REIMBURSED', 'DEBIT', amount, transactionId, date, note || 'Expense reimbursed', actorName);
        await audit(workspaceId, transactionId, 'PARTNER_REIMBURSED', { amount, accountId, partnerId }, actorName);
        return { transactionId, title: 'Partner reimbursed', body: `₨ ${amount.toLocaleString('en-PK')} · ${partner.name} · ${account.name}` };
      }
      if (input.kind === 'contribution') {
        const transactionId = await insertTransaction(workspaceId, base.accountId, 'CONTRIBUTION', amount, `${partner.name} · Capital`, 'Owner funding', '', note, date, actorName, partnerId, 'ACCOUNT');
        await insertEntry(workspaceId, partnerId, 'CAPITAL_CONTRIBUTION', 'CREDIT', amount, transactionId, date, note || 'Capital contribution', actorName);
        await audit(workspaceId, transactionId, 'PARTNER_CONTRIBUTION', { amount, accountId, partnerId }, actorName);
        return { transactionId, title: 'Capital contribution recorded', body: `₨ ${amount.toLocaleString('en-PK')} · ${partner.name} · ${account.name}` };
      }
      // capital-return
      const positions = await getPartnerPositions(workspaceId);
      const pos = positionFromLines(positions.get(partnerId) ?? []);
      if (amount > pos.capitalBalance) throw new MovementError(`Return exceeds ${partner.name}'s capital balance of ₨ ${pos.capitalBalance.toLocaleString('en-PK')}.`);
      const transactionId = await insertTransaction(workspaceId, base.accountId, 'WITHDRAWAL', amount, `${partner.name} · Capital return`, 'Capital return', '', note, date, actorName, partnerId, 'ACCOUNT');
      await insertEntry(workspaceId, partnerId, 'CAPITAL_RETURN', 'DEBIT', amount, transactionId, date, note || 'Capital returned', actorName);
      await audit(workspaceId, transactionId, 'PARTNER_CAPITAL_RETURN', { amount, accountId, partnerId }, actorName);
      return { transactionId, title: 'Capital returned', body: `₨ ${amount.toLocaleString('en-PK')} · ${partner.name} · ${account.name}` };
    }

    throw new MovementError('Unknown movement kind.');
  });
  return post();
}

/* ------------------------------------------------------------------ */
/* Phase 3 — deed settings, distribution engine, accrued estimates      */
/* ------------------------------------------------------------------ */

export class DistributionError extends Error {}

export type DeedSettings = {
  partnerSalaryEnabled: boolean;
  interestOnCapitalEnabled: boolean;
  interestOnCapitalPct: number | null;
  interestOnDrawingsEnabled: boolean;
  interestOnDrawingsPct: number | null;
  drawingCapPct: number;
  settlementMethod: 'PAY' | 'LOAN';
};

const DEFAULT_DEED_SETTINGS: DeedSettings = {
  partnerSalaryEnabled: false,
  interestOnCapitalEnabled: false,
  interestOnCapitalPct: null,
  interestOnDrawingsEnabled: false,
  interestOnDrawingsPct: null,
  drawingCapPct: 70,
  settlementMethod: 'PAY',
};

export async function getDeedSettings(workspaceId: number): Promise<DeedSettings> {
  const row = await db.prepare('SELECT partner_salary_enabled AS salary, interest_on_capital_enabled AS iCap, interest_on_capital_pct AS iCapPct, interest_on_drawings_enabled AS iDraw, interest_on_drawings_pct AS iDrawPct, drawing_cap_pct AS cap, settlement_method AS method FROM workspace_partner_settings WHERE workspace_id = ?')
    .get(workspaceId) as { salary: number; iCap: number; iCapPct: number | null; iDraw: number; iDrawPct: number | null; cap: number; method: string } | undefined;
  if (!row) return { ...DEFAULT_DEED_SETTINGS };
  return {
    partnerSalaryEnabled: Number(row.salary) === 1,
    interestOnCapitalEnabled: Number(row.iCap) === 1,
    interestOnCapitalPct: row.iCapPct === null ? null : Number(row.iCapPct),
    interestOnDrawingsEnabled: Number(row.iDraw) === 1,
    interestOnDrawingsPct: row.iDrawPct === null ? null : Number(row.iDrawPct),
    drawingCapPct: Number(row.cap),
    settlementMethod: row.method === 'LOAN' ? 'LOAN' : 'PAY',
  };
}

/** Validates and upserts deed settings. Only callers with OWNER/ADMIN reach here. */
export async function updateDeedSettings(workspaceId: number, input: Partial<DeedSettings>, actorName: string): Promise<DeedSettings> {
  const current = await getDeedSettings(workspaceId);
  const pct = (value: unknown, fallback: number | null, max: number): number | null => {
    if (value === null || value === undefined || value === '') return fallback;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || num > max) throw new DistributionError(`Interest rates must be between 0 and ${max}.`);
    return Math.round(num * 100) / 100;
  };
  const capValue = Number(input.drawingCapPct ?? current.drawingCapPct);
  if (!Number.isFinite(capValue) || capValue < 0 || capValue > 100) throw new DistributionError('The drawing cap must be between 0 and 100.');
  const next: DeedSettings = {
    partnerSalaryEnabled: typeof input.partnerSalaryEnabled === 'boolean' ? input.partnerSalaryEnabled : current.partnerSalaryEnabled,
    interestOnCapitalEnabled: typeof input.interestOnCapitalEnabled === 'boolean' ? input.interestOnCapitalEnabled : current.interestOnCapitalEnabled,
    interestOnCapitalPct: pct(input.interestOnCapitalPct, current.interestOnCapitalPct, 50),
    interestOnDrawingsEnabled: typeof input.interestOnDrawingsEnabled === 'boolean' ? input.interestOnDrawingsEnabled : current.interestOnDrawingsEnabled,
    interestOnDrawingsPct: pct(input.interestOnDrawingsPct, current.interestOnDrawingsPct, 50),
    drawingCapPct: Math.round(capValue * 100) / 100,
    settlementMethod: input.settlementMethod === 'LOAN' ? 'LOAN' : input.settlementMethod === 'PAY' ? 'PAY' : current.settlementMethod,
  };
  await db.prepare(`INSERT INTO workspace_partner_settings (workspace_id, partner_salary_enabled, interest_on_capital_enabled, interest_on_capital_pct, interest_on_drawings_enabled, interest_on_drawings_pct, drawing_cap_pct, settlement_method, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (workspace_id) DO UPDATE SET partner_salary_enabled=excluded.partner_salary_enabled, interest_on_capital_enabled=excluded.interest_on_capital_enabled, interest_on_capital_pct=excluded.interest_on_capital_pct, interest_on_drawings_enabled=excluded.interest_on_drawings_enabled, interest_on_drawings_pct=excluded.interest_on_drawings_pct, drawing_cap_pct=excluded.drawing_cap_pct, settlement_method=excluded.settlement_method, updated_at=excluded.updated_at`)
    .run(workspaceId, next.partnerSalaryEnabled ? 1 : 0, next.interestOnCapitalEnabled ? 1 : 0, next.interestOnCapitalPct,
      next.interestOnDrawingsEnabled ? 1 : 0, next.interestOnDrawingsPct, next.drawingCapPct, next.settlementMethod, new Date().toISOString());
  await audit(workspaceId, null, 'DEED_SETTINGS_UPDATED', next, actorName);
  return next;
}

export type WorkingsSalary = { ownerId: number; amount: number };
export type DistributionWorkings = {
  from: string;
  to: string;
  days: number;
  lossPeriod: boolean;
  basisProfit: number;
  segments: Array<{ from: string; to: string; days: number; shares: Array<{ ownerId: number; share: number }> }>;
  psr: Array<{ ownerId: number; name: string; ratio: number; weight: number }>;
  salaries: Array<{ ownerId: number; name: string; amount: number }>;
  salaryTotal: number;
  salaryCapped: boolean;
  capitals: Array<{ ownerId: number; name: string; openingCapital: number; interest: number }>;
  interestCapitalTotal: number;
  interestCapitalCapped: boolean;
  drawingsInterest: Array<{ ownerId: number; name: string; interest: number }>;
  interestDrawingsTotal: number;
  residual: number;
  shareMismatchTotal: number;
  lines: Array<{ ownerId: number; name: string; salary: number; interestCapital: number; interestDrawings: number; share: number; total: number }>;
  roundingNote: string;
  notes: string[];
};

/** Shared by the preview endpoint (nothing posted) and postDistribution. */
export async function computeDistributionWorkings(workspaceId: number, from: string, to: string, salariesInput: WorkingsSalary[]): Promise<DistributionWorkings> {
  if (!isValidDate(from) || !isValidDate(to)) throw new DistributionError('Enter valid start and end dates.');
  if (from > to) throw new DistributionError('The start date must be on or before the end date.');
  const days = daysBetweenInclusive(from, to);
  if (days > 3660) throw new DistributionError('The period is too long. Choose a range under ten years.');

  // Active partners only: exited partners stop drawing a new share (their settlement closes the book).
  const owners = await db.prepare("SELECT id, name, share FROM owners WHERE workspace_id = ? AND status = 'active' ORDER BY id").all(workspaceId) as Array<{ id: number; name: string; share: number }>;
  if (owners.length === 0) throw new DistributionError('Add at least one active partner before distributing profit.');
  const ownerIds = owners.map((owner) => Number(owner.id));
  const nameById = new Map(owners.map((owner) => [Number(owner.id), owner.name]));

  // Basis: realised P&L for the period. Partner-funded expenses are already EXPENSE rows, so they net off.
  const basisRow = await db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expenses
    FROM transactions WHERE workspace_id = ? AND status = 'CLEARED' AND substr(transaction_date, 1, 10) BETWEEN ? AND ?`)
    .get(workspaceId, from, to) as { income: number; expenses: number };
  const basisProfit = Number(basisRow.income) - Number(basisRow.expenses);

  const shareRows = await db.prepare(`SELECT owner_id AS ownerId, share, substr(effective_at, 1, 10) AS date
    FROM owner_share_changes WHERE workspace_id = ? AND substr(effective_at, 1, 10) <= ?
    ORDER BY owner_id, date, id`).all(workspaceId, to) as Array<{ ownerId: number; share: number; date: string }>;
  const pointsByOwner = new Map<number, SharePoint[]>();
  for (const row of shareRows) {
    const list = pointsByOwner.get(Number(row.ownerId)) ?? [];
    list.push({ date: String(row.date).slice(0, 10), share: Number(row.share) });
    pointsByOwner.set(Number(row.ownerId), list);
  }
  const pointsFor = (ownerId: number, fallbackShare: number): SharePoint[] => {
    const list = pointsByOwner.get(ownerId);
    return list && list.length > 0 ? list : [{ date: '1970-01-01', share: fallbackShare }];
  };
  const psr = dayWeightedPsr(owners.map((owner) => ({ ownerId: Number(owner.id), points: pointsFor(Number(owner.id), Number(owner.share)) })), from, to);

  const changeDates = [...new Set(shareRows.map((row) => String(row.date).slice(0, 10)).filter((date) => date > from && date <= to))].sort();
  const segments = periodSegments(from, to, changeDates).map((segment) => ({
    ...segment,
    shares: owners.map((owner) => ({ ownerId: Number(owner.id), share: shareAt(pointsFor(Number(owner.id), Number(owner.share)), segment.from) ?? 0 })),
  }));

  const capRows = await db.prepare(`SELECT owner_id AS ownerId, COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END), 0) AS capital
    FROM partner_entries WHERE workspace_id = ? AND entry_type IN ('CAPITAL_CONTRIBUTION', 'CAPITAL_RETURN') AND substr(transaction_date, 1, 10) < ? GROUP BY owner_id`)
    .all(workspaceId, from) as Array<{ ownerId: number; capital: number }>;
  const capitalById = new Map(capRows.map((row) => [Number(row.ownerId), Number(row.capital)]));

  const drawingRows = await db.prepare(`SELECT owner_id AS ownerId, substr(transaction_date, 1, 10) AS date, amount
    FROM partner_entries WHERE workspace_id = ? AND entry_type = 'CASH_WITHDRAWAL' AND substr(transaction_date, 1, 10) BETWEEN ? AND ?`)
    .all(workspaceId, from, to) as Array<{ ownerId: number; date: string; amount: number }>;

  // Salaries: caller-supplied amounts for this period, integer PKR, sane bounds.
  const salaries = salariesInput.map((item) => ({ ownerId: Number(item.ownerId), amount: Math.trunc(Number(item.amount)) }))
    .filter((item) => Number.isSafeInteger(item.ownerId) && ownerIds.includes(item.ownerId) && Number.isSafeInteger(item.amount) && item.amount > 0)
    .slice(0, 50);

  const settings = await getDeedSettings(workspaceId);
  const result = computeAppropriation({
    basisProfit,
    salaries,
    interestOnCapital: {
      enabled: settings.interestOnCapitalEnabled,
      pctPerAnnum: settings.interestOnCapitalPct ?? 0,
      capitals: ownerIds.map((ownerId) => ({ ownerId, openingCapital: capitalById.get(ownerId) ?? 0 })),
      days,
    },
    interestOnDrawings: {
      enabled: settings.interestOnDrawingsEnabled,
      pctPerAnnum: settings.interestOnDrawingsPct ?? 0,
      drawings: drawingRows.map((row) => ({ ownerId: Number(row.ownerId), date: String(row.date).slice(0, 10), amount: Number(row.amount) })),
      periodTo: to,
    },
    psr: psr.map((entry) => ({ ownerId: entry.ownerId, ratio: entry.ratio })),
  });

  const psrById = new Map(psr.map((entry) => [entry.ownerId, entry]));
  const shareMismatchTotal = owners.reduce((sum, owner) => sum + (shareAt(pointsFor(Number(owner.id), Number(owner.share)), to) ?? Number(owner.share)), 0);

  const lines = result.lines.map((line) => ({
    ownerId: line.ownerId,
    name: nameById.get(line.ownerId) ?? `Partner ${line.ownerId}`,
    salary: line.salary,
    interestCapital: line.interestCapital,
    interestDrawings: line.interestDrawings,
    share: line.share,
    // Appropriation credit per partner. Interest on drawings is a separate debit (shown apart in the preview).
    total: line.salary + line.interestCapital + line.share,
  }));

  const notes: string[] = [];
  if (result.lossPeriod) notes.push('Loss period: salaries and interest are not paid (Partnership Act 1932 s.13(c)). The loss is shared by PSR.');
  if (result.salaryCapped) notes.push('Deed salaries exceeded the profit; each salary was scaled down pro-rata so the total equals the available profit.');
  if (result.interestCapitalCapped) notes.push('Interest on capital was capped by the profit remaining after salary, per s.13(c) (interest only out of profits).');
  notes.push('Capital is the opening balance at the period start; contributions made during the period are not day-weighted in v1.');

  return {
    from, to, days,
    lossPeriod: result.lossPeriod,
    basisProfit,
    segments,
    psr: owners.map((owner) => { const entry = psrById.get(Number(owner.id))!; return { ownerId: Number(owner.id), name: owner.name, ratio: entry.ratio, weight: entry.weight }; }),
    salaries: salaries.map((item) => ({ ...item, name: nameById.get(item.ownerId) ?? `Partner ${item.ownerId}` })),
    salaryTotal: result.salaryTotal,
    salaryCapped: result.salaryCapped,
    capitals: ownerIds.map((ownerId) => ({ ownerId, name: nameById.get(ownerId) ?? `Partner ${ownerId}`, openingCapital: capitalById.get(ownerId) ?? 0, interest: result.lines.find((line) => line.ownerId === ownerId)?.interestCapital ?? 0 })),
    interestCapitalTotal: result.interestCapitalTotal,
    interestCapitalCapped: result.interestCapitalCapped,
    drawingsInterest: ownerIds.map((ownerId) => ({ ownerId, name: nameById.get(ownerId) ?? `Partner ${ownerId}`, interest: result.lines.find((line) => line.ownerId === ownerId)?.interestDrawings ?? 0 })),
    interestDrawingsTotal: result.interestDrawingsTotal,
    residual: result.residual,
    shareMismatchTotal: Math.round(shareMismatchTotal * 100) / 100,
    lines,
    roundingNote: 'Largest-remainder rounding. Allocations sum exactly to the residual, always.',
    notes,
  };
}

export type PostDistributionInput = { from: string; to: string; salaries: WorkingsSalary[]; note?: string; confirmShareMismatch?: boolean };

export async function postDistribution(workspaceId: number, input: PostDistributionInput, actor: { name: string; userId: number | null }) {
  const workings = await computeDistributionWorkings(workspaceId, input.from, input.to, input.salaries);
  // Overlap guard: at most one POSTED distribution per period.
  const overlap = await db.prepare(`SELECT id FROM profit_distributions WHERE workspace_id = ? AND status = 'POSTED' AND NOT (period_to < ? OR period_from > ?) LIMIT 1`)
    .get(workspaceId, input.from, input.to) as { id: number } | undefined;
  if (overlap) throw new DistributionError(`This period overlaps distribution #${overlap.id} you already posted. Void it first if you need to redo it.`);
  if (workings.basisProfit === 0) throw new DistributionError('Nothing to distribute: income equals expenses for this period.');
  const mismatch = Math.abs(workings.shareMismatchTotal - 100) > 0.01;
  if (mismatch && input.confirmShareMismatch !== true) {
    throw new DistributionError(`Recorded shares total ${workings.shareMismatchTotal}% (not 100%). Tick the confirmation in the dialog to distribute anyway.`);
  }

  const actorName = actor.name || 'Workspace member';
  return db.transaction(async () => {
    const inserted = await db.prepare(`INSERT INTO profit_distributions (workspace_id, period_from, period_to, basis_profit, salary_total, interest_capital_total, interest_drawings_total, residual_distributed, status, workings_json, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, ?, ?)`)
      .run(workspaceId, input.from, input.to, workings.basisProfit, workings.salaryTotal, workings.interestCapitalTotal,
        workings.interestDrawingsTotal, workings.residual, JSON.stringify(workings), (input.note ?? '').trim().slice(0, 300), actorName);
    const distributionId = Number(inserted.lastInsertRowid);
    const ratioById = new Map(workings.psr.map((entry) => [entry.ownerId, entry.ratio]));
    for (const line of workings.lines) {
      const split = ratioById.get(line.ownerId) ?? null;
      const postings: Array<{ entryType: string; direction: 'CREDIT' | 'DEBIT'; amount: number }> = [
        { entryType: 'PARTNER_SALARY', direction: 'CREDIT', amount: line.salary },
        { entryType: 'INTEREST_ON_CAPITAL', direction: 'CREDIT', amount: line.interestCapital },
        { entryType: 'INTEREST_ON_DRAWINGS', direction: 'DEBIT', amount: line.interestDrawings },
        line.share >= 0
          ? { entryType: 'PROFIT_SHARE', direction: 'CREDIT', amount: line.share }
          : { entryType: 'LOSS_SHARE', direction: 'DEBIT', amount: -line.share },
      ];
      for (const posting of postings) {
        if (posting.amount <= 0) continue;
        await db.prepare(`INSERT INTO partner_entries (workspace_id, owner_id, entry_type, direction, amount, transaction_id, distribution_id, split_share, note, transaction_date, created_by)
          VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`)
          .run(workspaceId, line.ownerId, posting.entryType, posting.direction, posting.amount, distributionId, split,
            `Distribution #${distributionId} · ${input.from} to ${input.to}`, `${input.to}T12:00:00.000Z`, actorName);
      }
    }
    await audit(workspaceId, null, 'DISTRIBUTION_POSTED', {
      distributionId, from: input.from, to: input.to, basisProfit: workings.basisProfit, salaryTotal: workings.salaryTotal,
      interestCapitalTotal: workings.interestCapitalTotal, interestDrawingsTotal: workings.interestDrawingsTotal,
      residual: workings.residual, shareMismatch: mismatch, lossPeriod: workings.lossPeriod,
    }, actorName);
    return { id: distributionId, workings };
  })();
}

export async function voidDistribution(workspaceId: number, distributionId: number, reason: string, actor: { name: string; userId: number | null }) {
  const trimmed = reason.trim();
  if (!trimmed) throw new DistributionError('Say why this distribution is being voided.');
  const row = await db.prepare('SELECT id, status FROM profit_distributions WHERE id = ? AND workspace_id = ?').get(distributionId, workspaceId) as { id: number; status: string } | undefined;
  if (!row) throw new DistributionError('The selected distribution was not found.');
  if (row.status !== 'POSTED') throw new DistributionError('This distribution is already void.');
  const actorName = actor.name || 'Workspace member';
  return db.transaction(async () => {
    await db.prepare("UPDATE profit_distributions SET status = 'VOID' WHERE id = ? AND workspace_id = ?").run(distributionId, workspaceId);
    const entries = await db.prepare('SELECT owner_id AS ownerId, direction, amount FROM partner_entries WHERE distribution_id = ? AND workspace_id = ?')
      .all(distributionId, workspaceId) as Array<{ ownerId: number; direction: 'CREDIT' | 'DEBIT'; amount: number }>;
    let mirrored = 0;
    for (const entry of entries) {
      if (entry.amount <= 0) continue;
      const flipped: 'CREDIT' | 'DEBIT' = entry.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
      await db.prepare(`INSERT INTO partner_entries (workspace_id, owner_id, entry_type, direction, amount, transaction_id, distribution_id, split_share, note, transaction_date, created_by)
        VALUES (?, ?, 'CORRECTION', ?, ?, NULL, ?, NULL, ?, ?, ?)`)
        .run(workspaceId, entry.ownerId, flipped, entry.amount, distributionId,
          `Void distribution #${distributionId}: ${trimmed}`.slice(0, 300), `${today()}T12:00:00.000Z`, actorName);
      mirrored += 1;
    }
    await audit(workspaceId, null, 'DISTRIBUTION_VOIDED', { distributionId, reason: trimmed, entriesMirrored: mirrored }, actorName);
    return { id: distributionId, entriesMirrored: mirrored };
  })();
}

export async function listDistributions(workspaceId: number, limit = 20) {
  const rows = await db.prepare(`SELECT id, period_from AS periodFrom, period_to AS periodTo, basis_profit AS basisProfit,
      salary_total AS salaryTotal, interest_capital_total AS interestCapitalTotal, interest_drawings_total AS interestDrawingsTotal,
      residual_distributed AS residual, status, note, created_by AS createdBy, substr(created_at, 1, 10) AS createdAt
    FROM profit_distributions WHERE workspace_id = ? ORDER BY substr(period_to, 1, 10) DESC, id DESC LIMIT ?`)
    .all(workspaceId, Math.min(Math.max(1, limit), 100)) as Array<{ id: number; periodFrom: string; periodTo: string; basisProfit: number; salaryTotal: number; interestCapitalTotal: number; interestDrawingsTotal: number; residual: number; status: string; note: string; createdBy: string; createdAt: string }>;
  return rows.map((row) => ({ ...row, basisProfit: Number(row.basisProfit), salaryTotal: Number(row.salaryTotal), interestCapitalTotal: Number(row.interestCapitalTotal), interestDrawingsTotal: Number(row.interestDrawingsTotal), residual: Number(row.residual) }));
}

/**
 * Accrued-but-undistributed estimate per partner, plus lifetime drawings.
 * = PROFIT_SHARE already POSTed (final) + live estimate since the day after the
 * latest POSTED distribution (or month start). Never stored; always computed.
 */
export async function computeAccruedEstimates(workspaceId: number, ownerIds: number[]) {
  const result = new Map<number, { accrued: number; drawingsLifetime: number }>();
  const postedRows = await db.prepare(`SELECT pe.owner_id AS ownerId, SUM(pe.amount) AS total FROM partner_entries pe
    JOIN profit_distributions pd ON pd.id = pe.distribution_id
    WHERE pe.workspace_id = ? AND pd.status = 'POSTED' AND pe.entry_type = 'PROFIT_SHARE' AND pe.direction = 'CREDIT'
    GROUP BY pe.owner_id`).all(workspaceId) as Array<{ ownerId: number; total: number }>;
  const postedMap = new Map(postedRows.map((row) => [Number(row.ownerId), Number(row.total)]));
  const drawingRows = await db.prepare(`SELECT owner_id AS ownerId, SUM(amount) AS total FROM partner_entries WHERE workspace_id = ? AND entry_type = 'CASH_WITHDRAWAL' GROUP BY owner_id`)
    .all(workspaceId) as Array<{ ownerId: number; total: number }>;
  const drawingsMap = new Map(drawingRows.map((row) => [Number(row.ownerId), Number(row.total)]));

  const latest = await db.prepare(`SELECT MAX(period_to) AS periodTo FROM profit_distributions WHERE workspace_id = ? AND status = 'POSTED'`).get(workspaceId) as { periodTo: string | null } | undefined;
  const since = latest?.periodTo ? addDays(String(latest.periodTo).slice(0, 10), 1) : monthStart();
  const liveByOwner = new Map<number, number>();
  if (since <= today()) {
    try {
      const workings = await computeDistributionWorkings(workspaceId, since, today(), []);
      for (const line of workings.lines) liveByOwner.set(line.ownerId, Math.max(0, line.share));
    } catch (error) {
      console.error('Accrued estimate failed', error);
    }
  }
  for (const id of ownerIds) {
    result.set(id, { accrued: Number(postedMap.get(id) ?? 0) + Number(liveByOwner.get(id) ?? 0), drawingsLifetime: Number(drawingsMap.get(id) ?? 0) });
  }
  return result;
}
