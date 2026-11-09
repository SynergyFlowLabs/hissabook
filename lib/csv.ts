/** Shared CSV helpers: Excel-safe cells, integer amounts, attachment responses. */
export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const looksLikePlainNumber = /^-?\d+(\.\d+)?$/.test(text.trim());
  const safe = looksLikePlainNumber ? text : /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Plain integer amounts must not trip the formula-injection guard (no leading = + - @ semantics for numbers). */
export const csvNum = (value: number) => String(Math.trunc(Number(value) || 0));

/** Builds a UTF-8 BOM CSV attachment body from meta lines, headers and rows. */
export function csvAttachment(meta: string[], headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [
    ...meta.map((line) => csvCell(line)),
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map((cell) => (typeof cell === 'number' ? String(cell) : csvCell(cell))).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}
