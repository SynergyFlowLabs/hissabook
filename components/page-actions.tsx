'use client';

import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Page-level actions (the buttons in a screen's heading) - one row on a phone.
 *
 * These used to be rendered as `.inventory-heading-actions`, a nowrap flex row
 * with `overflow-x: visible`. On the Partners screen that row was 584px of
 * buttons inside a 380px page, so the last two ("Edit shares", "Add partner")
 * sat past the right edge with no way to reach them: nothing scrolled and
 * nothing wrapped. Every action must stay reachable at 320px.
 *
 * Two levers, in order:
 *  - the last action is the primary one. It gets its own single-line label and
 *    is never hidden.
 *  - the rest fit on one row when they can; whatever does not fit moves into a
 *    labelled "More" sheet, two taps at most.
 *
 * Wrapping the overflow was the other option and it was worse here: five
 * wrapped pills pushed the numbers down by two rows on a page whose job is to
 * show those numbers. A sheet keeps the heading compact.
 *
 * Measurement is deliberately done on a hidden copy of the full row. Measuring
 * the visible row while hiding its own items made the layout oscillate: hide
 * two, the row fits, so show them again, so it overflows again. A hidden copy
 * always contains every action, so each pass measures the same thing.
 */

type Action = {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Secondary actions render as quiet rows in the overflow sheet. */
  variant?: 'button' | 'link';
} & (
  | { onClick: () => void; href?: undefined; download?: undefined }
  | { href: string; download?: string; onClick?: undefined }
);

/** True once the desktop heading row has room to lay every action out itself. */
function useIsWide() {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const query = window.matchMedia('(min-width: 901px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

const GAP = 8;
/** Rough width of the "More" trigger including its count badge. */
const MORE_WIDTH = 92;

function useFittingCount(count: number, enabled: boolean) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const measureRefs = useRef<Array<HTMLElement | null>>([]);
  const [fits, setFits] = useState<number | null>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || !enabled) {
      setFits((previous) => (previous === null ? previous : null));
      return;
    }
    let frame = 0;

    const measure = () => {
      // Only runs in the narrow layout, where the page heading is a column and
      // this row is a full-width block, so `clientWidth` is the space the row
      // really has. (On desktop the row is content-sized, so measuring it made
      // the layout collapse into a permanent "More" bubble; that layout now
      // simply lays every action out and wraps.)
      const available = row.clientWidth;
      if (!available) return;
      const widths = measureRefs.current.map((node) => (node ? node.getBoundingClientRect().width : 0));
      if (widths.some((width) => width === 0) || widths.length < 2) return;
      const primary = widths[widths.length - 1];
      // Greedily keep secondaries while the row, the "More" trigger and the
      // primary action still fit.
      let used = primary;
      let keep = 0;
      for (let index = 0; index < widths.length - 1; index += 1) {
        const rest = widths.length - 1 - (index + 1);
        const reserve = rest > 0 ? MORE_WIDTH + GAP : 0;
        if (used + widths[index] + GAP + reserve > available) break;
        used += widths[index] + GAP;
        keep = index + 1;
      }
      setFits((previous) => (previous === keep ? previous : keep));
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(row);
    // Labels change width once the webfont lands.
    if (document.fonts?.ready) void document.fonts.ready.then(schedule);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [count, enabled]);

  return { rowRef, measureRefs, fits };
}

function ActionNode({ action, innerRef, primary }: { action: Action; innerRef?: (node: HTMLElement | null) => void; primary?: boolean }) {
  if (action.href) {
    return (
      <a ref={innerRef as never} className={primary ? 'lime-button page-action-primary' : 'page-action'} href={action.href} download={action.download}>
        {action.icon}<span>{action.label}</span>
      </a>
    );
  }
  return (
    <button ref={innerRef as never} type="button" className={primary ? 'lime-button page-action-primary' : 'page-action'} onClick={action.onClick}>
      {action.icon}<span>{action.label}</span>
    </button>
  );
}

export default function PageActions({ actions, label = 'Page actions' }: { actions: Action[]; label?: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const isWide = useIsWide();
  const { rowRef, measureRefs, fits } = useFittingCount(actions.length, !isWide);

  if (actions.length === 0) return null;
  const primaryIndex = actions.length - 1;
  // Desktop: every action is laid out by the row itself. Phone: keep what fits
  // before the "More" trigger, always keeping the primary action last.
  const keep = isWide || fits === null ? primaryIndex : fits;
  const shown = isWide ? actions : actions.slice(0, keep).concat(actions[primaryIndex]);
  const hidden = isWide ? [] : actions.slice(keep, primaryIndex);

  return (
    <div className="page-actions" aria-label={label}>
      <div className="page-actions-row" ref={rowRef}>
        {shown.map((action, index) => (
          <ActionNode key={action.key} action={action} primary={index === shown.length - 1 && action.key === actions[primaryIndex].key} />
        ))}
        {hidden.length > 0 && (
          <button type="button" className="page-action page-action-more" onClick={() => setSheetOpen(true)} aria-haspopup="dialog" aria-expanded={sheetOpen}>
            <MoreHorizontal size={15} aria-hidden="true" /><span>More</span>
            <span className="page-action-count" aria-hidden="true">{hidden.length}</span>
            <span className="sr-only">, {hidden.length} more actions</span>
          </button>
        )}
      </div>

      {/* Hidden copy of every action, at natural width, used only to measure. */}
      <div className="page-actions-measure" aria-hidden="true">
        {actions.map((action, index) => (
          <ActionNode key={action.key} action={action} primary={index === primaryIndex} innerRef={(node) => { measureRefs.current[index] = node; }} />
        ))}
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold tracking-tight">All actions</DialogTitle>
            <DialogDescription>Everything you can do on this screen.</DialogDescription>
          </DialogHeader>
          <div className="action-sheet">
            {actions.map((action) => {
              const className = action.key === 'primary' ? 'action-sheet-row primary' : action.variant === 'link' ? 'action-sheet-row link' : 'action-sheet-row';
              const close = () => setSheetOpen(false);
              if (action.href) {
                return <a key={action.key} className={className} href={action.href} download={action.download} onClick={close}>{action.icon}<span>{action.label}</span></a>;
              }
              return (
                <button key={action.key} type="button" className={className} onClick={() => { close(); action.onClick?.(); }}>
                  {action.icon}<span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
