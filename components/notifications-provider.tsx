'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useNotifications } from '@/lib/use-notifications';

/**
 * One notification feed for the whole signed-in app.
 *
 * The hook used to be called by the shell only, so its 25s poll and its "already
 * counted" flag survived navigation. The bell now lives in the page topbar, which
 * every screen renders, so calling the hook there would restart the poll on each
 * route change and make the unread dot blink away and back. Owning it here, once,
 * above the screens, keeps the feed as steady as it was without giving up the
 * single bell.
 */
type NotificationFeed = ReturnType<typeof useNotifications>;

const NotificationsContext = createContext<NotificationFeed | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const feed = useNotifications();
  return <NotificationsContext.Provider value={feed}>{children}</NotificationsContext.Provider>;
}

/**
 * The shared feed. Screens are rendered inside the shell, so this always has a
 * value where the topbar is drawn; the throw is a build-time guard, not a
 * runtime condition to handle.
 */
export function useSharedNotifications(): NotificationFeed {
  const feed = useContext(NotificationsContext);
  if (!feed) throw new Error('useSharedNotifications must be used inside NotificationsProvider');
  return feed;
}
