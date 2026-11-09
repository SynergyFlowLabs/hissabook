'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

  useEffect(() => {
    // The topbar mounts in the same commit as the sidebar, so it is present by
    // the time effects run; no observer needed.
    setSlot(document.querySelector<HTMLElement>('.topbar-notif-slot'));
  }, []);

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
