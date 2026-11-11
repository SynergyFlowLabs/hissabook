import { describe, expect, it } from 'vitest';

const read = (path: string) => import('node:fs').then((fs) => fs.readFileSync(path, 'utf8'));

/**
 * Guards the transaction ledger and accounts screen fixes made for the
 * 2026-11-11 phone screenshot (375px wide). Like the other anti-slop tests here
 * these are source-level: there is no DOM runner, and each rule below is written
 * once in one place, so a regression is a one-line diff.
 */
describe('the ledger shows records, not a wall of filters', () => {
  it('folds the advanced filters away on phones and says how many are on', async () => {
    const client = await read('app/transactions/transactions-client.tsx');
    // Eight filter fields used to sit open above the results: on a phone the
    // first record was more than a screen below the fold, so the ledger read as
    // empty. Search stays visible; the rest is one tap behind a counted toggle.
    expect(client).toContain('const [filtersOpen, setFiltersOpen] = useState(false)');
    expect(client).toContain('aria-expanded={filtersOpen}');
    expect(client).toContain('aria-controls="ledger-filters"');
    expect(client).toContain('className={`ledger-filters${filtersOpen ? \' is-open\' : \'\'}`}');
    expect(client).toContain('className="filter-count"');

    const css = await read('app/globals.css');
    expect(css).toMatch(/@media \(max-width: 700px\) \{\s*\.ledger-filters \{ display: none; \}/);
    expect(css).toContain('.ledger-filters.is-open { display: grid; }');
    // The fold control must not survive on desktop, where the grid is open.
    expect(css).toContain('@media (min-width: 701px) { .filter-toggle { display: none; } }');
  });

  it('draws the same records as rows the thumb can read below 701px', async () => {
    const client = await read('app/transactions/transactions-client.tsx');
    // The table is 1060px wide: a phone only ever saw Type, Date and part of
    // Description. The phone list carries the amount, the account and any
    // pending/void state instead.
    expect(client).toContain('className={`activity-list');
    expect(client).toContain('activity-amount');
    expect(client).toContain('data-table-wrap ledger-wide');
    const css = await read('app/globals.css');
    expect(css).toContain('.activity-item {');
    expect(css).toMatch(/@media \(max-width: 700px\) \{[\s\S]{0,160}?\.ledger-wide \{ display: none; \}/);
    expect(css).toMatch(/@media \(min-width: 701px\) \{\s*\.activity-list, \.activity-empty \{ display: none; \}/);
  });

  it('keeps the date pair together and labels an empty date', async () => {
    const client = await read('app/transactions/transactions-client.tsx');
    // As two separate grid items From and To were split across rows, leaving a
    // lone empty box under everything else; and an empty native date input is a
    // blank white rectangle on iOS.
    expect(client).toContain('className="form-field ledger-dates"');
    expect(client).toContain('className="ledger-date-pair"');
    expect(client).toContain('ledger-date-hint');
    expect(client).toContain('aria-label="From date"');
    expect(client).toContain('aria-label="To date"');
  });

  it('never lets the two-column filter grid leave a hole at 1181px again', async () => {
    const css = await read('app/globals.css');
    // The old 1181px template had eight tracks for nine cells (search span 2,
    // five selects, From, To), so "To" wrapped onto a line by itself.
    const filters = css.slice(css.indexOf('.ledger-filters {'), css.indexOf('.filter-toggle {'));
    expect(filters).not.toMatch(/repeat\(5, minmax\(110px, 1fr\)\)/);
    expect(filters).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(filters).toContain('.ledger-creator-field, .ledger-dates { grid-column: span 2; }');
  });
});

describe('the accounts screen fills its grid and its rows', () => {
  it('gives the summary one wide tile and two equal cards', async () => {
    const client = await read('app/accounts/accounts-client.tsx');
    // Three tiles in a two-column grid left a hole in the last row (and the
    // shortest card had a ragged height of its own).
    expect(client).toContain('className="stat-grid is-summary"');
    expect(client).toContain('stat-card-wide');
    expect(client).not.toContain('data.workspace.businessType ||');
    const css = await read('app/globals.css');
    expect(css).toContain('.stat-grid.is-summary .stat-card-wide { grid-column: 1 / -1; }');
    expect(css).toMatch(/@media \(min-width: 1025px\) \{\s*\.stat-grid\.is-summary \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
  });

  it('defines the caption class the tiles use', async () => {
    // `.stat-sub` was written in the JSX but never in the stylesheet, so
    // "Across 3 accounts" rendered at body size under a 10px label.
    const css = await read('app/globals.css');
    expect(css).toContain('.stat-sub {');
    const client = await read('app/accounts/accounts-client.tsx');
    expect(client).toContain('className="stat-sub"');
  });

  it('keeps one row action per account, never a dead lock button', async () => {
    const client = await read('app/accounts/accounts-client.tsx');
    // Two icon buttons per row (pencil plus padlock) squeezed the account name
    // and the padlock read as a broken delete. One labelled overflow menu now
    // carries both actions and states the rule when removal is refused.
    expect(client).toContain('className="account-menu-button"');
    expect(client).toContain('aria-label={`Actions for ${account.name}`}');
    expect(client).toContain('Rename account');
    expect(client).toContain('cannot be removed');
    expect(client).toContain('function removable(');
    expect(client).not.toContain('className="icon-row-button archive"');
  });

  it('states the ledger rules as a note, not a centred paragraph', async () => {
    const client = await read('app/accounts/accounts-client.tsx');
    expect(client).toContain('className="card-note"');
    expect(client).toContain('renamed but not removed');
    const css = await read('app/globals.css');
    expect(css).toMatch(/\.card-note \{[^}]*text-align: left;/);
  });
});
