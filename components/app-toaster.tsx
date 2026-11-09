'use client';

import { Toaster } from 'sileo';

/** App-wide physics toast surface. Positioned top-center to clear the mobile pill nav. */
export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      theme="light"
      offset={{ top: 'max(10px, env(safe-area-inset-top))', left: 0, right: 0 }}
      options={{ fill: '#14231b', roundness: 18 }}
    />
  );
}
