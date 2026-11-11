'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ArrowRight, ChevronLeft, LogOut, Search, UserRound, X } from 'lucide-react';
import { clearCache } from '@/lib/route-cache';
import { resetWorkspaceContext, useWorkspaceContext } from '@/lib/use-workspace-context';
import { useSharedNotifications } from '@/components/notifications-provider';
import NotificationButton from '@/components/notification-button';
import NotificationPanel from '@/components/notification-panel';
import SoundControl from '@/components/sound-control';
import { motion, AnimatePresence } from 'motion/react';

/**
 * The one topbar every screen uses.
 *
 * Before this each screen hand-rolled its own: Dashboard had a search button,
 * the others had a currency badge, Transactions and Reports had a "Overview"
 * back pill, and each one carried its own empty `.topbar-notif-slot` for the bell
 * to be portalled into. The result was five different bars that also changed
 * shape between their skeleton and their loaded state, because the skeleton and
 * the screen each drew their own copy.
 *
 * Everything that is the same on every screen now lives here: the breadcrumb, and
 * a single control cluster ordered profile, notifications, search from the right
 * edge inwards. Screens contribute only the crumb text and, optionally, one extra
 * control beside the cluster.
 *
 * The notification bell and panel are owned here too, so there is still exactly
 * one polling loop, and the bell can no longer disappear: the portal that used to
 * move it between per-screen slots is gone, and with it the window where the slot
 * was not found yet.
 */

const ROUTE_CRUMBS: Array<[string, string]> = [
  ['/transactions', 'Transactions'],
  ['/accounts', 'Accounts'],
  ['/inventory', 'Inventory'],
  ['/team', 'Team & salaries'],
  ['/partners', 'Partners & shares'],
  ['/reports', 'Reports'],
];

export function crumbFromPathname(pathname: string | null): string {
  if (!pathname || pathname === '/') return 'Overview';
  for (const [prefix, label] of ROUTE_CRUMBS) if (pathname.startsWith(prefix)) return label;
  return 'Overview';
}

const roleLabel: Record<string, string> = {
  OWNER: 'Owner', ADMIN: 'Admin', BOOKKEEPER: 'Bookkeeper', VIEWER: 'Viewer', PAYROLL: 'Payroll',
};

const initials = (value: string) =>
  value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

/** A link back to the screen's parent, for detail screens that need one. */
export function TopbarBack({ href = '/#overview', label = 'Overview' }: { href?: string; label?: string }) {
  return (
    <Link className="topbar-back" href={href}>
      <ChevronLeft size={14} aria-hidden="true" /><span>{label}</span>
    </Link>
  );
}

export default function Topbar({ crumb, back, onTermChange, children }: {
  crumb?: string;
  back?: { href: string; label: string };
  /** Called with the committed search term. Overview re-filters its own list. */
  onTermChange?: (term: string) => void;
  /** One screen-specific control, drawn before the shared cluster. */
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const label = crumb ?? crumbFromPathname(pathname);
  const isOverview = !pathname || pathname === '/';
  const { userName, workspaceName, role } = useWorkspaceContext();
  const notif = useSharedNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // The term outlives the field: Overview filters its own activity list with it,
  // and every other screen hands it to the ledger.
  const [term, setTerm] = useState('');
  const profileRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Close the profile menu on an outside tap or Escape, and hand focus back.
  useEffect(() => {
    if (!profileOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        profileRef.current?.querySelector<HTMLButtonElement>('.topbar-profile-trigger')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Overview subscribes to the term through a DOM-free channel: it renders the
  // field itself, so it needs the value, not the field.
  useEffect(() => {
    onTermChange?.(term);
  }, [term, onTermChange]);

  return (
    <header className={`topbar${back ? ' has-back' : ''}${searchOpen ? ' is-searching' : ''}`}>
      <div className="breadcrumb">
        <Link href="/#overview" className="breadcrumb-home">Workspace</Link>
        <span aria-hidden="true">›</span>
        <strong>{label}</strong>
      </div>

      <div className="top-actions">
        {back && <TopbarBack href={back.href} label={back.label} />}
        {children}

        <div className="topbar-cluster">
          {/* Search. The Overview filters its own activity list, so it stays
              interactive there; on every other screen it opens the ledger's
              search, which is where activity can actually be searched across
              the whole book rather than the six rows on the dashboard. */}
          {searchOpen ? (
            <form
              className="topbar-search"
              onSubmit={(event) => {
                event.preventDefault();
                const next = (searchInputRef.current?.value ?? '').trim();
                setSearchOpen(false);
                setTerm(next);
                // Overview filters the activity list right under the field, so
                // Enter only commits; elsewhere the ledger is where the term
                // can be searched in full.
                if (isOverview) return;
                router.push(next ? `/transactions?q=${encodeURIComponent(next)}` : '/transactions');
              }}
            >
              <Search size={15} aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                name="q"
                aria-label="Search transactions"
                placeholder="Search activity…"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                defaultValue={term}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return;
                  setSearchOpen(false);
                  if (isOverview) setTerm('');
                }}
              />
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setTerm('');
                  if (searchInputRef.current) searchInputRef.current.value = '';
                  searchInputRef.current?.focus();
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="topbar-icon-button"
              aria-label="Search transactions"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} aria-hidden="true" />
            </button>
          )}

          <NotificationButton
            unreadCount={notif.unreadCount}
            open={notifOpen}
            onToggle={() => { setNotifOpen((open) => !open); setProfileOpen(false); }}
          />

          <div className="topbar-profile" ref={profileRef}>
            <button
              type="button"
              className="topbar-profile-trigger"
              aria-label={`Account, ${userName}`}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              onClick={() => { setProfileOpen((open) => !open); setNotifOpen(false); }}
            >
              <span aria-hidden="true">{initials(userName) || <UserRound size={15} />}</span>
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  className="topbar-profile-menu panel"
                  role="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="topbar-profile-head">
                    <span className="topbar-profile-avatar" aria-hidden="true">{initials(userName) || <UserRound size={16} />}</span>
                    <span className="topbar-profile-who">
                      <strong>{userName}</strong>
                      <small>{roleLabel[role] ?? 'Member'} · {workspaceName}</small>
                    </span>
                  </div>
                  <div className="topbar-profile-row">
                    <span>Sound</span>
                    <SoundControl />
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="topbar-profile-link"
                    onClick={() => { setProfileOpen(false); window.location.assign('/#accounts'); }}
                  >
                    <ArrowRight size={14} aria-hidden="true" /><span>Accounts and profile</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="topbar-profile-signout"
                    onClick={() => { clearCache(); resetWorkspaceContext(); void signOut({ redirectTo: '/login' }); }}
                  >
                    <LogOut size={14} aria-hidden="true" /><span>Sign out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={notif.items}
        unreadCount={notif.unreadCount}
        loading={notif.loading}
        onMarkRead={notif.markRead}
        onMarkAllRead={notif.markAllRead}
      />
    </header>
  );
}
