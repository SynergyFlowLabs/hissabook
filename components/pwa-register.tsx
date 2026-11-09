'use client';

import { useEffect } from 'react';

/** Registers /sw.js once per session. Push-only worker — safe in every environment. */
export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('service worker registration failed', error);
    });
  }, []);
  return null;
}
