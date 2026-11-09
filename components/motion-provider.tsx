'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/** Honors prefers-reduced-motion app-wide for everything rendered inside. */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
