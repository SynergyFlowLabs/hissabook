'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import NotificationButton from '@/components/notification-button';

/**
 * Renders the notification bell into the page topbar without lifting
 * notification state into every screen.
 *
 * Each screen's topbar carries an empty `<span className="topbar-notif-slot" />`
 * next to its search control. This component portals the bell into it, so the
 * bell and its panel stay owned by the sidebar (one polling loop, one piece of
 * state) while the control appears where the owner asked for it: top right,
 * right of search.
 *
 * Falls back to the bottom pill if no slot exists, so a screen that has not
 * adopted the slot cannot silently lose the bell.
 *
 * The slot is re-resolved when the page changes. The shell now lives in the root
 * layout and survives client-side navigation, while the slot belongs to whichever
 * screen is mounted: on a route change the old slot is detached and a new one is
 * created. A one-shot lookup would leave the bell pointing at a detached node and
 * drop it from the topbar after the first navigation.
 */
export default function TopbarNotifPortal({
  unreadCount,
  open,
  onToggle,
}: {
  unreadCount: number;
  open: boolean;
  onToggle: () => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Keyed on the route: each screen ships its own slot, so the node we portalled
    // into last time is detached by the time the new screen commits. Re-querying
    // here keeps the bell in the new topbar instead of dropping it after one tap.
    const find = () => document.querySelector<HTMLElement>('.topbar-notif-slot');
    setSlot(find());
    // A screen can commit its topbar a tick after the route change (suspense or a
    // deferred child); observe for the slot to appear rather than racing it.
    if (find()) return;
    const observer = new MutationObserver(() => {
      const next = find();
      if (!next) return;
      setSlot(next);
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  const bell = (
    <NotificationButton
      variant="topbar"
      unreadCount={unreadCount}
      open={open}
      onToggle={onToggle}
    />
  );

  if (!slot) return null;
  return createPortal(bell, slot);
}
