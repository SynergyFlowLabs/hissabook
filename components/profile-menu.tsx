'use client';

import { useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import SoundControl from '@/components/sound-control';
import { clearCache } from '@/lib/route-cache';
import { resetWorkspaceContext } from '@/lib/use-workspace-context';

/**
 * The account sheet: who you are signed in as, the device sound toggle, and the
 * two things you can do about it.
 *
 * The sound toggle and sign out used to sit loose in the sidebar footer beside
 * the name, while the same two controls also existed in the mobile menu and the
 * topbar menu. That left the name with 88px for 91px of text, so it clipped even
 * though the sidebar had room, and it meant three places drew the same actions.
 * One sheet, opened from either the sidebar footer or the topbar profile button.
 */

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner', ADMIN: 'Admin', BOOKKEEPER: 'Bookkeeper', VIEWER: 'Viewer', PAYROLL: 'Payroll',
};

const initials = (value: string) =>
  value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

export default function ProfileMenu({
  open,
  onClose,
  userName,
  role,
  workspaceName,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  role: string;
  workspaceName: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(frame);
      if (opener?.isConnected) opener.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="notif-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="profile"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Account"
            className="profile-sheet panel"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          >
            <div className="profile-sheet-head">
              <Avatar className="profile-avatar" aria-hidden="true">
                <AvatarFallback className="bg-transparent text-[11px] font-extrabold">
                  {initials(userName) || <UserRound size={15} />}
                </AvatarFallback>
              </Avatar>
              <span className="profile-sheet-who">
                <strong>{userName}</strong>
                <small>{ROLE_LABEL[role] ?? 'Member'} · {workspaceName}</small>
              </span>
              <button type="button" className="profile-sheet-close" onClick={onClose} aria-label="Close account menu">Close</button>
            </div>

            <div className="profile-sheet-row">
              <span>Sound and haptics</span>
              <SoundControl />
            </div>

            <button
              type="button"
              className="profile-sheet-signout"
              data-autofocus
              onClick={() => {
                onClose();
                clearCache();
                resetWorkspaceContext();
                void signOut({ redirectTo: '/login' });
              }}
            >
              <LogOut size={15} aria-hidden="true" /><span>Sign out</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
