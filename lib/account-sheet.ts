/**
 * A one-line broadcast for "open the account sheet".
 *
 * The sheet lives in the shell, because that is the only place that mounts once
 * and therefore survives navigation. The control that opens it sits in the page
 * topbar, which every screen renders and which shares no state with the shell.
 * Rather than duplicate the sheet in each screen, or lift another layer of state
 * through the layout, the topbar announces and the shell listens. It is a single
 * boolean, so a plain event is the smallest thing that works.
 */
const EVENT = 'hisaabook:account-sheet';

export function openAccountSheet() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeAccountSheet(handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
