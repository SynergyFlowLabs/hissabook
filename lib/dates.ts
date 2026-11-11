/**
 * Date values travel as `yyyy-mm-dd` strings everywhere in this product: form
 * state, API payloads and the stored records all use that shape. These helpers
 * are the only place that converts them to a Date, and they do it through the
 * local calendar day (never UTC), because `new Date('2026-11-11')` is midnight
 * UTC and lands on the previous day for anyone west of Greenwich.
 */
export function parseDay(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function toDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayDay(): string {
  return toDay(new Date());
}

/** "11 Nov 2026" for a field, a table cell or a statement line. */
export function formatDay(value?: string | null): string {
  const date = parseDay(value);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
