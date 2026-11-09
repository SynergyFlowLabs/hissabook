'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Animates number *changes* with an ease-out-expo tween.
 * Initial SSR render outputs the settled value (no hydration mismatch);
 * afterwards, updates (e.g. fresh data after a save) spring old → new.
 */
export default function AnimatedAmount({
  value,
  format,
  duration = 700,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (reduced || from === to || !Number.isFinite(from) || !Number.isFinite(to)) {
      displayRef.current = to;
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t >= 1 ? 1 : 1 - Math.pow(2, -9 * t);
      const next = from + (to - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, reduced]);

  return <>{format(display)}</>;
}
