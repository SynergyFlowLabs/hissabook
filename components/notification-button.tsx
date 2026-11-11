'use client';

import { motion } from 'motion/react';
import { Bell } from 'lucide-react';

/**
 * The topbar bell, with an unread dot.
 *
 * It is the only bell in the app: it sits in `Topbar` on every screen, beside
 * the profile, at every width. It used to have three variants (sidebar footer,
 * bottom pill, page topbar) and a slot portal moved it between them, which is
 * what made the bar look different on each screen. The badge draws the exact
 * count for assistive tech through the button's label, but shows it as a dot:
 * the owner asked for the count badge at the top right to go.
 */
export default function NotificationButton({
  unreadCount,
  open,
  onToggle,
}: {
  unreadCount: number;
  open: boolean;
  onToggle: () => void;
}) {
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications, all caught up';
  return (
    <button
      type="button"
      id="notif-topbar-trigger"
      className="notif-topbar-btn"
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onToggle}
    >
      <Bell size={17} strokeWidth={2} />
      {unreadCount > 0 && (
        <motion.span
          key={unreadCount}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="notif-badge"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
