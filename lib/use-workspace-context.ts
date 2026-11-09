'use client';

import { useSyncExternalStore } from 'react';

/**
 * Workspace identity for the persistent shell.
 *
 * The shell lives in the root layout, so it cannot receive props from whichever
 * page is mounted. It reads this tiny store instead: one fetch of
 * `/api/workspace/context` per page load, shared by every consumer, kept across
 * client-side navigation because the module instance survives route changes.
 *
 * Kept deliberately minimal (name, business type, role, loan count) so a route
 * change never pulls the ledger.
 */
export type WorkspaceContext = {
  userName: string;
  workspaceName: string;
  businessType: string;
  role: string;
  loanCount: number;
};

const EMPTY: WorkspaceContext = {
  userName: 'Business owner',
  workspaceName: 'My Business',
  businessType: 'Business workspace',
  role: 'OWNER',
  loanCount: 0,
};

let snapshot: WorkspaceContext = EMPTY;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void load();
  }
  return () => listeners.delete(listener);
}

async function load() {
  try {
    const response = await fetch('/api/workspace/context', { cache: 'no-store' });
    if (!response.ok) return;
    const body = (await response.json()) as Partial<WorkspaceContext>;
    snapshot = {
      userName: body.userName || EMPTY.userName,
      workspaceName: body.workspaceName || EMPTY.workspaceName,
      businessType: body.businessType || EMPTY.businessType,
      role: body.role || EMPTY.role,
      loanCount: Number(body.loanCount) || 0,
    };
    emit();
  } catch {
    // Keep the placeholder identity: the shell still renders and navigates.
  }
}

/** Screens with fresher data (the dashboard already has the loan list) push it here. */
export function primeWorkspaceContext(patch: Partial<WorkspaceContext>) {
  const next = { ...snapshot, ...patch };
  const changed = (Object.keys(next) as Array<keyof WorkspaceContext>).some((key) => next[key] !== snapshot[key]);
  if (!changed) return;
  snapshot = next;
  emit();
}

/**
 * Drops identity back to the placeholder and allows a re-fetch. Called on sign-out
 * so the next session never inherits the previous account's name or loan badge.
 */
export function resetWorkspaceContext() {
  snapshot = EMPTY;
  started = false;
  emit();
}

export function useWorkspaceContext(): WorkspaceContext {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}
