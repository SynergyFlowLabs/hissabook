import { describe, expect, it } from 'vitest';
import {
  addDays,
  apportion,
  computeAppropriation,
  dayWeightedPsr,
  daysBetweenInclusive,
  periodSegments,
  positionFromLines,
  shareAt,
} from './ledger';

const pts = (rows: Array<[string, number]>) => rows.map(([date, share]) => ({ date, share }));

describe('shareAt', () => {
  it('returns the latest share at or before the date', () => {
    const points = pts([['2026-01-01', 45], ['2026-09-15', 40]]);
    expect(shareAt(points, '2026-03-01')).toBe(45);
    expect(shareAt(points, '2026-09-15')).toBe(40);
    expect(shareAt(points, '2026-12-31')).toBe(40);
  });
  it('returns null when nothing covers the date', () => {
    expect(shareAt(pts([['2026-06-01', 50]]), '2026-01-01')).toBeNull();
  });
});

describe('daysBetweenInclusive / addDays', () => {
  it('counts both endpoints', () => {
    expect(daysBetweenInclusive('2026-09-01', '2026-09-30')).toBe(30);
    expect(daysBetweenInclusive('2026-09-15', '2026-09-15')).toBe(1);
  });
  it('addDays rolls across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });
});

describe('periodSegments', () => {
  it('splits only at interior change dates', () => {
    const segments = periodSegments('2026-09-01', '2026-09-30', ['2026-09-15']);
    expect(segments).toEqual([
      { from: '2026-09-01', to: '2026-09-14', days: 14 },
      { from: '2026-09-15', to: '2026-09-30', days: 16 },
    ]);
  });
  it('ignores change dates outside the period', () => {
    const segments = periodSegments('2026-09-01', '2026-09-30', ['2026-08-01', '2026-10-05']);
    expect(segments).toEqual([{ from: '2026-09-01', to: '2026-09-30', days: 30 }]);
  });
});

describe('dayWeightedPsr', () => {
  it('day-weights a mid-period share change', () => {
    const result = dayWeightedPsr([
      { ownerId: 1, points: pts([['2026-09-01', 50], ['2026-09-11', 40]]) },
      { ownerId: 2, points: pts([['2026-09-01', 50], ['2026-09-11', 60]]) },
    ], '2026-09-01', '2026-09-30');
    const a = result.find((r) => r.ownerId === 1)!;
    const b = result.find((r) => r.ownerId === 2)!;
    // 10 days at 50/50 + 20 days at 40/60 => 500+800 = 1300 vs 500+1200 = 1700
    expect(a.weight).toBe(1300);
    expect(b.weight).toBe(1700);
    expect(a.ratio + b.ratio).toBeCloseTo(1, 10);
    expect(a.ratio).toBeCloseTo(1300 / 3000, 10);
  });
  it('normalizes even when recorded shares do not total 100', () => {
    const result = dayWeightedPsr([
      { ownerId: 1, points: pts([['2026-01-01', 30]]) },
      { ownerId: 2, points: pts([['2026-01-01', 30]]) },
    ], '2026-01-01', '2026-01-31');
    expect(result[0].ratio).toBeCloseTo(0.5, 10);
  });
  it('handles a new partner joining mid-period', () => {
    const result = dayWeightedPsr([
      { ownerId: 1, points: pts([['2026-01-01', 100], ['2026-01-16', 50]]) },
      { ownerId: 2, points: pts([['2026-01-16', 50]]) },
    ], '2026-01-01', '2026-01-31');
    const founder = result.find((r) => r.ownerId === 1)!;
    const joiner = result.find((r) => r.ownerId === 2)!;
    expect(founder.weight).toBe(15 * 100 + 16 * 50);
    expect(joiner.weight).toBe(16 * 50);
  });
});

describe('apportion', () => {
  it('splits 100 equally three ways to 34/33/33 with exact sum', () => {
    expect(apportion(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });
  it('apportions loss magnitude exactly', () => {
    expect(apportion(101, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(101);
  });
  it('returns zeros for zero weights', () => {
    expect(apportion(500, [0, 0])).toEqual([0, 0]);
  });
  it('respects weights proportionally', () => {
    const parts = apportion(1000, [3, 1]);
    expect(parts).toEqual([750, 250]);
  });
});

describe('computeAppropriation', () => {
  const basePsr = [
    { ownerId: 1, ratio: 0.45 },
    { ownerId: 2, ratio: 0.35 },
    { ownerId: 3, ratio: 0.2 },
  ];
  const input = (overrides: Partial<Parameters<typeof computeAppropriation>[0]> = {}) => ({
    basisProfit: 90_000,
    salaries: [],
    interestOnCapital: { enabled: false, pctPerAnnum: 0, capitals: [], days: 30 },
    interestOnDrawings: { enabled: false, pctPerAnnum: 0, drawings: [], periodTo: '2026-09-30' },
    psr: basePsr,
    ...overrides,
  });

  it('shares a simple profit by PSR exactly', () => {
    const result = computeAppropriation(input());
    expect(result.lossPeriod).toBe(false);
    expect(result.residual).toBe(90_000);
    expect(result.lines.map((l) => l.share)).toEqual([40_500, 31_500, 18_000]);
    expect(result.lines.reduce((s, l) => s + l.share, 0)).toBe(90_000);
  });

  it('handles a loss period: no salary, no interest, loss split exactly', () => {
    const result = computeAppropriation(input({
      basisProfit: -30_000,
      salaries: [{ ownerId: 1, amount: 10_000 }],
      interestOnCapital: { enabled: true, pctPerAnnum: 6, capitals: [{ ownerId: 1, openingCapital: 1_000_000 }], days: 30 },
    }));
    expect(result.lossPeriod).toBe(true);
    expect(result.salaryTotal).toBe(0);
    expect(result.interestCapitalTotal).toBe(0);
    expect(result.lines.reduce((s, l) => s + l.share, 0)).toBe(-30_000);
  });

  it('pays salaries first, then splits the residual', () => {
    const result = computeAppropriation(input({ salaries: [{ ownerId: 1, amount: 20_000 }] }));
    expect(result.salaryTotal).toBe(20_000);
    expect(result.residual).toBe(70_000);
    expect(result.lines.find((l) => l.ownerId === 1)!.salary).toBe(20_000);
    expect(result.lines.reduce((s, l) => s + l.share, 0) + result.salaryTotal).toBe(90_000);
  });

  it('caps salary at available profit when deed salaries exceed it', () => {
    const result = computeAppropriation(input({ basisProfit: 15_000, salaries: [{ ownerId: 1, amount: 10_000 }, { ownerId: 2, amount: 10_000 }] }));
    expect(result.salaryCapped).toBe(true);
    expect(result.salaryTotal).toBe(15_000);
    expect(result.residual).toBe(0);
  });

  it('caps interest on capital by remaining profit (s.13(c)) and never goes negative', () => {
    const result = computeAppropriation(input({
      basisProfit: 10_000,
      salaries: [],
      interestOnCapital: { enabled: true, pctPerAnnum: 12, capitals: [{ ownerId: 1, openingCapital: 5_000_000 }, { ownerId: 2, openingCapital: 1_000_000 }], days: 365 },
    }));
    expect(result.interestCapitalCapped).toBe(true);
    expect(result.interestCapitalTotal).toBeLessThanOrEqual(10_000);
    expect(result.residual).toBeGreaterThanOrEqual(0);
    expect(result.lines.find((l) => l.ownerId === 1)!.interestCapital).toBeGreaterThan(result.lines.find((l) => l.ownerId === 2)!.interestCapital);
  });

  it('adds interest on drawings back into the residual', () => {
    const plain = computeAppropriation(input());
    const withDrawings = computeAppropriation(input({
      interestOnDrawings: { enabled: true, pctPerAnnum: 12, drawings: [{ ownerId: 1, date: '2026-09-01', amount: 100_000 }], periodTo: '2026-09-30' },
    }));
    expect(withDrawings.interestDrawingsTotal).toBeGreaterThan(0);
    expect(withDrawings.residual).toBe(plain.residual + withDrawings.interestDrawingsTotal);
  });

  it('residual allocations always sum exactly to the distributed total', () => {
    const result = computeAppropriation(input({ basisProfit: 100_001, psr: [{ ownerId: 1, ratio: 1 / 3 }, { ownerId: 2, ratio: 1 / 3 }, { ownerId: 3, ratio: 1 / 3 }] }));
    expect(result.lines.reduce((s, l) => s + l.share, 0)).toBe(100_001);
  });
});

describe('positionFromLines', () => {
  it('computes fronted outstanding net of reimbursements', () => {
    const position = positionFromLines([
      { entryType: 'EXPENSE_PAID', direction: 'CREDIT', amount: 10_000 },
      { entryType: 'ADVANCE_REIMBURSED', direction: 'DEBIT', amount: 4_000 },
    ]);
    expect(position.frontedOutstanding).toBe(6_000);
  });

  it('nets the full current account: appropriations + fronted − drawings', () => {
    const position = positionFromLines([
      { entryType: 'PROFIT_SHARE', direction: 'CREDIT', amount: 31_500 },
      { entryType: 'CASH_WITHDRAWAL', direction: 'DEBIT', amount: 25_000 },
      { entryType: 'EXPENSE_PAID', direction: 'CREDIT', amount: 18_500 },
      { entryType: 'ADVANCE_REIMBURSED', direction: 'DEBIT', amount: 10_000 },
    ]);
    expect(position.settleable).toBe(31_500 + 18_500 - 10_000 - 25_000);
    expect(position.netValue).toBe(position.settleable + position.capitalBalance);
  });

  it('keeps capital separate from the settleable current account', () => {
    const position = positionFromLines([
      { entryType: 'CAPITAL_CONTRIBUTION', direction: 'CREDIT', amount: 50_000 },
      { entryType: 'CAPITAL_RETURN', direction: 'DEBIT', amount: 5_000 },
      { entryType: 'PROFIT_SHARE', direction: 'CREDIT', amount: 10_000 },
    ]);
    expect(position.capitalBalance).toBe(45_000);
    expect(position.settleable).toBe(10_000);
  });

  it('treats CORRECTION rows by their explicit direction', () => {
    const position = positionFromLines([
      { entryType: 'CORRECTION', direction: 'DEBIT', amount: 1_000 },
      { entryType: 'CORRECTION', direction: 'CREDIT', amount: 2_500 },
    ]);
    expect(position.settleable).toBe(1_500);
  });
});
