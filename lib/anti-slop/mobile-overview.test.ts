import { describe, expect, it } from 'vitest';
import { formatPKR, greetingFor } from '../format';

const read = (path: string) => import('node:fs').then((fs) => fs.readFileSync(path, 'utf8'));
const heroPanelCss = async () => {
  const css = await read('app/globals.css');
  return css.slice(css.indexOf('.hero-panel {'), css.indexOf('.quick-actions {'));
};

/**
 * Guards the mobile Overview fixes made for the 2026-11-09 Android Chrome
 * screenshot (375 to 412px wide). Like the other UI guards in this repo these
 * are source-level: there is no DOM runner here, and each rule below is written
 * once in one place, so a regression shows up as a one-line diff.
 */
describe('time-of-day greeting (overview heading)', () => {
  it('never says morning outside the morning hours', () => {
    const at = (hour: number) => greetingFor(new Date(2026, 10, 9, hour, 38));
    expect(at(22)).toBe('Good evening');
    expect(at(0)).toBe('Good evening');
    expect(at(4)).toBe('Good evening');
    expect(at(5)).toBe('Good morning');
    expect(at(11)).toBe('Good morning');
    expect(at(12)).toBe('Good afternoon');
    expect(at(16)).toBe('Good afternoon');
    expect(at(17)).toBe('Good evening');
    expect(at(23)).toBe('Good evening');
  });

  it('is driven by the clock, not a hardcoded string, on the dashboard', async () => {
    const source = await read('app/dashboard.tsx');
    expect(source).toContain('{greetingFor()}, ');
    expect(source).not.toContain('Good morning, {');
  });
});

describe('one money prefix across the product (PKR, never the ₨ monogram)', () => {
  it('formats with the PKR prefix and en-PK grouping', () => {
    expect(formatPKR(519850)).toBe('PKR 519,850');
    expect(formatPKR(0)).toBe('PKR 0');
    expect(formatPKR(-4200)).toBe('−PKR 4,200');
  });

  it('leaves no rupee glyph in rendered strings', async () => {
    const screens = [
      'app/dashboard.tsx', 'app/reports/reports-client.tsx', 'app/transactions/transactions-client.tsx',
      'app/team/team-client.tsx', 'app/inventory/inventory-client.tsx', 'app/partners/partners-client.tsx',
      'components/landing-page.tsx', 'lib/partners/store.ts',
    ];
    for (const screen of screens) expect({ screen, glyphs: (await read(screen)).split('₨').length - 1 }).toEqual({ screen, glyphs: 0 });
  });
});

describe('hero card survives a 375px viewport (R-03)', () => {
  it('lets both grid tracks shrink instead of sizing to the quick-actions row', async () => {
    const dashboard = await read('app/dashboard.tsx');
    // Every two-column overview section must state an explicit single column;
    // an implicit `auto` track sizes to min-content, and the 6-icon quick
    // actions row is ~506px of min-content, which blew the whole page wider
    // than the phone and clipped the hero card at the right edge.
    const sections = dashboard.match(/className="grid[^"]*"/g) ?? [];
    const twoColumn = sections.filter((value) => value.includes('xl:grid-cols-'));
    expect(twoColumn.length).toBe(3);
    for (const section of twoColumn) expect(section).toContain('grid-cols-1');
  });

  it('keeps the hero panel and its chips inside the card', async () => {
    const css = await heroPanelCss();
    expect(css).toMatch(/\.hero-panel \{[^}]*min-width: 0;/);
    expect(css).toMatch(/\.hero-chips \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
    expect(css).toContain('@media (max-width: 400px) { .hero-chips { grid-template-columns: minmax(0, 1fr); } }');
    expect(css).toMatch(/\.hero-chip \{[^}]*overflow: hidden;/);
  });

  it('zeroes the min-content of every container a wide child can stretch', async () => {
    const css = await read('app/globals.css');
    // Belt and braces for the same blowout: the quick-actions row, the cards it
    // sits in, and the hero panel all refuse to grow past their track.
    const quickActions = css.slice(css.indexOf('.quick-actions {'), css.indexOf('.quick-action {'));
    expect(quickActions).toMatch(/min-width: 0; max-width: 100%;/);
    expect(css).toMatch(/\.soft-card \{[^}]*min-width: 0;/);
    expect(css).toMatch(/\.card-header-row \{[^}]*flex-wrap: wrap;/);
  });

  it('keeps the workspace chip visible and shrinkable on the hero card', async () => {
    const css = await read('app/globals.css');
    // Slice the single rule, not a block: the hero gained rules between the
    // chip and the amount, and a wide slice would assert nothing useful.
    const start = css.indexOf('.hero-workspace {');
    const rule = css.slice(start, css.indexOf('}', start));
    // It vanished from an earlier screenshot only because overflow pushed it
    // off screen; the fix must not hide it at narrow widths.
    expect(rule).not.toContain('display: none');
    expect(rule).toContain('min-width: 0');
  });

  it('keeps the hero curve from widening the card or burying the balance', async () => {
    const css = await read('app/globals.css');
    const chart = css.slice(css.indexOf('.hero-chart {'), css.indexOf('.hero-chart-foot {'));
    expect(chart).toContain('min-width: 0');
    // A sparkline is context, not a second chart card: keep it short.
    const height = Number(chart.match(/height: (\d+)px/)?.[1]);
    expect(height).toBeGreaterThan(0);
    expect(height).toBeLessThanOrEqual(110);
    // Range buttons are thumb targets on touch.
    expect(css).toMatch(/@media \(pointer: coarse\) \{ \.hero-range button \{ min-height: 40px/);
  });

  it('keeps type legible instead of 8px captions', async () => {
    const css = await heroPanelCss();
    for (const size of css.match(/font-size: ([\d.]+)px/g) ?? []) {
      expect(Number(size.replace(/[^\d.]/g, ''))).toBeGreaterThanOrEqual(9);
    }
  });
});

describe('bottom pill nav neither hides content nor itself (R-03)', () => {
  it('reserves more space below the last card than the pill occupies', async () => {
    const css = await read('app/globals.css');
    // pill = 7px pad + 46px item + 7px pad, floating 14px off the bottom = 74px
    const contentRule = css.slice(css.indexOf('.content {'), css.indexOf('.page-heading'));
    const reserve = Number(contentRule.match(/calc\((\d+)px \+ env\(safe-area-inset-bottom/)?.[1]);
    expect(reserve).toBeGreaterThanOrEqual(94);
    expect(reserve).toBeGreaterThan(74);
  });

  it('does not re-position the active pill with the generic child rule', async () => {
    const css = await read('app/globals.css');
    // `a > *` used to match .mobile-nav-pill and override position: absolute,
    // which stacked the lime pill behind the icon and hid the active label.
    expect(css).toContain('.mobile-nav a > *:not(.mobile-nav-pill)');
    const pill = css.slice(css.indexOf('.mobile-nav-pill {'), css.indexOf('.mobile-nav-pill {') + 200);
    expect(pill).toContain('position: absolute;');
  });
});

describe('quick actions read as a scroller, not a broken grid', () => {
  it('fades the clipped edge and hints that the row continues', async () => {
    const css = await read('app/globals.css');
    const block = css.slice(css.indexOf('.quick-actions {'), css.indexOf('.quick-action {'));
    expect(block).toContain('mask-image');
    expect(block).toContain('overflow-x: auto');
  });
});
