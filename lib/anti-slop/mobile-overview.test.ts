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

  it('places the bar with insets only, never a width that resolves elsewhere', async () => {
    const css = await read('app/globals.css');
    const start = css.indexOf('.mobile-nav {');
    const rule = css.slice(start, css.indexOf('}', start));
    // Two ways to get this wrong, both seen on /team. A centring transform
    // centres around a point outside the element's own box once it becomes a
    // scroll container. A `fit-content` width plus auto margins centres the bar
    // inside whatever containing block the fixed element resolves against, so
    // when that box is wider than the screen the bar drifts right and clips its
    // last item. Insets alone cannot drift: the box is the screen minus 10px.
    expect(rule).not.toContain('translateX(-50%)');
    expect(rule).not.toContain('overflow-x: auto');
    expect(rule).not.toContain('width: fit-content');
    expect(rule).not.toContain('margin-inline: auto');
    expect(rule).toContain('inset: auto 10px');
    expect(rule).toContain('width: auto');
    expect(rule).toContain('justify-content: center');
  });

  it('contains the page so no screen can widen the layout viewport', async () => {
    // The bar is fixed, but a child wider than the screen still widens the
    // layout viewport on some mobile engines and drags every fixed element with
    // it. `overflow-x: clip` alone does not establish that. The scroll container
    // also has to stop the table's intrinsic 720px from propagating upward.
    const css = await read('app/globals.css');
    // `.data-table-wrap {` also appears as a one-line override inside two
    // @media print blocks, at both the start and the end of the file. Anchor on
    // the real rule by its first declaration instead of by position.
    const wrap = css.slice(css.indexOf('.data-table-wrap {\n  /* A 720px table'));
    const block = wrap.slice(0, wrap.indexOf('}'));
    expect(block).toContain('min-width: 0');
    expect(block).toContain('max-width: 100%');
    expect(block).toContain('overflow-x: auto');
    // Scroll containers alone left the table's 720px intrinsic width reaching
    // the containing block, which put the fixed bar 182px from the left on a
    // 411px phone. Inline-size containment is what actually stops it.
    expect(block).toContain('contain: inline-size');
    // And the shell itself must never be allowed to lay out wider than the screen.
    expect(css).toMatch(/\.app-shell\s*\{[^}]*max-width: 100v[whw]/);
  });

  it('never renders a bare wide table, not even in a skeleton', async () => {
    // A `.data-table` has min-width: 720px. Rendered without the scroll wrapper
    // it widens the whole page, and the fixed bar then centres in that wider box.
    // The route-level skeleton did exactly this, so the bar drifted precisely
    // while a screen was loading.
    const loading = await read('components/app-loading.tsx');
    const tableAt = loading.indexOf('<table className="data-table">');
    expect(tableAt).toBeGreaterThan(-1);
    expect(loading.slice(Math.max(0, tableAt - 120), tableAt)).toContain('data-table-wrap');
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

describe('navigation is client-side, not a full page reload', () => {
  const screens = [
    'app/dashboard.tsx', 'app/transactions/transactions-client.tsx',
    'app/inventory/inventory-client.tsx', 'app/team/team-client.tsx',
    'app/partners/partners-client.tsx', 'app/reports/reports-client.tsx',
    'components/app-sidebar.tsx', 'components/mobile-menu.tsx',
  ];

  it('never uses a bare anchor for an internal route', async () => {
    // A raw <a href="/x"> makes the browser throw the document away and fetch a
    // new one: new HTML, new JS parse, new hydration, then a client fetch for
    // the data. That is the "every page takes ages to load" report. next/link
    // turns it into a client transition.
    for (const screen of screens) {
      const source = await read(screen);
      const anchors = source.match(/<a\b[^>]*>/g) ?? [];
      const internal = anchors.filter((tag) => /href="\/(?:#|$|transactions|partners|reports|inventory|team)/.test(tag));
      expect({ screen, internal }).toEqual({ screen, internal: [] });
    }
  });

  it('keeps full loads only where a full load is correct', async () => {
    // Auth surfaces must not be client transitions: signing in or out has to
    // re-read the session on the server, and a cached authenticated shell must
    // never be reused. CSV links must reach the download, not the router.
    // So the surviving raw anchors are exactly these, and nothing else.
    const allowed = [
      'app/invite/[token]/page.tsx', 'components/auth-form.tsx',
      'components/invite-accept-form.tsx', 'app/partners/partners-client.tsx',
    ];
    for (const file of allowed) {
      const anchors = (await read(file)).match(/<a\s[^>]*href="[^"]*"/g) ?? [];
      const internal = anchors.filter((tag) => /href="\/(?:#|$|login|transactions|partners|reports|inventory|team)/.test(tag));
      const suspicious = internal.filter((tag) => !/format=csv/.test(tag) && !/href="\/(?:login)?"/.test(tag));
      expect({ file, suspicious }).toEqual({ file, suspicious: [] });
    }
  });

  it('hides the shell from visitors who are not signed in', async () => {
    // `/` is both the marketing landing page and the dashboard, so a path-only
    // hide-list drew the sidebar and the mobile pill over the landing hero. The
    // session is the honest signal; this asserts the shell is gated on it and not
    // on a list that happens to omit `/`.
    const layout = await read('app/layout.tsx');
    expect(layout).toContain('currentSession()');
    expect(layout).toContain('signedIn');
    expect(layout).not.toContain('<AppShell />');
    const gate = await read('components/shell-gate.tsx');
    expect(gate).toContain('signedIn === false');
    expect(gate).toContain("from '@/auth'");
    // The landing page must never render the authenticated shell itself.
    const landing = await read('components/landing-page.tsx');
    expect(landing).not.toContain('AppSidebar');
    expect(landing).not.toContain('mobile-nav');
  });

  it('keeps the landing page CTAs working without the client bundle', async () => {
    // A marketing page's primary actions must not depend on hydration: if the
    // bundle fails to boot, a <Link> CTA becomes a dead button, while a plain
    // anchor still navigates. This is the "Try the demo does nothing" report.
    const landing = await read('components/landing-page.tsx');
    expect(landing).not.toContain("from 'next/link'");
    expect(landing).not.toContain('<Link');
    const anchors = landing.match(/<a\s[^>]*href="[^"]*"/g) ?? [];
    for (const target of ['/login', '/setup']) {
      expect({ target, found: anchors.some((a) => a.includes(`href="${target}"`)) }).toEqual({ target, found: true });
    }
  });

  it('keeps the shell mounted once, in the root layout', async () => {
    const layout = await read('app/layout.tsx');
    // The shell is still mounted from the layout, now through the session gate.
    expect(layout).toContain('<ShellGate');
    expect(layout).toContain("from '@/components/shell-gate'");
    // No screen may mount the shell itself, or it unmounts on navigation again.
    for (const screen of screens) {
      expect({ screen, shell: (await read(screen)).includes('<AppSidebar') }).toEqual({ screen, shell: false });
    }
  });

  it('derives the active nav item from the route, not from page props', async () => {
    const shell = await read('components/app-shell.tsx');
    expect(shell).toContain('usePathname()');
    expect(shell).toContain("['/transactions', 'transactions']");
    expect(shell).toContain("['/reports', 'reports']");
    // Unauthenticated routes must not render the authenticated shell.
    expect(shell).toContain("'/login'");
    expect(shell).toContain("'/setup'");
    expect(shell).toContain("'/invite'");
  });

  it('re-resolves the notification slot when the page changes', async () => {
    // The shell outlives the page now, so the slot it portals into is rebuilt on
    // every navigation. A one-shot lookup made the bell disappear from the topbar
    // after the first tap, undoing tranche D.
    const portal = await read('components/topbar-notif-portal.tsx');
    expect(portal).toContain('usePathname()');
    expect(portal).toContain('[pathname]');
    expect(portal).toContain('MutationObserver');
  });

  it('keeps per-visitor payloads out of the server module scope', async () => {
    // The screen cache is module state inside client components that are also
    // server-rendered. Without the `window` guard a warm Node process would hand
    // one visitor the previous visitor's ledger. This assertion is a privacy
    // guard, not a style one.
    const cache = await read('lib/route-cache.ts');
    expect(cache).toContain("typeof window === 'undefined'");
    expect(cache.match(/typeof window === 'undefined'/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('drops cached payloads and identity on sign-out', async () => {
    // Both caches outlive the session in browser memory; a second account on the
    // same device must not paint the first account's books or loan badge.
    for (const surface of ['components/app-sidebar.tsx', 'components/mobile-menu.tsx']) {
      const source = await read(surface);
      expect({ surface, clearsCache: source.includes('clearCache()') }).toEqual({ surface, clearsCache: true });
      expect({ surface, resetsIdentity: source.includes('resetWorkspaceContext()') }).toEqual({ surface, resetsIdentity: true });
    }
  });

  it('does not blank the whole screen on a return visit', async () => {
    // Each of these used to start at `null`, so a client-side return replaced the
    // page with a full-screen loader while it refetched bytes the browser had.
    const cached = [
      ['app/dashboard.tsx', 'readCache<DashboardData>(DASHBOARD_CACHE)'],
      ['app/team/team-client.tsx', 'readCache<TeamData>(TEAM_CACHE)'],
      ['app/inventory/inventory-client.tsx', 'readCache<InventoryData>(INVENTORY_CACHE)'],
      ['app/partners/partners-client.tsx', 'readCache<Overview>(PARTNERS_CACHE)'],
    ] as const;
    for (const [screen, seed] of cached) {
      const source = await read(screen);
      expect({ screen, seeded: source.includes(seed) }).toEqual({ screen, seeded: true });
    }
  });

  it('fetches only a small context for the shell, never the ledger', async () => {
    const context = await read('lib/use-workspace-context.ts');
    expect(context).toContain("fetch('/api/workspace/context'");
    // One shared module instance survives route changes, so the shell does not
    // re-request identity on every navigation.
    expect(context).toContain('useSyncExternalStore');
    expect(context).toContain('started');
  });
});

describe('every data-driven screen shows a skeleton, not a spinner sentence', () => {
  const screens = [
    'app/dashboard.tsx', 'app/transactions/transactions-client.tsx',
    'app/inventory/inventory-client.tsx', 'app/team/team-client.tsx',
    'app/partners/partners-client.tsx', 'app/reports/reports-client.tsx',
  ];

  it('uses the shared skeleton primitives', async () => {
    for (const screen of screens) {
      const source = await read(screen);
      expect({ screen, usesSkeleton: source.includes('@/components/skeletons') || source.includes('DashboardSkeleton') })
        .toEqual({ screen, usesSkeleton: true });
    }
  });

  it('draws the All activity table as skeleton rows while loading', async () => {
    // The specific request: the ledger used to render a single "Loading
    // activity…" cell, which read as an empty table rather than work in progress.
    const ledger = await read('app/transactions/transactions-client.tsx');
    expect(ledger).toContain('<SkTableRows');
    expect(ledger).not.toContain('Loading activity…');
    // Changing a filter must also show motion, not freeze the old rows silently.
    expect(ledger).toContain('is-refreshing');
    expect(ledger).toContain('aria-busy');
  });

  it('has a route-level fallback for each authenticated screen', async () => {
    for (const route of ['transactions', 'team', 'inventory', 'partners', 'reports']) {
      const source = await read(`app/${route}/loading.tsx`);
      expect({ route, wired: source.includes('@/components/app-loading') }).toEqual({ route, wired: true });
    }
  });

  it('keeps the route fallback out of the marketing and auth pages', async () => {
    // A root loading.tsx would draw a dashboard-shaped block over the landing
    // page and the sign-in forms. It must stay scoped to the app routes.
    const rootFiles = ['app/loading.tsx'];
    for (const file of rootFiles) {
      let exists = true;
      try { await read(file); } catch { exists = false; }
      expect({ file, exists }).toEqual({ file, exists: false });
    }
  });

  it('reserves the skeleton for motion-sensitive users', async () => {
    const css = await read('app/globals.css');
    expect(css).toContain('.sk {');
    expect(css).toContain('@keyframes sk-shimmer');
    // The shimmer must stop under prefers-reduced-motion.
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('.sk { animation: none;');
  });
});

describe('account management exists instead of a placeholder toast', () => {
  it('never tells the owner a shipped feature is still being built', async () => {
    // The accounts panel's overflow menu used to raise "Account management is
    // being built." while the panel behind it already listed the accounts.
    const dashboard = await read('app/dashboard.tsx');
    expect(dashboard).not.toContain('is being built');
    expect(dashboard).toContain('Manage accounts');
  });

  it('keeps account management on its own screen, not in a modal', async () => {
    // Managing accounts outgrew a dialog: each account needs its balance, its
    // ledger context and the reason a change is refused. A dialog hid all of
    // that behind an overflow menu on a panel the page already showed.
    const dashboard = await read('app/dashboard.tsx');
    expect(dashboard).not.toContain('<AccountsDialog');
    expect(dashboard).not.toMatch(/accountsOpen/);

    // The page must exist, be server-gated, and use the shared skeleton idiom.
    const page = await read('app/accounts/page.tsx');
    expect(page).toContain('requirePageMember');
    const loading = await read('app/accounts/loading.tsx');
    expect(loading).toContain('AppLoading');

    // Something reachable must link to it: the sidebar entry no longer scrolls
    // back to the dashboard panel, and the panel's button navigates.
    const sidebar = await read('components/app-sidebar.tsx');
    expect(sidebar).toContain("href: '/accounts'");
    expect(sidebar).not.toContain("href: '/#accounts'");
    expect(dashboard).toContain('href="/accounts"');
  });

  it('offers a delete only where the API would actually allow it', async () => {
    // The page once showed a Remove button on every account and let the API
    // refuse; a refusal that always fails teaches the owner the app is broken
    // rather than the rule. `hasHistory` must mirror the DELETE condition, which
    // counts ledger entries only. An opening balance alone is not history.
    const database = await read('lib/database.ts');
    expect(database).toContain('hasHistory: entryCount > 0');
    expect(database).not.toMatch(/hasHistory:\s*entryCount > 0 \|\|/);

    const route = await read('app/api/accounts/[id]/route.ts');
    const del = route.slice(route.indexOf('export async function DELETE'));
    expect(del).toContain('FROM transactions');
    expect(del).not.toContain('opening_balance');

    const client = await read('app/accounts/accounts-client.tsx');
    expect(client).toContain('function removable(');
    expect(client).toContain('!account.hasHistory');
    // A locked account still says why, instead of silently losing its button.
    expect(client).toContain('cannot be removed');
  });

  it('keeps a retry path when the page cannot load', async () => {
    // Standing rule: an error state is an explicit message plus a retry, never a
    // skeleton that never settles.
    const client = await read('app/accounts/accounts-client.tsx');
    expect(client).toContain('could not be loaded');
    expect(client).toContain('Try again');
  });

  it('states the delete and opening-balance rules on the page itself', async () => {
    // A refusal the owner cannot see coming reads as a bug, so the page explains
    // the rules instead of only surfacing them when an action fails.
    const client = await read('app/accounts/accounts-client.tsx');
    expect(client).toContain('renamed but not removed');
    expect(client).toContain('opening balance is fixed once the first entry');
    expect(client).toContain('canManage');
    expect(client).toContain('SkPageBody');
  });

  it('keeps the balance derived, never typed', async () => {
    // The opening balance is a starting fact and may be set once. A typed
    // running balance would invent money no transaction explains.
    const route = await read('app/api/accounts/[id]/route.ts');
    expect(route).toContain('openingBalance');
    expect(route).toContain('already has transactions');
    // An account with history may be renamed but not deleted.
    const del = route.slice(route.indexOf('export async function DELETE'));
    expect(del).toContain('Rename it instead');
    expect(del).toContain('at least one account');
  });

  it('gates account changes to owners and admins', async () => {
    for (const file of ['app/api/accounts/route.ts', 'app/api/accounts/[id]/route.ts']) {
      const source = await read(file);
      expect({ file, gated: source.includes('ROLE.OWNER') && source.includes('ROLE.ADMIN') })
        .toEqual({ file, gated: true });
    }
  });
});

describe('partner shares and profit sharing are wired end to end', () => {
  it('exposes a share change and a distribution control on the page', async () => {
    // Both surfaces must be reachable without an API console: the owner records
    // a new split, then appropriates the period's profit through it.
    const client = await read('app/partners/partners-client.tsx');
    expect(client).toContain('Record share change');
    expect(client).toContain('Distribute profit');
    expect(client).toContain('/api/partners/distribution');
  });

  it('gates shares and distributions to owners and admins', async () => {
    for (const file of ['app/api/partners/distribution/route.ts', 'app/api/partners/movement/route.ts', 'app/api/partners/settings/route.ts']) {
      const source = await read(file);
      expect({ file, gated: source.includes('ROLE.OWNER') }).toEqual({ file, gated: true });
      expect({ file, admin: source.includes('ROLE.ADMIN') }).toEqual({ file, admin: true });
    }
  });

  it('recomputes shares from effective-dated history, never a stored total', async () => {
    // A share change is a new dated row; historical splits recompute from those
    // rows so a past distribution can never silently change its meaning.
    const schema = await read('lib/database.ts');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS owner_share_changes');
    expect(schema).toContain('effective_at');
    const ledger = await read('lib/partners/ledger.ts');
    expect(ledger).toContain('dayWeightedPsr');
    expect(ledger).toContain('shareAt');
  });

  it('cannot post the same period twice', async () => {
    // Guarded in the database, not just in a route handler: a double tap, a
    // retry or a duplicate seed must not appropriate one period twice.
    const schema = await read('lib/database.ts');
    expect(schema).toContain('profit_distributions_active_period_idx');
    expect(schema).toMatch(/UNIQUE INDEX[^;]*profit_distributions[\s\S]{0,200}status = 'POSTED'/);
  });

  it('reverses the partner entries when a distribution is voided', async () => {
    const store = await read('lib/partners/store.ts');
    const voidFn = store.slice(store.indexOf('export async function voidDistribution'));
    expect(voidFn).toContain("status = 'VOID'");
    // The ledger is append-only: a void does not delete the posted lines, it
    // posts the opposite entry for each one, so the partner's balance returns to
    // where it was while the history of what was posted stays readable.
    expect(voidFn).toContain("'CORRECTION'");
    expect(voidFn).toContain('flipped');
    expect(voidFn).not.toMatch(/DELETE FROM partner_entries/);
  });
});

describe('toast and pill surfaces stay on-brand', () => {
  it('keeps the sileo toast dark, including the surfaces around the body', async () => {
    const css = await read('app/globals.css');
    // Both shapes sileo draws must carry the brand fill. The pale shoulders in
    // the owner's screenshot came from a surface sileo painted that our skin had
    // not claimed.
    expect(css).toContain('[data-sileo-pill]');
    expect(css).toContain('[data-sileo-body]');
    expect(css).toContain('[data-sileo-canvas] svg');
    const toaster = await read('components/app-toaster.tsx');
    // theme="light" means "drawn on a light page" => dark toast. Reversing this
    // would literally make the toast white, so pin the intent.
    expect(toaster).toContain('theme="light"');
  });

  it('never outlines the toast box, which is transparent by design', async () => {
    // The pale rectangle in the owner's screenshot was this skin's own doing:
    // a 1px border plus a 0 22px 60px shadow on the toast's box. Both follow the
    // box's 20px rounded rect across its full width, but the dark SVG only fills
    // the body and a narrow pill, so the gap either side of the pill showed the
    // canvas inside a hairline frame with a shadow pooled under it.
    const css = await read('app/globals.css');
    const base = css.slice(css.indexOf('/* Sileo toast'), css.indexOf('Accessibility fallbacks'));
    expect(base).toContain('border: 0 !important');
    expect(base).toContain('box-shadow: none !important');
    // The shadow belongs on the silhouette sileo actually draws.
    expect(base).toContain('drop-shadow(');
    expect(base).toMatch(/html \[data-sileo-canvas\] svg[^{]*\{[^}]*filter: drop-shadow/);
  });

  it('keeps the toast inside the viewport, whatever sileo defaults to', async () => {
    // Sileo injects its stylesheet at runtime, after globals.css, so its
    // `:root{--sileo-width:350px}` beats a custom-property override declared
    // here. On a 320px phone the toast hung 15px over each edge.
    const css = await read('app/globals.css');
    expect(css).toMatch(/html \[data-sileo-toast\] \{ width: min\(92vw, 380px\); \}/);
    expect(css).toContain('html [data-sileo-viewport] { max-width: 100vw;');
  });

  it('cannot widen the page from a data table, which is what shifted the pill', async () => {
    // A 720px table in a 380px card made the layout viewport wider than the
    // screen; the fixed pill then centred in the wider box and rendered shifted
    // right with "Menu" cut off.
    const css = await read('app/globals.css');
    // The base rule is the multi-line one; the print overrides are single-line
    // and appear earlier in the file, so anchor on the min-width line.
    const anchor = css.indexOf('min-width: 0;\n  max-width: 100%;');
    const rule = css.slice(css.lastIndexOf('.data-table-wrap', anchor), css.indexOf('}', anchor));
    expect(rule).toContain('min-width: 0');
    expect(rule).toContain('overflow-x: auto');
    expect(rule).toContain('max-width: 100%');
    // Paint containment, not just inline-size. On the 2026-11-10 capture the
    // loaded Team page still laid out 645px wide on a 412px phone: a 7-column
    // table (the 5-column skeleton fit) propagated its 720px min-content width
    // to the initial containing block, so `window.innerWidth` itself reported
    // 645 and the pill ran 195px past the right edge. `paint` makes the wrapper
    // a paint boundary, which stops that propagation.
    expect(rule).toContain('contain: inline-size paint');
  });

  it('drops that containment when the wrapper is neutralised for print', async () => {
    // Print turns these wrappers back into plain flow so a statement can span
    // pages. Paint containment would clip a table taller than one page, so the
    // print overrides must reset it along with the overflow.
    const css = await read('app/globals.css');
    for (const selector of ['.statement-print .data-table-wrap {', '.report-body .data-table-wrap {']) {
      const start = css.indexOf(selector);
      expect(start).toBeGreaterThan(-1);
      const block = css.slice(start, css.indexOf('}', start));
      expect(block).toContain('contain: none');
      expect(block).toContain('overflow: visible');
    }
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
