'use client';

import { usePathname } from 'next/navigation';
import AppSidebar from '@/components/app-sidebar';
import { NotificationsProvider } from '@/components/notifications-provider';

/**
 * Mounts the app shell once, in the root layout, so client-side navigation never
 * tears it down. Before this, `AppSidebar` was rendered inside every screen
 * component, which meant each route change unmounted it: the notification poll
 * restarted, the nav pill animation reset, and the shell's markup was resent.
 *
 * The active item is derived from the pathname rather than passed by each page,
 * so there is one source of truth for "where am I". Props that genuinely differ
 * per screen (workspace name, loan badge) come from a tiny client store the
 * screens write to when their data lands.
 *
 * `/login`, `/setup` and `/invite` are unauthenticated, so the shell stays out of
 * the way there.
 */
const SHELL_HIDDEN = ['/login', '/setup', '/invite'];

const ROUTE_KEYS: Array<[string, string]> = [
  ['/transactions', 'transactions'],
  ['/inventory', 'inventory'],
  ['/team', 'team'],
  ['/partners', 'partners'],
  ['/reports', 'reports'],
];

export function currentFromPathname(pathname: string | null): string {
  if (!pathname || pathname === '/') return 'overview';
  for (const [prefix, key] of ROUTE_KEYS) if (pathname.startsWith(prefix)) return key;
  return 'overview';
}

export default function AppShell() {
  const pathname = usePathname();
  if (!pathname || SHELL_HIDDEN.some((prefix) => pathname.startsWith(prefix))) return null;
  return <AppSidebar current={currentFromPathname(pathname)} />;
}

/**
 * The feed around the page itself.
 *
 * A provider in `AppShell` cannot reach `{children}`: the shell and the page are
 * siblings in the root layout, so context set in one is invisible to the other.
 * The bell lives in each screen's topbar, so the page is the branch that needs
 * the provider. The shell branch has no bell of its own any more, which is why
 * only one provider is ever mounted and the poll runs once.
 */
export function AppShellFeed({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!pathname || SHELL_HIDDEN.some((prefix) => pathname.startsWith(prefix))) return <>{children}</>;
  return <NotificationsProvider>{children}</NotificationsProvider>;
}
