/** PKR formatting — `₨ 1,234,567` (integer, en-PK grouping). */
export function formatPKR(value: number): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}₨ ${Math.abs(Math.round(value)).toLocaleString('en-PK')}`;
}
