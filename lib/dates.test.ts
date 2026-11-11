import { describe, expect, it } from 'vitest';
import { formatDay, parseDay, toDay, todayDay } from './dates';

/**
 * Dates are stored as `yyyy-mm-dd` and rendered in the user's own calendar day.
 * The usual bug is `new Date('2026-11-11')`, which is midnight UTC and shows as
 * the 10th for anyone west of Greenwich, so these assertions pin the local
 * behaviour rather than just the string shape.
 */
describe('date helpers', () => {
  it('parses a day into that same local day, never the day before', () => {
    const date = parseDay('2026-11-11');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(11);
  });

  it('round-trips a day through Date without drifting', () => {
    for (const day of ['2026-01-01', '2026-02-28', '2026-12-31', '2024-02-29']) {
      const parsed = parseDay(day);
      expect(parsed, day).toBeInstanceOf(Date);
      expect(toDay(parsed as Date)).toBe(day);
    }
  });

  it('treats an empty value as no date instead of today', () => {
    expect(parseDay('')).toBeUndefined();
    expect(parseDay(undefined)).toBeUndefined();
    expect(parseDay(null)).toBeUndefined();
    expect(formatDay('')).toBe('');
  });

  it('renders the one shared field format', () => {
    expect(formatDay('2026-11-11')).toBe('11 Nov 2026');
    expect(formatDay('2026-01-05')).toBe('05 Jan 2026');
  });

  it('formats today the same way it stores today', () => {
    expect(formatDay(todayDay())).toBe(formatDay(toDay(new Date())));
  });
});
