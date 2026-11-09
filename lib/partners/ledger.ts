/**
 * Partner ledger — pure money math for Hisaabook's partner sub-ledger.
 *
 * No I/O in this module: every function takes plain data and returns plain
 * data, which keeps the appropriation engine (Phase 3) and the position
 * queries (Phase 2) exactly testable against fixtures. Amounts are whole
 * PKR integers; shares are REAL percentages (0-100) and day-weights are
 * integer day counts.
 */

export type SharePoint = { date: string; share: number }; // ISO YYYY-MM-DD

export type ShareSegment = { from: string; to: string; days: number };
export type PartnerWeight = {
  ownerId: number;
  /** Sum of day_count x share across the period; not normalized. */
  weight: number;
  /** 0..1 share of total weight; 0 when nobody holds weight. */
  ratio: number;
};
export type DayWeightedShare = {
  ownerId: number;
  weight: number;
  ratio: number;
  /** Effective share for the period, 0..1 (same as ratio). */
  effectiveRatio: number;
};

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  return Date.parse(`${date.slice(0, 10)}T00:00:00.000Z`);
}

export function daysBetweenInclusive(from: string, to: string): number {
  return Math.floor((toUtc(to) - toUtc(from)) / DAY_MS) + 1;
}

/** Latest share at or before `date` from a baseline-first, ascending list. */
export function shareAt(points: SharePoint[], date: string): number | null {
  let value: number | null = null;
  for (const point of points) {
    if (point.date <= date) value = point.share;
    else break;
  }
  return value;
}

/**
 * Split [from, to] (inclusive) into segments at every share-change boundary
 * strictly inside the period. Boundaries at `from` itself are not split.
 */
export function periodSegments(from: string, to: string, changeDates: string[]): ShareSegment[] {
  const interior = [...new Set(changeDates.filter((d) => d > from && d <= to))].sort();
  const boundaries = [from, ...interior, addDays(to, 1)];
  const out: ShareSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const segFrom = boundaries[i];
    const segTo = addDays(boundaries[i + 1], -1);
    if (segFrom > segTo) continue;
    out.push({ from: segFrom, to: segTo, days: daysBetweenInclusive(segFrom, segTo) });
  }
  return out;
}

export function addDays(date: string, days: number): string {
  const d = new Date(toUtc(date) + days * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/**
 * Day-weighted effective profit-sharing ratio for a period.
 * `partners` maps partner -> ascending SharePoints (baseline row first).
 * Falls back to 0 share when a partner has no point covering a segment.
 */
export function dayWeightedPsr(
  partners: Array<{ ownerId: number; points: SharePoint[] }>,
  from: string,
  to: string,
): DayWeightedShare[] {
  const allChangeDates = partners.flatMap((p) => p.points.map((pt) => pt.date));
  const segments = periodSegments(from, to, allChangeDates);
  const raw = partners.map(({ ownerId, points }) => {
    const weight = segments.reduce((sum, seg) => {
      const share = shareAt(points, seg.from) ?? 0;
      return sum + seg.days * share;
    }, 0);
    return { ownerId, weight };
  });
  const total = raw.reduce((sum, r) => sum + r.weight, 0);
  return raw.map(({ ownerId, weight }) => {
    const ratio = total > 0 ? weight / total : 0;
    return { ownerId, weight, ratio, effectiveRatio: ratio };
  });
}

/**
 * Largest-remainder apportionment: integer allocations summing EXACTLY to
 * `total` (in absolute orientation; sign handled by caller). Deterministic
 * tie-break on input order.
 */
export function apportion(totalAbs: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (totalAbs <= 0 || weights.length === 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (totalAbs * w) / sum);
  const floor = exact.map((v) => Math.floor(v));
  let remainder = totalAbs - floor.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));
  for (let k = 0; k < order.length && remainder > 0; k += 1, remainder -= 1) floor[order[k].i] += 1;
  return floor;
}

export type SalaryLine = { ownerId: number; amount: number };

export type AppropriationInput = {
  /** Σ CLEARED INCOME − Σ CLEARED EXPENSE for the period (can be negative). */
  basisProfit: number;
  /** Deed salaries; silently ignored when basisProfit <= 0. */
  salaries: SalaryLine[];
  /** Interest on capital, opt-in. `capitals` is opening capital per partner. */
  interestOnCapital: {
    enabled: boolean;
    pctPerAnnum: number;
    capitals: Array<{ ownerId: number; openingCapital: number }>;
    days: number;
  };
  /** Interest on drawings, opt-in. Drawings listed with their dates. */
  interestOnDrawings: {
    enabled: boolean;
    pctPerAnnum: number;
    drawings: Array<{ ownerId: number; date: string; amount: number }>;
    periodTo: string;
  };
  /** Effective PSR weights (from dayWeightedPsr) applied to the residual. */
  psr: Array<{ ownerId: number; ratio: number }>;
};

export type AppropriationLine = { ownerId: number; salary: number; interestCapital: number; interestDrawings: number; share: number };
export type AppropriationResult = {
  basisProfit: number;
  lossPeriod: boolean;
  salaryTotal: number;
  salaryCapped: boolean;
  interestCapitalTotal: number;
  interestCapitalCapped: boolean;
  interestDrawingsTotal: number;
  residual: number;             // distributed by PSR (negative = loss shared)
  lines: AppropriationLine[];   // per partner, in psr order
  distributedTotal: number;     // residual; apportioned exactly
};

export function computeAppropriation(input: AppropriationInput): AppropriationResult {
  const order = input.psr.map((p) => p.ownerId);
  const zeros = (): AppropriationLine[] => order.map((ownerId) => ({ ownerId, salary: 0, interestCapital: 0, interestDrawings: 0, share: 0 }));

  // Loss period: nothing appropriates except salaries/interest = 0 (s.13(c)).
  if (input.basisProfit <= 0) {
    const loss = -input.basisProfit;
    const shares = apportion(loss, input.psr.map((p) => p.ratio));
    return {
      basisProfit: input.basisProfit,
      lossPeriod: true,
      salaryTotal: 0,
      salaryCapped: input.salaries.length > 0,
      interestCapitalTotal: 0,
      interestCapitalCapped: input.interestOnCapital.enabled,
      interestDrawingsTotal: 0,
      residual: input.basisProfit,
      lines: zeros().map((line, i) => ({ ...line, share: -shares[i] })),
      distributedTotal: input.basisProfit,
    };
  }

  const salaryById = new Map<number, number>(input.salaries.map((s) => [s.ownerId, Math.max(0, Math.trunc(s.amount))]));
  const salarySum = [...salaryById.values()].reduce((a, b) => a + b, 0);
  const salaryCapped = salarySum > input.basisProfit;
  const salaryApplied = salaryCapped ? input.basisProfit : salarySum;
  // Pro-rata haircut when the deed salaries exceed profit (flag, never negative).
  const salaryFactor = salarySum > 0 ? salaryApplied / salarySum : 0;
  const salary = order.map((id) => Math.floor((salaryById.get(id) ?? 0) * salaryFactor));
  const afterSalary = input.basisProfit - salary.reduce((a, b) => a + b, 0);

  // Interest on capital — only out of profits remaining after salary (s.13(c)).
  const iCap = input.interestOnCapital;
  const days = Math.max(0, iCap.days);
  const rawInterest = order.map((id) => {
    if (!iCap.enabled) return 0;
    const cap = Math.max(0, iCap.capitals.find((c) => c.ownerId === id)?.openingCapital ?? 0);
    return (cap * iCap.pctPerAnnum * days) / (100 * 365);
  });
  const rawSum = rawInterest.reduce((a, b) => a + b, 0);
  const availableForInterest = afterSalary; // salaries already out of basis
  const interestCapped = rawSum > availableForInterest;
  const interestSum = interestCapped ? Math.max(0, availableForInterest) : rawSum;
  const interestFactor = rawSum > 0 ? interestSum / rawSum : 0;
  const interestCapital = rawInterest.map((v) => Math.floor(v * interestFactor));
  const interestCapitalTotal = interestCapital.reduce((a, b) => a + b, 0);
  const afterInterest = afterSalary - interestCapitalTotal;

  // Interest on drawings — deed-gated; days from each withdrawal to period end.
  const drawings = input.interestOnDrawings.drawings;
  const interestDrawings = order.map((id) => {
    if (!input.interestOnDrawings.enabled) return 0;
    return Math.floor(
      drawings
        .filter((d) => d.ownerId === id)
        .reduce((sum, d) => {
          const dDays = Math.max(0, Math.floor((Date.parse(`${input.interestOnDrawings.periodTo}T00:00:00Z`) - Date.parse(`${d.date.slice(0, 10)}T00:00:00Z`)) / DAY_MS));
          return sum + (d.amount * input.interestOnDrawings.pctPerAnnum * dDays) / (100 * 365);
        }, 0),
    );
  });
  const interestDrawingsTotal = interestDrawings.reduce((a, b) => a + b, 0);

  const residual = afterInterest + interestDrawingsTotal;
  const shares = apportion(Math.max(0, residual), input.psr.map((p) => p.ratio));

  return {
    basisProfit: input.basisProfit,
    lossPeriod: false,
    salaryTotal: salary.reduce((a, b) => a + b, 0),
    salaryCapped,
    interestCapitalTotal,
    interestCapitalCapped: interestCapped,
    interestDrawingsTotal,
    residual,
    lines: order.map((ownerId, i) => ({
      ownerId,
      salary: salary[i],
      interestCapital: interestCapital[i],
      interestDrawings: interestDrawings[i],
      share: residual >= 0 ? shares[i] : -apportion(-residual, input.psr.map((p) => p.ratio))[i],
    })),
    distributedTotal: residual,
  };
}

/** Entry direction semantics for the partner sub-ledger. */
export const ENTRY_DIRECTION = {
  CAPITAL_CONTRIBUTION: 'CREDIT',
  CAPITAL_RETURN: 'DEBIT',
  EXPENSE_PAID: 'CREDIT',
  ADVANCE_REIMBURSED: 'DEBIT',
  CASH_WITHDRAWAL: 'DEBIT',
  INTEREST_ON_CAPITAL: 'CREDIT',
  INTEREST_ON_DRAWINGS: 'DEBIT',
  PARTNER_SALARY: 'CREDIT',
  PARTNER_COMMISSION: 'CREDIT',
  PROFIT_SHARE: 'CREDIT',
  LOSS_SHARE: 'DEBIT',
} as const;

export type EntryType = keyof typeof ENTRY_DIRECTION | 'SETTLEMENT' | 'CORRECTION';

export type PositionLine = { entryType: string; direction: 'CREDIT' | 'DEBIT'; amount: number };

export type PartnerPosition = {
  capitalBalance: number;        // CAPITAL_CONTRIBUTION − CAPITAL_RETURN (+ settled corrections)
  appropriationsNet: number;     // PROFIT_SHARE − LOSS_SHARE + INT + SALARY + COMMISSION − INTEREST_ON_DRAWINGS
  frontedOutstanding: number;    // EXPENSE_PAID − ADVANCE_REIMBURSED
  drawingsTotal: number;         // Σ CASH_WITHDRAWAL
  /** Settleable current-account balance: what the firm owes (+) / partner overdrew (−). */
  settleable: number;
  /** settleable + capitalBalance — full partner value before goodwill/revaluation. */
  netValue: number;
};

const CAPITAL_CREDIT = new Set(['CAPITAL_CONTRIBUTION']);
const CAPITAL_DEBIT = new Set(['CAPITAL_RETURN']);
const APP_CREDIT = new Set(['PROFIT_SHARE', 'INTEREST_ON_CAPITAL', 'PARTNER_SALARY', 'PARTNER_COMMISSION']);
const APP_DEBIT = new Set(['LOSS_SHARE', 'INTEREST_ON_DRAWINGS']);

/**
 * SETTLEMENT / CORRECTION rows carry explicit directions and count toward the
 * current account (never the capital bucket) unless their note starts with
 * "capital:" — a deliberate, auditable escape hatch recorded at posting time.
 */
export function positionFromLines(lines: PositionLine[]): PartnerPosition {
  let capital = 0;
  let appropriations = 0;
  let fronted = 0;
  let drawings = 0;
  let currentOther = 0;
  for (const line of lines) {
    const sign = line.direction === 'CREDIT' ? 1 : -1;
    const a = line.amount;
    if (CAPITAL_CREDIT.has(line.entryType)) capital += sign * a;
    else if (CAPITAL_DEBIT.has(line.entryType)) capital += sign * a;
    else if (APP_CREDIT.has(line.entryType)) appropriations += sign * a;
    else if (APP_DEBIT.has(line.entryType)) appropriations += sign * a;
    else if (line.entryType === 'EXPENSE_PAID') fronted += sign * a;
    else if (line.entryType === 'ADVANCE_REIMBURSED') fronted += sign * a;
    else if (line.entryType === 'CASH_WITHDRAWAL') drawings += a; // always DEBIT by constraint
    else currentOther += sign * a; // SETTLEMENT, CORRECTION
  }
  const settleable = appropriations + fronted - drawings + currentOther;
  return {
    capitalBalance: capital,
    appropriationsNet: appropriations,
    frontedOutstanding: fronted,
    drawingsTotal: drawings,
    settleable,
    netValue: settleable + capital,
  };
}
