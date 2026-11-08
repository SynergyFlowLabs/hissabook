'use client';

import {
  ArrowLeftRight, ArrowRight, Briefcase, Boxes, ChevronDown, FileText,
  HandCoins, LayoutDashboard, LogOut, Settings2, UsersRound, Wallet,
} from 'lucide-react';
import { signOut } from 'next-auth/react';

const links = [
  { label: 'Overview', href: '/#overview', icon: LayoutDashboard, key: 'overview' },
  { label: 'Transactions', href: '/transactions', icon: ArrowLeftRight, key: 'transactions' },
  { label: 'Accounts', href: '/#accounts', icon: Wallet, key: 'accounts' },
  { label: 'Inventory', href: '/inventory', icon: Boxes, key: 'inventory' },
  { label: 'Loans & dues', href: '/#loans', icon: HandCoins, key: 'loans' },
  { label: 'Owners', href: '/#owners', icon: UsersRound, key: 'owners' },
  { label: 'Team & salaries', href: '/team', icon: UsersRound, key: 'team' },
  { label: 'Reports', href: '/#reports', icon: FileText, key: 'reports' },
];

export default function AppSidebar({
  workspaceName,
  businessType,
  userName,
  userRole,
  current,
  loanCount = 0,
}: {
  workspaceName: string;
  businessType: string;
  userName: string;
  userRole: string;
  current: string;
  loanCount?: number;
}) {
  const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const canViewTeam = ['OWNER', 'ADMIN', 'PAYROLL'].includes(userRole);
  const roleLabel: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', BOOKKEEPER: 'Bookkeeper', VIEWER: 'Viewer', PAYROLL: 'Payroll' };
  const visibleLinks = links.filter((link) => link.key !== 'team' || canViewTeam);
  return (
    <>
    <aside className="sidebar">
      <a href="/#overview" className="brand" aria-label="Hisaabook home">
        <span className="brand-mark"><Briefcase size={19} strokeWidth={2.1} /></span>
        <span className="brand-copy"><span className="brand-name">hisaabook</span><span className="brand-caption">Business, in balance</span></span>
      </a>
      <button className="workspace-switcher" onClick={() => window.alert('Multiple business workspaces are planned for a future release.')}>
        <span className="workspace-avatar">{initials(workspaceName)}</span>
        <span className="workspace-meta"><span className="workspace-name">{workspaceName}</span><span className="workspace-type">{businessType}</span></span>
        <ChevronDown size={14} color="#89958d" />
      </button>
      <div className="nav-label">Workspace</div>
      <nav className="nav-list" aria-label="Main navigation">
        {visibleLinks.map(({ label, href, icon: Icon, key }) => <a key={key} className={`nav-link ${key === current ? 'active' : ''}`} href={href}>
          <Icon size={16} strokeWidth={1.8} /><span>{label}</span>{key === 'loans' && loanCount > 0 && <span className="nav-badge">{loanCount}</span>}
        </a>)}
      </nav>
      <div className="nav-label" style={{ marginTop: 24 }}>Manage</div>
      <nav className="nav-list" aria-label="Management navigation"><a className="nav-link" href="/#owners"><Settings2 size={16} strokeWidth={1.8} /><span>Business settings</span></a></nav>
      <div className="sidebar-spacer" />
      <div className="help-card"><div className="help-title">A better way to work together</div><div className="help-copy">Keep your business records clear and everyone on the same page.</div><a href="/#about" className="help-link">Explore Hisaabook <ArrowRight size={12} /></a></div>
      <div className="user-profile"><div className="profile-avatar">{initials(userName)}</div><div className="profile-meta"><div className="profile-name">{userName}</div><div className="profile-role">{roleLabel[userRole] ?? 'Member'}</div></div><button className="logout-button" aria-label="Sign out" title="Sign out" onClick={() => signOut({ redirectTo: '/login' })}><LogOut size={15} /></button></div>
    </aside>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {[
        { label: 'Home', href: '/#overview', icon: LayoutDashboard, key: 'overview' },
        { label: 'Activity', href: '/transactions', icon: ArrowLeftRight, key: 'transactions' },
        { label: 'Stock', href: '/inventory', icon: Boxes, key: 'inventory' },
        { label: 'Team', href: '/team', icon: UsersRound, key: 'team' },
      ].filter(({ key }) => key !== 'team' || canViewTeam).map(({ label, href, icon: Icon, key }) => <a key={key} href={href} className={key === current ? 'active' : ''}><Icon size={17} /><span>{label}</span></a>)}
    </nav>
    </>
  );
}
