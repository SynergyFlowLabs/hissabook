'use client';

import {
  ArrowRight, Boxes, ChevronDown, HandCoins, LayoutDashboard,
  ArrowLeftRight, Menu, Wallet, UsersRound, FileText, LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { signOut } from 'next-auth/react';
import { clearCache } from '@/lib/route-cache';
import { resetWorkspaceContext } from '@/lib/use-workspace-context';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import SoundControl from '@/components/sound-control';
import NotificationButton from '@/components/notification-button';
import NotificationPanel from '@/components/notification-panel';
import MobileMenu from '@/components/mobile-menu';
import TopbarNotifPortal from '@/components/topbar-notif-portal';
import { useNotifications } from '@/lib/use-notifications';
import { useWorkspaceContext } from '@/lib/use-workspace-context';
import { useState } from 'react';

const workspaceLinks = [
  { label: 'Overview', href: '/#overview', icon: LayoutDashboard, key: 'overview' },
  { label: 'Transactions', href: '/transactions', icon: ArrowLeftRight, key: 'transactions' },
  { label: 'Accounts', href: '/accounts', icon: Wallet, key: 'accounts' },
  { label: 'Loans & dues', href: '/#loans', icon: HandCoins, key: 'loans' },
];

const manageLinks = [
  { label: 'Inventory', href: '/inventory', icon: Boxes, key: 'inventory' },
  { label: 'Team & salaries', href: '/team', icon: UsersRound, key: 'team' },
  { label: 'Partners', href: '/partners', icon: UsersRound, key: 'partners' },
  { label: 'Reports', href: '/reports', icon: FileText, key: 'reports' },
];

const mobileLinks = [
  { label: 'Home', href: '/#overview', icon: LayoutDashboard, key: 'overview' },
  { label: 'Activity', href: '/transactions', icon: ArrowLeftRight, key: 'transactions' },
  { label: 'Accounts', href: '/accounts', icon: Wallet, key: 'accounts' },
  { label: 'Team', href: '/team', icon: UsersRound, key: 'team' },
];

export default function AppSidebar({ current }: { current: string }) {
  // Identity comes from the shared store so the shell can live in the root
  // layout and survive navigation; `current` is derived from the pathname by
  // AppShell. Both used to be props from each page, which is what forced the
  // shell to be remounted on every route change.
  const { workspaceName, businessType, role: userRole, loanCount, userName } = useWorkspaceContext();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notif = useNotifications();
  const toggleNotif = () => setNotifOpen((open) => !open);
  const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const canViewTeam = ['OWNER', 'ADMIN', 'PAYROLL'].includes(userRole);
  const roleLabel: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', BOOKKEEPER: 'Bookkeeper', VIEWER: 'Viewer', PAYROLL: 'Payroll' };
  const renderLink = ({ label, href, icon: Icon, key }: { label: string; href: string; icon: typeof LayoutDashboard; key: string }) => (
    <Link key={key} className={`nav-link ${key === current ? 'active' : ''}`} href={href} aria-current={key === current ? 'page' : undefined}>
      <Icon size={17} strokeWidth={1.9} /><span>{label}</span>
      {key === 'loans' && loanCount > 0 && <span className="nav-badge">{loanCount}</span>}
    </Link>
  );
  const visibleWorkspace = workspaceLinks;
  const visibleManage = manageLinks.filter((link) => link.key !== 'team' || canViewTeam);
  const visibleMobile = mobileLinks.filter((link) => link.key !== 'team' || canViewTeam);

  return (
    <>
      <aside className="sidebar">
        <Link href="/#overview" className="brand" aria-label="Hisaabook home">
          <span className="brand-mark"><img src="/logo.svg" alt="" width={38} height={38} /></span>
          <span className="brand-copy"><span className="brand-name">hisaabook</span><span className="brand-caption">Business, in balance</span></span>
        </Link>
        <button className="workspace-switcher" onClick={() => window.alert('Multiple business workspaces are planned for a future release.')} aria-label={`Workspace: ${workspaceName}`}>
          <span className="workspace-avatar">{initials(workspaceName)}</span>
          <span className="workspace-meta"><span className="workspace-name">{workspaceName}</span><span className="workspace-type">{businessType}</span></span>
          <ChevronDown size={16} color="#a7b8ab" />
        </button>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list" aria-label="Main navigation">{visibleWorkspace.map(renderLink)}</nav>
        <div className="nav-label" style={{ marginTop: 18 }}>Manage</div>
        <nav className="nav-list" aria-label="Management navigation">{visibleManage.map(renderLink)}</nav>
        <div className="sidebar-spacer" />
        <div className="help-card">
          <div className="help-title">Invite your accountant</div>
          <div className="help-copy">Give them view access. No passwords shared, and access can be revoked anytime.</div>
          <Link href="/partners" className="help-link">Manage partners & shares <ArrowRight size={11} /></Link>
        </div>
        <div className="user-profile">
          <Avatar className="profile-avatar"><AvatarFallback className="bg-transparent text-[11px] font-extrabold">{initials(userName)}</AvatarFallback></Avatar>
          <div className="profile-meta"><div className="profile-name">{userName}</div><div className="profile-role">{roleLabel[userRole] ?? 'Member'}</div></div>
          <NotificationButton variant="sidebar" unreadCount={notif.unreadCount} open={notifOpen} onToggle={toggleNotif} />
          <SoundControl />
          <Button variant="ghost" size="icon" className="rounded-full text-[#66766c] hover:text-[#a4452c]" aria-label="Sign out" title="Sign out" onClick={() => { clearCache(); resetWorkspaceContext(); void signOut({ redirectTo: '/login' }); }}><LogOut size={16} /></Button>
        </div>
      </aside>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {visibleMobile.map(({ label, href, icon: Icon, key }) => {
          const active = key === current;
          return (
            <Link key={key} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              {active && <motion.span layoutId="mobile-nav-pill" className="mobile-nav-pill" aria-hidden="true" transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }} />}
              <Icon size={17} strokeWidth={2} /><span>{label}</span>
            </Link>
          );
        })}
        {/* Everything the pill cannot hold: Partners, Reports, the remaining
            workspace links, profile and sign out. */}
        <button
          type="button"
          className={`mobile-nav-menu ${menuOpen ? 'active' : ''}`}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={17} strokeWidth={2} /><span>Menu</span>
        </button>
      </nav>
      {/* The bell lives in the page topbar now (right of search). It stays owned
          here so there is still exactly one polling loop and one panel. */}
      <TopbarNotifPortal unreadCount={notif.unreadCount} open={notifOpen} onToggle={toggleNotif} />
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        workspaceName={workspaceName}
        businessType={businessType}
        userName={userName}
        userRole={userRole}
        current={current}
        loanCount={loanCount}
      />
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={notif.items}
        unreadCount={notif.unreadCount}
        loading={notif.loading}
        onMarkRead={notif.markRead}
        onMarkAllRead={notif.markAllRead}
      />
    </>
  );
}
