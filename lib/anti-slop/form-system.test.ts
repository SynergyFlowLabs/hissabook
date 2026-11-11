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
    const rule = css.indexOf('.form-field > :is(input, textarea, select, [data-slot="select-trigger"])');
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

  it('clamps a native date control to the field box', () => {
    const css = read('app/globals.css');
    // The field is one clamped track: no control can widen the column.
    expect(css).toContain('.form-field { display: grid; grid-template-columns: minmax(0, 1fr);');
    const rule = css.indexOf('input[type="date"], input[type="time"], input[type="month"], input[type="datetime-local"])');
    expect(rule).toBeGreaterThan(-1);
    const block = css.slice(rule, rule + 240);
    expect(block).toContain('max-width: 100%');
    expect(block).toContain('min-width: 0');
    // The ledger date pair lives one level deeper and is clamped too.
    expect(css).toContain('.ledger-date input { width: 100%; max-width: 100%; min-width: 0;');
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
