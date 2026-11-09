/**
 * Partner ledger — data access shared by API routes and demo seeding.
 * All postings run inside the caller's db.transaction (or open one).
 */
import { db } from '@/lib/database';
import { ENTRY_DIRECTION, positionFromLines, type PositionLine } from './ledger';

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
      const note = [funderSummary, (input.note ?? '').trim()].filter(Boolean).join(' — ').slice(0, 1000);
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
        const transactionId = await insertTransaction(workspaceId, base.accountId, 'WITHDRAWAL', amount, `${partner.name} · Counter drawing`, 'Partner drawing', '', note, date, actorName, partnerId, 'ACCOUNT');
        await insertEntry(workspaceId, partnerId, 'CASH_WITHDRAWAL', 'DEBIT', amount, transactionId, date, note || 'Counter drawing', actorName);
        await audit(workspaceId, transactionId, 'PARTNER_DRAWING', { amount, accountId, partnerId }, actorName);
        return { transactionId, title: 'Counter drawing recorded', body: `₨ ${amount.toLocaleString('en-PK')} · ${partner.name} · ${account.name}` };
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
