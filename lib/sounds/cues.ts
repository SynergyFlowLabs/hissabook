/** The Hisaabook cue bank — every recipe is synthesized; no binary assets. */
import { metallicHit, noiseSweep, tone } from './engine';
import { vibrate } from '@/lib/haptics';
import { getSoundState } from './engine';

const haptic = (cue: 'success' | 'error' | 'notify' | 'undo' | 'tap') => vibrate(cue, getSoundState().haptics);

export const sounds = {
  tap() { tone({ freq: 1800, type: 'square', attack: 0.002, decay: 0.045, gain: 0.07 }); haptic('tap'); },
  toggleOn() { tone({ freq: 620, endFreq: 940, type: 'sine', attack: 0.006, decay: 0.1, gain: 0.12 }); tone({ freq: 1240, type: 'sine', attack: 0.006, decay: 0.08, gain: 0.04, when: 0.05 }); },
  toggleOff() { tone({ freq: 940, endFreq: 620, type: 'sine', attack: 0.006, decay: 0.09, gain: 0.11 }); },
  open() { noiseSweep({ from: 320, to: 1400, duration: 0.17, gain: 0.08 }); },
  close() { noiseSweep({ from: 1400, to: 340, duration: 0.15, gain: 0.07 }); },
  success() {
    tone({ freq: 523.25, type: 'triangle', attack: 0.012, decay: 0.34, gain: 0.16 });
    tone({ freq: 783.99, type: 'triangle', attack: 0.012, decay: 0.4, gain: 0.15, when: 0.075 });
    tone({ freq: 1568, type: 'sine', attack: 0.008, decay: 0.3, gain: 0.035, when: 0.075 });
    haptic('success');
  },
  error() {
    tone({ freq: 174.61, type: 'sine', attack: 0.03, decay: 0.45, gain: 0.16 });
    tone({ freq: 164.81, type: 'sine', attack: 0.03, decay: 0.5, gain: 0.13, when: 0.05 });
    haptic('error');
  },
  warning() {
    tone({ freq: 392, type: 'triangle', attack: 0.01, decay: 0.14, gain: 0.13 });
    tone({ freq: 392, type: 'triangle', attack: 0.01, decay: 0.16, gain: 0.13, when: 0.17 });
  },
  info() { tone({ freq: 880, type: 'sine', attack: 0.006, decay: 0.13, gain: 0.1 }); },
  toastPop() {
    tone({ freq: 880, type: 'sine', attack: 0.004, decay: 0.09, gain: 0.1 });
    tone({ freq: 1760, type: 'sine', attack: 0.004, decay: 0.08, gain: 0.045, when: 0.015 });
  },
  notify() {
    tone({ freq: 987.77, type: 'sine', attack: 0.006, decay: 0.22, gain: 0.15 });
    tone({ freq: 1318.51, type: 'sine', attack: 0.006, decay: 0.34, gain: 0.15, when: 0.14 });
    tone({ freq: 3944, type: 'sine', attack: 0.004, decay: 0.18, gain: 0.03, when: 0.14 });
    haptic('notify');
  },
  /** Cash-register cha-ching — the ledger's signature. */
  ledger() {
    metallicHit(1568, 0.13, 0);
    metallicHit(1174.66, 0.11, 0.055);
    tone({ freq: 3136, type: 'sine', attack: 0.004, decay: 0.26, gain: 0.028, when: 0.055 });
    haptic('success');
  },
  swoosh() { noiseSweep({ from: 400, to: 1800, duration: 0.22, gain: 0.1 }); },
  shimmer() {
    [1318.51, 1760, 2217.46, 2637.02].forEach((freq, i) => {
      tone({ freq, type: 'sine', attack: 0.005, decay: 0.22, gain: 0.06, when: i * 0.065 });
    });
    haptic('success');
  },
  undo() {
    tone({ freq: 329.63, type: 'triangle', attack: 0.008, decay: 0.12, gain: 0.12 });
    tone({ freq: 246.94, type: 'triangle', attack: 0.008, decay: 0.16, gain: 0.11, when: 0.08 });
    haptic('undo');
  },
  reminder() {
    tone({ freq: 659.25, type: 'triangle', attack: 0.012, decay: 0.18, gain: 0.12 });
    tone({ freq: 659.25, type: 'triangle', attack: 0.012, decay: 0.22, gain: 0.12, when: 0.24 });
  },
  /** Two-stage payday confirmation: success chord resolving into the register. */
  salaryPaid() {
    tone({ freq: 523.25, type: 'triangle', attack: 0.01, decay: 0.3, gain: 0.14 });
    tone({ freq: 659.25, type: 'triangle', attack: 0.01, decay: 0.3, gain: 0.13, when: 0.08 });
    tone({ freq: 783.99, type: 'triangle', attack: 0.01, decay: 0.34, gain: 0.13, when: 0.16 });
    metallicHit(1568, 0.1, 0.3);
    haptic('success');
  },
  /** Warm two-tone chime for invitations sent/accepted. */
  invite() {
    tone({ freq: 783.99, type: 'sine', attack: 0.01, decay: 0.26, gain: 0.13 });
    tone({ freq: 1174.66, type: 'sine', attack: 0.01, decay: 0.38, gain: 0.14, when: 0.16 });
    haptic('notify');
  },
} as const;

export type SoundName = keyof typeof sounds;
