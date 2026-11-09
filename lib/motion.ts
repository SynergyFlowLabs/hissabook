/** Shared spring vocabulary for Hisaabook's motion system. */
export const springs = {
  soft: { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const,
  snappy: { type: 'spring', stiffness: 380, damping: 32, mass: 1 } as const,
  bouncy: { type: 'spring', stiffness: 420, damping: 22, mass: 0.9 } as const,
  pill: { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const,
};

export const fadeRise = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { ...springs.soft } },
} as const;

export const staggerParent = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
} as const;
