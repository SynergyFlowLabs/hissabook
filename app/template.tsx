'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/** Subtle page transition: quick fade + rise on route change; static for reduced-motion users. */
export default function Template({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
