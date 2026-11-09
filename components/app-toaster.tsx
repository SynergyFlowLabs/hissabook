'use client';

import { Toaster } from 'sileo';

/**
 * App-wide physics toast surface. Positioned top-center to clear the mobile pill nav.
 *
 * sileo treats `theme` as "what colour is the page I am drawn on", not "what
 * colour should the toast be". Its palette is therefore inverted on purpose:
 *
 *   theme="light" -> fill #1a1a1a (dark toast, for light pages)
 *   theme="dark"  -> fill #f2f2f2 (light toast, for dark pages)
 *
 * Hisaabook is a light-themed product with a deliberately dark, brand-filled
 * toast, so `light` is correct and was never the bug. (An earlier attempt to
 * "fix" the white body by switching this to `dark` would have made the toast
 * literally white — worth stating so nobody does it again.)
 *
 * The real cause of the white shoulders was a missing fill on the surfaces
 * sileo paints *around* the body. `options.fill` only reached the toast layer;
 * the gooey pill behind the rounded corners and the description text kept their
 * own defaults, so the corner area rendered pale over our canvas. The CSS skin
 * below pins every one of those surfaces to the brand fill, and the description
 * to the same muted green our other dark surfaces use.
 */
const BRAND_FILL = '#14231b';

export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      // Light-page palette => dark toast fill. See the note above: this is not a
      // mistake, and reversing it turns the toast white.
      theme="light"
      offset={{ top: 'max(10px, env(safe-area-inset-top))', left: 0, right: 0 }}
      options={{ fill: BRAND_FILL, roundness: 18 }}
    />
  );
}
