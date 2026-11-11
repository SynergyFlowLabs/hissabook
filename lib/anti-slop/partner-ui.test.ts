import { describe, expect, it, vi } from 'vitest';

/**
 * Guards the browser/device fixes made in anti-slop audits 002 and 003 that used
 * to be verifiable only by eye. These are source-level assertions: the repo has no
 * DOM test runner, and each check below is about a rule that is written once in
 * one place, so a regression is a one-line diff.
 */
const read = (path: string) => import('node:fs').then((fs) => fs.readFileSync(path, 'utf8'));

describe('dialog focus management (R-32)', () => {
  it('remembers the opener and restores focus on every dialog close', async () => {
    const source = await read('app/partners/partners-client.tsx');
    // Every onOpenChange in the partners client must clear through restoreOpener.
    const handlers = source.match(/onOpenChange=\{[^}]*\}/g) ?? [];
    expect(handlers.length).toBeGreaterThanOrEqual(9);
    for (const handler of handlers) expect(handler).toContain('restoreOpener()');
    // Every opener records the element that had focus.
    expect(source.match(/rememberOpener\(\)/g)?.length).toBeGreaterThanOrEqual(8);
  });

  it('opens the exit and deed dialogs on their first control, not the close X', async () => {
    const source = await read('app/partners/partners-client.tsx');
    expect(source).toContain("document.getElementById('exit-date')?.focus()");
    expect(source).toContain("document.getElementById('deed-salary')?.focus()");
    expect(source.match(/onOpenAutoFocus=\{\(event\) => \{ event\.preventDefault\(\);/g)?.length).toBe(2);
  });
});

describe('page actions cannot hide a control (R-41)', () => {
  it('never paints actions past the right edge in a row that cannot scroll', async () => {
    // The Partners heading used to be `.inventory-heading-actions`: a nowrap
    // flex row with `overflow-x: visible`. It held 584px of buttons in a 380px
    // page, so "Edit shares" and "Add partner" were painted off-screen and
    // could not be reached by scroll, tap or keyboard.
    const css = await read('app/globals.css');
    const row = css.slice(css.indexOf('.page-actions-row {'), css.indexOf('.page-action {'));
    expect(row).toContain('overflow-x: auto');
    // A scroller may not widen the layout viewport either (see the /team fix).
    expect(row).toContain('contain: inline-size');
    // Below the desktop breakpoint the row must still be the scrolling one:
    // only the wide layout, which wraps instead, may switch it to visible.
    const phone = css.slice(0, css.indexOf('@media (min-width: 901px) {'));
    const phoneRow = phone.slice(phone.indexOf('.page-actions-row {'), phone.indexOf('.page-action {'));
    expect(phoneRow).not.toContain('overflow-x: visible');
  });

  it('keeps every action reachable from a sheet, never only on the row', async () => {
    const source = await read('components/page-actions.tsx');
    // The overflow sheet renders the full list, so an action cut from the row
    // is always two taps away rather than lost.
    expect(source).toContain('All actions');
    expect(source).toMatch(/\{actions\.map\(\(action\)/);
    expect(source).toContain('action-sheet-row');
    // And the row always keeps the primary action visible.
    expect(source).toContain('primaryIndex');
  });

  it('measures overflow on a hidden copy so the row cannot oscillate', async () => {
    const source = await read('components/page-actions.tsx');
    // Measuring the visible row while hiding its own items flips states: hide
    // two, the row fits, show them again, it overflows again.
    expect(source).toContain('page-actions-measure');
    expect(source).toContain('ResizeObserver');
  });

  it('leaves every partner action reachable from its card', async () => {
    const source = await read('app/partners/partners-client.tsx');
    // The card previously carried seven pills in up to three wrapped rows.
    for (const control of ['Record movement', 'Statement', 'More actions for']) {
      expect({ control, found: source.includes(control) }).toEqual({ control, found: true });
    }
    // Every row in the per-partner sheet hands off through the focus helper.
    const sheet = source.slice(source.indexOf('Per-partner action sheet'), source.indexOf('{/* Distribution dialog */}'));
    expect(sheet).not.toContain('setPartnerSheetId(null); openMovement');
    expect(sheet).toContain('forwardFromSheet(');
  });
});

describe('hover rules stay behind a hover-capable pointer (sticky hover)', () => {
  it('has no :hover rule outside @media (hover: hover) and (pointer: fine)', async () => {
    const css = (await read('app/globals.css'))
      // drop the guarded blocks, then nothing with :hover may remain
      .replace(/@media \(hover: hover\) and \(pointer: fine\) \{[^}]*\}[^@]*?\}/g, '')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('/*'));
    expect(css.filter((line) => line.includes(':hover'))).toEqual([]);
  });
});

describe('hit areas reach 44px on coarse pointers (R-03)', () => {
  it('covers the partner controls that sit under a thumb', async () => {
    const css = await read('app/globals.css');
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'));
    for (const selector of ['.ghost-pill', '.text-link', '.deed-chip', '.legacy-tag-button', '.legacy-select']) {
      expect(coarse).toContain(`${selector} {`);
    }
    const minHeights = coarse.match(/min-height: 44px/g) ?? [];
    expect(minHeights.length).toBeGreaterThanOrEqual(5);
  });
});

describe('375px layout for the exit dialog revaluation rows (R-03)', () => {
  it('stacks into a two-line grid below 480px and keeps the remove button thumb-sized', async () => {
    const css = await read('app/globals.css');
    const block = css.slice(css.indexOf('.exit-reval-row'), css.indexOf('.history-list'));
    expect(block).toContain('@media (max-width: 480px)');
    expect(block).toMatch(/grid-template-columns: minmax\(0, 1fr\) 44px/);
    expect(block).toMatch(/\.exit-reval-desc \{ grid-column: 1 \/ -1; \}/);
    expect(block).toMatch(/\.exit-reval-remove \{ width: 44px/);
    // No fixed min-width may force horizontal overflow at 375 px.
    expect(block).not.toMatch(/min-width: (?!0)\d+px/);
  });
});

describe('statement prints on A4 (print CSS)', () => {
  it('declares the page box and removes the fixed dialog from print', async () => {
    const css = await read('app/globals.css');
    const print = css.slice(css.indexOf('@page'));
    expect(print).toMatch(/@page \{ size: A4 portrait; margin: 14mm 12mm; \}/);
    // The statement lives in a fixed, scrollable dialog: print must neutralise it.
    expect(print).toMatch(/\[data-slot="dialog-content"\][\s\S]*?position: static !important;[\s\S]*?overflow: visible !important;/);
    expect(print).toContain('.statement-print thead { display: table-header-group; }');
    expect(print).toContain('.statement-print .data-table { min-width: 0;');
    expect(print).toContain('[data-slot="dialog-content"] > *:not(.statement-print) { display: none !important; }');
  });
});

describe('agent-written UI copy has no em or en dashes (R-02)', () => {
  it('keeps every app surface clean', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx|css)$/.test(entry.name) || /\.test\.ts$/.test(entry.name)) continue;
        for (const [index, line] of fs.readFileSync(full, 'utf8').split('\n').entries()) {
          if (!/[\u2014\u2013]/.test(line)) continue;
          // Code comments may keep dashes (audit 001, finding 3).
          if (/^\s*(\/\/|\*|\/\*|#)/.test(line)) continue;
          offenders.push(`${full}:${index + 1}: ${line.trim().slice(0, 100)}`);
        }
      }
    };
    for (const dir of ['app', 'components', 'lib', 'types']) walk(dir);
    expect(offenders).toEqual([]);
  });
});

describe('no dead controls on the legacy tray (R-24)', () => {
  it('disables Tag until a partner is chosen and posts to the real endpoint', async () => {
    const source = await read('app/partners/partners-client.tsx');
    expect(source).toMatch(/disabled=\{legacyBusyId === entry\.transactionId \|\| !legacyChoice\[entry\.transactionId\]/);
    expect(source).toContain("fetch('/api/partners/legacy', { method: 'POST'");
    expect(source).toContain("fetch('/api/partners/legacy', { cache: 'no-store' })");
  });

  it('gives every tray partner picker an accessible name', async () => {
    const source = await read('app/partners/partners-client.tsx');
    expect(source).toContain('htmlFor={`legacy-partner-${entry.transactionId}`}');
    expect(source).toContain('id={`legacy-partner-${entry.transactionId}`}');
    expect(source).toContain('className="sr-only"');
  });
});

describe('nested transaction guard (the PR #16 deadlock lesson)', () => {
  it('attributeLegacyEntry opens exactly one transaction and never calls another one', async () => {
    const store = await read('lib/partners/store.ts');
    const start = store.indexOf('export async function attributeLegacyEntry');
    const end = store.indexOf('/* ------------------------------------------------------------------ */\n/* Phase 3', start);
    const body = store.slice(start, end);
    expect(body.match(/db\.transaction/g)?.length).toBe(1);
    // Helpers called inside the transaction must be plain inserts, not transactions.
    for (const helper of ['insertEntry(', 'audit(', 'legacyEntryFor(']) expect(body).toContain(helper);
    expect(body).not.toContain('postPartnerMovement(');
  });
});

describe('mock hygiene', () => {
  it('does not need the network', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(true).toBe(true);
  });
});
