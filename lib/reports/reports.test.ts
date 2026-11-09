import { describe, expect, it } from 'vitest';
import {
  addDays, daysBetweenInclusive, isIsoDay, monthBounds, monthsInRange, quarterBounds,
  rangeLabel, resolveRange, sanitiseRange, dayLabel, monthLabel,
} from './period';
import { BASIS_LINES, biggest, computeTotals, describeResult, monthlySeries, shareOf, sum, topWithOther } from './pl';
import { moneyClass, neutralReason } from './kind';

const cat = (label: string, amount: number, count = 1) => ({ key: label, label, amount, count });

describe('period arithmetic', () => {
  it('accepts only real ISO days', () => {
    expect(isIsoDay('2026-02-28')).toBe(true);
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(isIsoDay('2026-2-3')).toBe(false);
    expect(isIsoDay('')).toBe(false);
  });

  it('finds month bounds including February in a leap year', () => {
    expect(monthBounds(2026, 10)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthBounds(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('finds quarter bounds', () => {
    expect(quarterBounds(2026, 1)).toEqual({ from: '2026-01-01', to: '2026-03-31' });
    expect(quarterBounds(2026, 4)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
  });

  it('counts days inclusively and refuses inverted ranges', () => {
    expect(daysBetweenInclusive('2026-10-01', '2026-10-01')).toBe(1);
    expect(daysBetweenInclusive('2026-10-01', '2026-10-31')).toBe(31);
    expect(daysBetweenInclusive('2026-10-31', '2026-10-01')).toBe(0);
  });

  it('resolves presets against an explicit anchor, not the clock', () => {
    expect(resolveRange('this-month', '2026-01-15')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    // January's previous month is December of the year before.
    expect(resolveRange('last-month', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(resolveRange('last-30-days', '2026-03-01')).toEqual({ from: '2026-01-31', to: '2026-03-01' });
    expect(resolveRange('this-quarter', '2026-11-09')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(resolveRange('this-year', '2026-11-09')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('never returns a range for junk input', () => {
    const { range, error } = sanitiseRange('2026-02-30', '2026-03-01', '2026-11-09');
    expect(error).not.toBeNull();
    expect(range).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(sanitiseRange('2026-10-31', '2026-10-01', '2026-11-09').error).not.toBeNull();
    expect(sanitiseRange('', '', '2026-11-09').error).toBeNull();
  });

  it('lists the months a range touches, oldest first', () => {
    expect(monthsInRange({ from: '2026-10-15', to: '2026-12-02' })).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(monthsInRange({ from: '2026-11-02', to: '2026-11-01' })).toEqual([]);
  });

  it('labels dates for humans without en or em dashes', () => {
    expect(dayLabel('2026-10-01')).toBe('01 Oct 2026');
    expect(monthLabel('2026-10')).toBe('Oct 2026');
    const label = rangeLabel({ from: '2026-10-01', to: '2026-10-31' });
    expect(label).toBe('01 Oct 2026 to 31 Oct 2026');
    expect(/[\u2013\u2014]/.test(label)).toBe(false);
  });
});

describe('classification keeps kinds apart', () => {
  it('counts only INCOME as income and only EXPENSE as expense', () => {
    expect(moneyClass('INCOME')).toBe('income');
    expect(moneyClass('EXPENSE')).toBe('expense');
    for (const kind of ['TRANSFER', 'CONTRIBUTION', 'WITHDRAWAL', 'LOAN_RECEIVED', 'LOAN_GIVEN']) {
      expect(moneyClass(kind)).toBe('neutral');
    }
  });

  it('recognises salary and stock rows as expenses that are already counted once', () => {
    expect(moneyClass('EXPENSE', 'SALARY_PAYMENT')).toBe('expense');
    expect(moneyClass('EXPENSE', 'INVENTORY_PURCHASE')).toBe('expense');
  });

  it('explains every neutral kind in plain words', () => {
    for (const kind of ['TRANSFER', 'CONTRIBUTION', 'WITHDRAWAL', 'LOAN_RECEIVED', 'LOAN_GIVEN', 'SOMETHING_ELSE']) {
      expect(neutralReason(kind).length).toBeGreaterThan(5);
    }
  });
});

describe('profit arithmetic', () => {
  it('adds income and fees, subtracts expenses and fees', () => {
    const totals = computeTotals({
      income: [cat('Sales', 100_000), cat('Services', 50_000)],
      expenses: [cat('Rent', 30_000)],
      feesReceived: 2_500,
      feesPaid: 1_000,
    });
    expect(totals.income).toBe(150_000);
    expect(totals.feeIncome).toBe(2_500);
    expect(totals.totalIncome).toBe(152_500);
    expect(totals.totalExpenses).toBe(31_000);
    expect(totals.netProfit).toBe(121_500);
    expect(totals.marginPct).toBe(79.7);
  });

  it('reports a loss as a negative number instead of dropping the sign', () => {
    const totals = computeTotals({ income: [cat('Sales', 20_000)], expenses: [cat('Rent', 45_000)], feesReceived: 0, feesPaid: 0 });
    expect(totals.netProfit).toBe(-25_000);
    expect(describeResult(totals)).toContain('higher than cleared income');
  });

  it('has no margin when there is no income to take a share of', () => {
    const totals = computeTotals({ income: [], expenses: [cat('Rent', 5_000)], feesReceived: 0, feesPaid: 0 });
    expect(totals.marginPct).toBeNull();
    expect(describeResult(totals)).toContain('higher than cleared income');
  });

  it('never lets a negative fee reduce a total', () => {
    const totals = computeTotals({ income: [], expenses: [], feesReceived: -500, feesPaid: -500 });
    expect(totals.feeIncome).toBe(0);
    expect(totals.feeExpense).toBe(0);
    expect(totals.netProfit).toBe(0);
  });

  it('is empty and honest with no data at all', () => {
    const totals = computeTotals({ income: [], expenses: [], feesReceived: 0, feesPaid: 0 });
    expect(describeResult(totals)).toBe('No cleared income or expenses in this period.');
  });
});

describe('category presentation', () => {
  it('sums rows and finds the biggest', () => {
    const rows = [cat('Rent', 30_000), cat('Payroll', 90_000), cat('Tools', 1_000)];
    expect(sum(rows)).toBe(121_000);
    expect(biggest(rows)?.label).toBe('Payroll');
    expect(biggest([])).toBeNull();
  });

  it('computes a share and refuses to divide by zero', () => {
    const rows = [cat('Rent', 25_000), cat('Payroll', 75_000)];
    expect(shareOf(rows[0], rows)).toBe(25);
    expect(shareOf(rows[0], [])).toBeNull();
  });

  it('collapses the tail into one Other row that still adds up', () => {
    const rows = Array.from({ length: 12 }, (_, index) => cat(`Category ${index}`, (index + 1) * 1_000));
    const collapsed = topWithOther(rows, 5);
    expect(collapsed).toHaveLength(6);
    expect(collapsed.at(-1)?.label).toBe('Other (7 categories)');
    expect(sum(collapsed)).toBe(sum(rows));
  });

  it('keeps every category when the list is short', () => {
    const rows = [cat('A', 1), cat('B', 2)];
    expect(topWithOther(rows, 8)).toHaveLength(2);
  });

  it('fills missing months with zeroes so the timeline cannot shift', () => {
    const series = monthlySeries(['2026-09', '2026-10', '2026-11'], [{ month: '2026-10', income: 500, expenses: 200 }]);
    expect(series).toEqual([
      { month: '2026-09', income: 0, expenses: 0 },
      { month: '2026-10', income: 500, expenses: 200 },
      { month: '2026-11', income: 0, expenses: 0 },
    ]);
  });
});

describe('report copy', () => {
  it('states the counting basis and disclaims authority', () => {
    const text = BASIS_LINES.join(' ');
    expect(text).toContain('Only cleared records are counted');
    expect(text).toContain('not income or expenses');
    expect(text.toLowerCase()).toContain('not audited accounts');
  });

  it('uses no em or en dashes in anything the user reads', () => {
    expect(BASIS_LINES.filter((line) => /[\u2013\u2014]/.test(line))).toEqual([]);
  });
});
