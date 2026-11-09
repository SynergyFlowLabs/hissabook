'use client';

import { motion } from 'motion/react';
import { Bell } from 'lucide-react';

/** Bell trigger with animated unread badge. `variant` switches chrome: sidebar (desktop) or in-pill nav slot (mobile). */
export default function NotificationButton({
  variant,
  unreadCount,
  open,
  onToggle,
}: {
  variant: 'sidebar' | 'nav';
  unreadCount: number;
  open: boolean;
  onToggle: () => void;
}) {
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications, all caught up';
  const badge = unreadCount > 0 && (
    <motion.span
      key={unreadCount}
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className="notif-badge"
      aria-hidden="true"
    >
      {unreadCount > 9 ? '9+' : unreadCount}
    </motion.span>
  );

  if (variant === 'nav') {
    return (
      <button
        type="button"
        id="notif-nav-trigger"
        className="notif-nav-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={onToggle}
      >
        <Bell size={17} strokeWidth={2} />
        <span className="notif-nav-label">Alerts</span>
        {badge}
      </button>
    );
  }

  return (
    <button
      type="button"
      id="notif-sidebar-trigger"
      className="ghost-icon-button notif-trigger"
      aria-label={label}
      aria-expanded={open}
      title="Notifications"
      onClick={onToggle}
    >
      <Bell size={16} />
      {badge}
    </button>
  );
}
