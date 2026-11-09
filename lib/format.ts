/**
 * PKR formatting. One money prefix for the whole product: `PKR 1,234,567`
 * (integer, en-PK grouping). The rupee glyph ₨ is intentionally not used
 * because most display fonts fall back to an "Rs" monogram, which read as a
 * second, different currency next to the hero card's "PKR".
 */
export function formatPKR(value: number): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}PKR ${Math.abs(Math.round(value)).toLocaleString('en-PK')}`;
}

/**
 * Time-of-day greeting for the overview heading. The dashboard is a client
 * component, so this reads the device clock rather than the server's: a phone
 * opening the app at 22:38 must never be told "Good morning".
 * Bands: 05:00 to 11:59 morning, 12:00 to 16:59 afternoon, 17:00 to 04:59 evening.
 */
export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}
