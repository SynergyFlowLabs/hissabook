'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { signOut } from 'next-auth/react';
import {
  ArrowLeftRight, Boxes, ChevronRight, FileText, HandCoins, LayoutDashboard,
  LogOut, UserRound, UsersRound, Wallet,
} from 'lucide-react';
import SoundControl from '@/components/sound-control';

/**
 * The mobile shell. The bottom pill only has room for five destinations, so
 * Partners, Reports, the workspace links that do not fit and the profile/sign-out
 * controls live here. Before this existed those screens were unreachable on a
 * phone: the sidebar is `display: none` under 901px and has no mobile equivalent.
 */

type MenuLink = { label: string; href: string; icon: typeof LayoutDashboard; key: string };

const workspaceLinks: MenuLink[] = [
  { label: 'Overview', href: '/#overview', icon: LayoutDashboard, key: 'overview' },
  { label: 'Transactions', href: '/transactions', icon: ArrowLeftRight, key: 'transactions' },
  { label: 'Accounts', href: '/#accounts', icon: Wallet, key: 'accounts' },
  { label: 'Loans & dues', href: '/#loans', icon: HandCoins, key: 'loans' },
];

const manageLinks: MenuLink[] = [
  { label: 'Inventory', href: '/inventory', icon: Boxes, key: 'inventory' },
  { label: 'Team & salaries', href: '/team', icon: UsersRound, key: 'team' },
  { label: 'Partners', href: '/partners', icon: UsersRound, key: 'partners' },
  { label: 'Reports', href: '/reports', icon: FileText, key: 'reports' },
];

export default function MobileMenu({
  open,
  onClose,
  workspaceName,
  businessType,
  userName,
  userRole,
  current,
  loanCount = 0,
}: {
  open: boolean;
  onClose: () => void;
  workspaceName: string;
  businessType: string;
  userName: string;
  userRole: string;
  current: string;
  loanCount?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [canViewTeam, setCanViewTeam] = useState(false);

  const roleLabel: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', BOOKKEEPER: 'Bookkeeper', VIEWER: 'Viewer', PAYROLL: 'Payroll' };
  const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  useEffect(() => { setCanViewTeam(['OWNER', 'ADMIN', 'PAYROLL'].includes(userRole)); }, [userRole]);

  // Escape closes; focus returns to whatever opened the sheet.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); opener?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    // Move focus into the sheet so a keyboard or assistive tech user is not
    // left behind the scrim.
    const first = panelRef.current?.querySelector<HTMLElement>('a, button');
    first?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const renderGroup = (title: string, links: MenuLink[]) => {
    const visible = links.filter((link) => link.key !== 'team' || canViewTeam);
    if (!visible.length) return null;
    return (
      <div className="mmenu-group">
        <div className="mmenu-label">{title}</div>
        {visible.map(({ label, href, icon: Icon, key }) => (
          <a
            key={key}
            href={href}
            className={`mmenu-link ${key === current ? 'active' : ''}`}
            aria-current={key === current ? 'page' : undefined}
            onClick={onClose}
          >
            <Icon size={17} strokeWidth={1.9} />
            <span>{label}</span>
            {key === 'loans' && loanCount > 0 && <span className="nav-badge">{loanCount}</span>}
            <ChevronRight size={15} className="mmenu-chevron" aria-hidden="true" />
          </a>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="mmenu-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            className="mmenu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.9 }}
          >
            <div className="mmenu-head">
              <span className="mmenu-avatar" aria-hidden="true">{initials(userName) || <UserRound size={16} />}</span>
              <span className="mmenu-who">
                <span className="mmenu-name">{userName}</span>
                <span className="mmenu-role">{roleLabel[userRole] ?? 'Member'} · {workspaceName}</span>
                {businessType && <span className="mmenu-type">{businessType}</span>}
              </span>
              <button type="button" className="mmenu-close" onClick={onClose} aria-label="Close menu">Close</button>
            </div>

            <div className="mmenu-scroll">
              {renderGroup('Workspace', workspaceLinks)}
              {renderGroup('Manage', manageLinks)}
            </div>

            <div className="mmenu-foot">
              <SoundControl />
              <button
                type="button"
                className="mmenu-signout"
                onClick={() => { onClose(); void signOut({ redirectTo: '/login' }); }}
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
