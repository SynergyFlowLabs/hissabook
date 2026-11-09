/** Tiny haptics helper: Android honors navigator.vibrate; iOS silently no-ops. */
const PATTERNS = {
  success: [12, 40, 12],
  error: [70, 50, 70],
  notify: [25],
  undo: [10],
  tap: [8],
} as const;

export type HapticCue = keyof typeof PATTERNS;

export function vibrate(cue: HapticCue, enabled = true) {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(PATTERNS[cue] as unknown as number[]); } catch { /* noop */ }
}
