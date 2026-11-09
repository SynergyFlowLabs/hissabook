'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlarmClockCheck, Banknote, Boxes, CheckCheck, HandCoins, MailPlus, ReceiptText, UsersRound, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ClientNotification } from '@/lib/use-notifications';
import { timeAgo } from '@/lib/use-notifications';
import PushEnroll from '@/components/push-enroll';

const KIND_ICON: Record<ClientNotification['kind'], typeof ReceiptText> = {
  transaction: ReceiptText,
  loan: HandCoins,
  inventory: Boxes,
  salary: Banknote,
  member: UsersRound,
  invitation: MailPlus,
  reminder: AlarmClockCheck,
};

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onStoreChange);
      return () => mq.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export default function NotificationPanel({
  open,
  onClose,
  items,
  unreadCount,
  loading,
  onMarkRead,
  onMarkAllRead,
}: {
  open: boolean;
  onClose: () => void;
  items: ClientNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
}) {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const panelRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const today: ClientNotification[] = [];
    const earlier: ClientNotification[] = [];
    for (const item of items) {
      const at = new Date(item.createdAt.includes('T') ? item.createdAt : `${item.createdAt.replace(' ', 'T')}Z`);
      (at >= startOfToday ? today : earlier).push(item);
    }
    return { today, earlier };
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    // move focus into the panel on open
    const node = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    const frame = window.requestAnimationFrame(() => node?.focus());
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(frame);
      document.getElementById('notif-sidebar-trigger')?.focus();
      const trigger = document.getElementById('notif-sidebar-trigger')
        ?? document.getElementById('notif-nav-trigger');
      trigger?.focus();
    };
  }, [open, onClose]);

  const activate = (item: ClientNotification) => {
    onMarkRead(item.id);
    onClose();
    router.push(item.href);
  };

  const renderItem = (item: ClientNotification) => {
    const Icon = KIND_ICON[item.kind] ?? ReceiptText;
    const line = item.actorName ? `${item.actorName} · ${item.body}` : item.body;
    return (
      <button
        key={item.id}
        type="button"
        className={`notif-item ${item.read ? '' : 'unread'}`}
        onClick={() => activate(item)}
      >
        <span className="notif-icon" aria-hidden="true"><Icon size={17} strokeWidth={1.9} /></span>
        <span className="notif-copy">
          <span className="notif-title">{item.title}</span>
          {line && <span className="notif-body">{line}</span>}
        </span>
        <span className="notif-side">
          <span className="notif-time">{timeAgo(item.createdAt)}</span>
          {!item.read && <span className="notif-dot" aria-label="Unread" />}
        </span>
      </button>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {isMobile && <motion.div key="scrim" className="notif-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />}
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal={isMobile}
            aria-label="Notifications"
            className="notif-panel panel"
            initial={isMobile ? { y: 420, opacity: 0.6 } : { opacity: 0, y: -12, scale: 0.96 }}
            animate={isMobile ? { y: 0, opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { y: 420, opacity: 0.6 } : { opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag={isMobile ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 500) onClose(); }}
          >
            <div className="notif-header">
              <div>
                <div className="notif-heading">Notifications</div>
                <div className="notif-sub">{unreadCount > 0 ? `${unreadCount} unread across the business` : 'You’re all caught up'}</div>
              </div>
              <div className="notif-header-actions">
                <button
                  type="button"
                  className="notif-markall"
                  onClick={onMarkAllRead}
                  disabled={unreadCount === 0}
                  data-autofocus
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
                <button type="button" className="ghost-icon-button" onClick={onClose} aria-label="Close notifications"><X size={17} /></button>
              </div>
            </div>

            <div className="notif-list" role="list" aria-label="Notification list">
              {loading && items.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="notif-skeleton" aria-hidden="true">
                    <span className="notif-skeleton-icon" />
                    <span className="notif-skeleton-lines"><i /><i /></span>
                  </div>
                ))
              ) : items.length === 0 ? (
                <div className="notif-empty">
                  <span className="notif-empty-ring"><CheckCheck size={22} /></span>
                  <strong>You’re all caught up.</strong>
                  <span>Ledger activity, payroll, stock and invites will land here, and on your devices once you enable alerts.</span>
                </div>
              ) : (
                <>
                  {groups.today.length > 0 && (
                    <>
                      <div className="notif-group-label">Today</div>
                      {groups.today.map(renderItem)}
                    </>
                  )}
                  {groups.earlier.length > 0 && (
                    <>
                      <div className="notif-group-label">Earlier</div>
                      {groups.earlier.map(renderItem)}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="notif-enroll"><PushEnroll /></div>
            <div className="notif-footer">
              <span>Hisaabook · business, in balance</span>
              <span className="notif-footer-note">Shared with your whole workspace</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
