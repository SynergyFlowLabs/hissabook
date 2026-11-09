/**
 * Date-range and period arithmetic for reports.
 *
 * Everything here is plain calendar arithmetic on `YYYY-MM-DD` strings: no
 * timezone, no `Date` arithmetic across DST, no implicit "today". Reports take
 * an explicit range so a printed statement never depends on when it was opened.
 */

export type RangePreset = 'this-month' | 'last-month' | 'last-30-days' | 'this-quarter' | 'this-year' | 'custom';

export type DateRange = { from: string; to: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Days in a month, `month` is 1-12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthBounds(year: number, month: number): DateRange {
  const last = daysInMonth(year, month);
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  };
}

/** Calendar quarter (1-4) bounds for a year. */
export function quarterBounds(year: number, quarter: number): DateRange {
  const startMonth = (Math.min(Math.max(quarter, 1), 4) - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return { from: monthBounds(year, startMonth).from, to: monthBounds(year, endMonth).to };
}

export function addDays(day: string, days: number): string {
  const base = new Date(`${day}T12:00:00.000Z`).getTime();
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive day count; 0 when the range is inverted. */
export function daysBetweenInclusive(from: string, to: string): number {
  if (!isIsoDay(from) || !isIsoDay(to) || from > to) return 0;
  const start = new Date(`${from}T12:00:00.000Z`).getTime();
  const end = new Date(`${to}T12:00:00.000Z`).getTime();
  return Math.round((end - start) / DAY_MS) + 1;
}

/**
 * Resolves a named range against an explicit anchor day. `today` is passed in
 * rather than read from the clock so a report can be reproduced and tested.
 */
export function resolveRange(preset: RangePreset, today: string): DateRange {
  if (!isIsoDay(today)) throw new Error('REPORT_ANCHOR_INVALID');
  const [year, month] = today.split('-').map(Number);
  switch (preset) {
    case 'this-month':
      return monthBounds(year, month);
    case 'last-month':
      return month === 1 ? monthBounds(year - 1, 12) : monthBounds(year, month - 1);
    case 'last-30-days':
      return { from: addDays(today, -29), to: today };
    case 'this-quarter':
      return quarterBounds(year, Math.floor((month - 1) / 3) + 1);
    case 'this-year':
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case 'custom':
    default:
      return { from: today, to: today };
  }
}

/** Normalises a user-supplied range, falling back to the current month. */
export function sanitiseRange(from: string, to: string, today: string): { range: DateRange; error: string | null } {
  if (!from || !to) return { range: resolveRange('this-month', today), error: null };
  if (!isIsoDay(from) || !isIsoDay(to)) return { range: resolveRange('this-month', today), error: 'Enter a valid report start and end date.' };
  if (from > to) return { range: resolveRange('this-month', today), error: 'The report start date must be on or before the end date.' };
  return { range: { from, to }, error: null };
}

/** Month keys touched by a range, oldest first, e.g. ['2026-09', '2026-10']. */
export function monthsInRange({ from, to }: DateRange): string[] {
  if (!isIsoDay(from) || !isIsoDay(to) || from > to) return [];
  const months: string[] = [];
  let [year, month] = from.split('-').map(Number);
  const endKey = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key === endKey) break;
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    if (months.length > 240) break; // 20 years is a guard, not a use case
  }
  return months;
}

/** Human label used in headings and CSV meta lines, e.g. "01 Oct 2026 to 31 Oct 2026". */
export function rangeLabel(range: DateRange): string {
  return `${dayLabel(range.from)} to ${dayLabel(range.to)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayLabel(day: string): string {
  if (!isIsoDay(day)) return day;
  const [year, month, date] = day.split('-');
  return `${date} ${MONTHS[Number(month) - 1]} ${year}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}
