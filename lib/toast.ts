'use client';

/**
 * Central toast seam — every mutation outcome flows through here.
 * Plays the matching sound cue and delegates to Sileo for rendering.
 */
import { sileo } from 'sileo';
import { sounds } from '@/lib/sounds';

type Options = { description?: string; duration?: number | null; href?: string };

const hapticsSafe = () => { sounds.toastPop(); };

export const toast = {
  success(title: string, description?: string, options?: Options) {
    sounds.success();
    return sileo.success({ title, description, ...options });
  },
  /** Ledger save/payment — the cash-register cha-ching. */
  ledger(title: string, description?: string, options?: Options) {
    sounds.ledger();
    return sileo.success({ title, description, ...options });
  },
  /** Salary payday — three-note chord resolving into the register. */
  salaryPaid(title: string, description?: string, options?: Options) {
    sounds.salaryPaid();
    return sileo.success({ title, description, ...options });
  },
  invite(title: string, description?: string, options?: Options) {
    sounds.invite();
    return sileo.success({ title, description, ...options });
  },
  error(title: string, description?: string, options?: Options) {
    sounds.error();
    return sileo.error({ title, description, ...options });
  },
  warning(title: string, description?: string, options?: Options) {
    sounds.warning();
    return sileo.warning({ title, description, ...options });
  },
  info(title: string, description?: string, options?: Options) {
    hapticsSafe();
    return sileo.info({ title, description, ...options });
  },
  /** Reversible destructive actions — toast carries an Undo button. */
  withUndo(title: string, onUndo: () => void, description?: string) {
    sounds.undo();
    return sileo.action({ title, description, button: { title: 'Undo', onClick: onUndo } });
  },
  /** Action toast with a single call-to-action (e.g. smart priming CTAs). */
  ask(title: string, description: string, buttonTitle: string, onClick: () => void) {
    sounds.info();
    return sileo.action({ title, description, button: { title: buttonTitle, onClick } });
  },
  /** Loading → success/error morph for async mutations. */
  promise<T>(promise: Promise<T> | (() => Promise<T>), messages: { loading: string; success: string; error: string }) {
    return sileo.promise(promise, {
      loading: { title: messages.loading },
      success: { title: messages.success },
      error: { title: messages.error },
    });
  },
  dismiss(id: string) { sileo.dismiss(id); },
} as const;
