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

  it('centres the pill with insets, never a translate plus a scroll container', async () => {
    const css = await read('app/globals.css');
    const start = css.indexOf('.mobile-nav {');
    const rule = css.slice(start, css.indexOf('}', start));
    // translateX(-50%) on an element with overflow-x:auto is what pushed the
    // last item past the right edge on /team: it became a scroll container
    // clipped to a shrunk width around a point outside its own box.
    expect(rule).not.toContain('translateX(-50%)');
    expect(rule).not.toContain('overflow-x: auto');
    expect(rule).toContain('left: 10px');
    expect(rule).toContain('right: 10px');
    expect(rule).toContain('width: fit-content');
    expect(rule).toContain('margin-inline: auto');
  });

  it('leaves room for five items on a 320px phone', async () => {
    const css = await read('app/globals.css');
    const narrow = css.slice(css.indexOf('@media (max-width: 359px)'), css.indexOf('/* Menu trigger'));
    expect(narrow).toContain('.mobile-nav a, .mobile-nav-menu');
    expect(narrow).toContain('min-width: 44px');
    // The bell moved to the topbar, so the pill is five items again and every
    // one of them keeps its label even on a 320px phone.
    expect(narrow).not.toContain('display: none');
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

describe('the notification bell lives in the topbar, right of search', () => {
  it('is portalled into a slot every screen renders next to its search control', async () => {
    const portal = await read('components/topbar-notif-portal.tsx');
    expect(portal).toContain("document.querySelector<HTMLElement>('.topbar-notif-slot')");
    expect(portal).toContain('createPortal');
    expect(portal).toContain('variant="topbar"');

    // Every screen with a topbar must carry the slot, or the bell silently
    // disappears from that screen.
    for (const screen of [
      'app/dashboard.tsx', 'app/transactions/transactions-client.tsx',
      'app/inventory/inventory-client.tsx', 'app/team/team-client.tsx',
      'app/partners/partners-client.tsx', 'app/reports/reports-client.tsx',
    ]) {
      expect({ screen, slot: (await read(screen)).includes('topbar-notif-slot') }).toEqual({ screen, slot: true });
    }
  });

  it('is no longer in the bottom pill', async () => {
    const sidebar = await read('components/app-sidebar.tsx');
    expect(sidebar).not.toContain('variant="nav"');
    // The sidebar keeps its own trigger for desktop, and the portal is mounted
    // once so there is still a single polling loop and a single panel.
    expect(sidebar).toContain('variant="sidebar"');
    expect(sidebar.match(/<TopbarNotifPortal/g)?.length).toBe(1);
    expect(sidebar.match(/<NotificationPanel/g)?.length).toBe(1);
  });

  it('is a 44px target under a thumb and a plain circle beside search', async () => {
    const css = await read('app/globals.css');
    const block = css.slice(css.indexOf('.notif-topbar-btn {'), css.indexOf('.notif-scrim {'));
    expect(block).toMatch(/@media \(pointer: coarse\) \{ \.notif-topbar-btn \{ width: 44px; height: 44px; \} \}/);
    expect(block).toMatch(/@media \(min-width: 901px\) \{ \.notif-topbar-btn \{ display: none; \} \}/);
    // Badge ring matches the white circle rather than the old sidebar card.
    expect(block).toContain('.notif-topbar-btn .notif-badge { top: -4px; right: -4px; border-color: var(--card); }');
  });
});

describe('quick actions are swipeable, not just scrollable', () => {
  it('does not forbid the browser from claiming horizontal pans', async () => {
    const css = await read('app/globals.css');
    const start = css.indexOf('.quick-actions {');
    const block = css.slice(start, css.indexOf('.quick-action {'));
    // touch-action: pan-y made the row unswipeable on a phone even though it had
    // overflow-x: auto: the browser kept every horizontal pan for itself.
    expect(block).not.toContain('touch-action: pan-y');
    expect(block).toContain('touch-action: pan-x pan-y');
  });
});

describe('every screen is reachable on a phone (mobile menu)', () => {
  it('offers a menu trigger in the bottom pill', async () => {
    const sidebar = await read('components/app-sidebar.tsx');
    expect(sidebar).toContain('<MobileMenu');
    expect(sidebar).toContain('aria-label="Open menu"');
    expect(sidebar).toContain('aria-haspopup="dialog"');
  });

  it('lists the destinations the pill has no room for, plus profile and sign out', async () => {
    const menu = await read('components/mobile-menu.tsx');
    // The sidebar is display:none below 901px, so anything not in the pill is
    // unreachable unless the menu carries it.
    for (const href of ["'/partners'", "'/reports'", "'/inventory'", "'/team'", "'/transactions'"]) {
      expect(menu).toContain(href);
    }
    expect(menu).toContain('Sign out');
    expect(menu).toContain('signOut(');
    expect(menu).toContain('role="dialog"');
    // Team is role-gated exactly as it is in the sidebar.
    expect(menu).toContain("['OWNER', 'ADMIN', 'PAYROLL']");
  });

  it('is hidden from the desktop layout', async () => {
    const css = await read('app/globals.css');
    expect(css).toMatch(/@media \(min-width: 901px\) \{ \.mmenu, \.mmenu-scrim \{ display: none; \} \}/);
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
