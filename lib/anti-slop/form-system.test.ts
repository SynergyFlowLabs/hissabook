import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/** Every surface that renders a form or a dialog. One system, one shell. */
const FORM_SURFACES = [
  'app/dashboard.tsx',
  'app/accounts/accounts-client.tsx',
  'app/transactions/transactions-client.tsx',
  'app/partners/partners-client.tsx',
  'app/team/team-client.tsx',
  'app/inventory/inventory-client.tsx',
  'app/reports/reports-client.tsx',
  'components/auth-form.tsx',
  'components/invite-accept-form.tsx',
  'components/page-actions.tsx',
];

const count = (source: string, needle: string) => source.split(needle).length - 1;

describe('one form system (R-50)', () => {
  it('sizes every data control from a single rule', () => {
    const css = read('app/globals.css');
    const rule = css.indexOf('input:not([type="checkbox"]):not([type="radio"]),');
    expect(rule).toBeGreaterThan(-1);
    const block = css.slice(rule, rule + 520);
    // 48px tall, 14px radius, one border token, one focus ring.
    expect(block).toContain('height: 48px');
    expect(block).toContain('border-radius: 14px');
    expect(block).toContain('border: 1px solid var(--line-strong)');
    expect(block).toContain('font-size: 16px');
    expect(css).toContain('border-color: var(--lime-strong); box-shadow: 0 0 0 3px var(--lime-soft)');
    // The shared dialog shell and action bar exist once, not per screen.
    expect(css).toContain('.form-dialog-body');
    expect(css).toContain('.form-actions > *');
  });

  it('builds every dialog from the same shell', () => {
    for (const path of FORM_SURFACES) {
      const source = read(path);
      const shells = [...source.matchAll(/<DialogContent className="([^"]*)"/g)].map((match) => match[1]);
      if (shells.length === 0) continue;
      for (const shell of shells) {
        expect(shell.split(' ')).toContain('form-dialog');
        expect(shell).not.toContain('rounded-3xl');
        expect(shell).not.toContain('max-h-');
      }
      // One head, one title and one description per dialog, all from the shell.
      expect(count(source, 'form-dialog-head')).toBe(shells.length);
      expect(count(source, 'form-dialog-title')).toBe(shells.length);
      expect(count(source, 'form-dialog-sub')).toBe(shells.length);
      // A dialog may show two bodies over time (the invite result), never fewer.
      expect(count(source, 'form-dialog-body')).toBeGreaterThanOrEqual(shells.length);
    }
  });

  it('never re-declares a control size or a footer inside a form', () => {
    for (const path of FORM_SURFACES) {
      // One exception: the legacy tray picker is a compact control inside a
      // table row, not a form field.
      const source = read(path)
        .split('\n')
        .filter((line) => !line.includes('legacy-select'))
        .join('\n');
      // Heights and radii come from the one rule above.
      expect(source).not.toMatch(/h-1[012] rounded-(full|xl)/);
      expect(source).not.toMatch(/className="h-1[012] /);
      expect(source).not.toContain('DialogFooter');
      expect(source).not.toContain('sm:justify-end');
    }
  });

  it('puts the primary action first in every action bar', () => {
    for (const path of FORM_SURFACES) {
      const source = read(path);
      for (const bar of source.matchAll(/<div className="form-actions[^"]*">([\s\S]*?)<\/div>\s*<\/form>/g)) {
        const block = bar[1];
        const secondary = block.search(/>\s*(Cancel|Close)\s*</);
        if (secondary === -1) continue;
        const primary = block.search(/lime-button|type="submit"/);
        expect(primary).toBeGreaterThan(-1);
        expect(primary).toBeLessThan(secondary);
      }
    }
  });

  it('routes every date through the one calendar field, never a native input', () => {
    const css = read('app/globals.css');
    // The field is one clamped track: no control can widen the column.
    expect(css).toContain('.form-field { display: grid; grid-template-columns: minmax(0, 1fr);');
    // The date trigger is part of the shared control rule, not a lookalike.
    expect(css).toContain('.form-field .date-field-trigger {');
    // The calendar is skinned from our tokens on top of react-day-picker.
    expect(css).toContain('.hisab-calendar {');
    expect(css).toContain('--rdp-day_button-border-radius');
    // Nothing may escape the scrolling form body horizontally either.
    const body = css.indexOf('.form-dialog-body {');
    expect(css.slice(body, body + 220)).toContain('overflow-x: hidden');
    // A native date input is what iOS drew wrong; the product has none left.
    for (const path of FORM_SURFACES) {
      expect(read(path)).not.toContain('type="date"');
    }
    expect(read('components/date-field.tsx')).toContain('date-field-trigger');
    expect(read('components/ui/calendar.tsx')).toContain('hisab-calendar');
  });

  it('opens the picker where the screen can hold it', () => {
    const css = read('app/globals.css');
    // A panel taller than the room left on its side is what pushed the caption
    // above the top of the browser: the height is capped to the space Radix
    // measured, so the panel fits and scrolls instead of overflowing.
    const popover = css.indexOf('.date-field-popover {');
    expect(popover).toBeGreaterThan(-1);
    expect(css.slice(popover, popover + 260)).toContain('max-height: var(--radix-popper-available-height');
    // The panel itself must never be positioned: Radix puts it inside a
    // transformed wrapper that owns the coordinates, so `position: fixed` on the
    // panel resolves against that wrapper and collapses it into a strip.
    const popoverRule = css.slice(popover, css.indexOf('}', popover));
    expect(popoverRule).not.toContain('position: fixed');
    // On a phone it is a sheet, pinned by its own insets - on the wrapper that
    // Radix positions, never on the panel inside it.
    const sheet = css.indexOf('[data-radix-popper-content-wrapper]:has(> .date-field-popover) {');
    expect(sheet).toBeGreaterThan(-1);
    const block = css.slice(sheet, sheet + 400);
    expect(block).toContain('position: fixed !important');
    expect(block).toContain('inset: auto 10px');
    // Guarded, so a browser without `:has()` keeps the anchored panel instead of
    // getting half of the sheet.
    expect(css).toContain('@supports selector(:has(*)) {');
    expect(css).toContain('[data-radix-popper-content-wrapper] > .date-field-popover {');
    expect(css).toContain('max-height: min(92dvh, 560px)');
  });

  it('gives every select row a comfortable height', () => {
    const css = read('app/globals.css');
    const rule = css.indexOf('[data-slot="select-item"] {');
    expect(rule).toBeGreaterThan(-1);
    const block = css.slice(rule, rule + 200);
    expect(block).toContain('min-height: 44px');
    expect(block).toContain('font-size: 14px');
    expect(css).toContain('@media (pointer: coarse) { [data-slot="select-item"] { min-height: 48px; } }');
  });

  it('labels every field with the shared label and hint classes', () => {
    const css = read('app/globals.css');
    expect(css).toContain('.form-field > label,');
    expect(css).toContain('.field-hint {');
    expect(css).toContain('.form-error {');
    for (const path of FORM_SURFACES) {
      const source = read(path);
      for (const match of source.matchAll(/<Input\b[^>]*className="([^"]*)"/g)) {
        // One exception: long URLs are rendered in the mono subset of the same control.
        expect(match[1]).not.toMatch(/\bh-\d/);
        expect(match[1]).not.toMatch(/rounded-(xl|full|2xl)/);
      }
    }
  });
});
