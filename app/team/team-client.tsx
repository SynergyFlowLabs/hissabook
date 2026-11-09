'use client';

import Link from 'next/link';
import { readCache, writeCache } from '@/lib/route-cache';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, ArrowDownLeft, CalendarDays, Check, CircleDollarSign, Copy, Link2, Pencil, Plus, ShieldCheck, Trash2, UserPlus, UsersRound, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { sounds } from '@/lib/sounds';

type TeamData = {
  workspace: { id: number; name: string; currency: string };
  accounts: Array<{ id: number; name: string; currency: string }>;
  employees: Array<{ id: number; name: string; jobTitle: string; employeeRef: string; startDate: string; endDate: string | null; active: number; currentSalary: number | null; currency: string | null; rateEffectiveFrom: string | null; salaryRates: Array<{ id: number; employeeId: number; amount: number; currency: string; effectiveFrom: string }> }>;
  periods: Array<{ id: number; employeeId: number; employeeName: string; jobTitle: string; periodStart: string; periodEnd: string; dueDate: string; amountDue: number; amountPaid: number; balance: number; currency: string; note: string; status: string }>;
  payments: Array<{ id: number; salaryPeriodId: number; transactionId: number; amount: number; paidAt: string; note: string; accountId: number; accountName: string }>;
  summary: { activeEmployees: number; currentSalaryDue: number; pendingPeriods: number; paidThisMonth: number };
};

type WorkspaceAccess = {
  members: Array<{ id: number; userId: number; name: string; email: string; role: string; active: number; joinedAt: string }>;
  invitations: Array<{ id: number; email: string; name: string; role: string; expiresAt: string; createdAt: string }>;
};
type DialogMode = 'employee' | 'employeeEdit' | 'period' | 'payment';
const money = (amount: number) => `PKR ${Math.abs(amount).toLocaleString('en-PK')}`;
const dateLabel = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' });
const monthStart = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); };
const monthEnd = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10); };

/** Cached across navigation so returning to Team paints instantly. */
const TEAM_CACHE = 'team';

export default function TeamClient({ userName, role }: { userName: string; role: string }) {
  // Seeded from the cache so returning to this screen paints the last payload
  // instead of the full-screen "Loading team records" state.
  const [data, setData] = useState<TeamData | null>(() => readCache<TeamData>(TEAM_CACHE));
  const [accessData, setAccessData] = useState<WorkspaceAccess | null>(null);
  const [accessError, setAccessError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('BOOKKEEPER');
  const [inviteError, setInviteError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteSaving, setInviteSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('employee');
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [employeeRef, setEmployeeRef] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthlySalary, setMonthlySalary] = useState('');
  const [rateEffectiveFrom, setRateEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [periodStart, setPeriodStart] = useState(monthStart);
  const [periodEnd, setPeriodEnd] = useState(monthEnd);
  const [dueDate, setDueDate] = useState(() => `${monthStart().slice(0, 7)}-10`);
  const [periodAmount, setPeriodAmount] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccount, setPaymentAccount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState('');

  const refresh = async () => {
    const response = await fetch('/api/team', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load employee and salary records.');
    setData(result as TeamData); writeCache(TEAM_CACHE, result as TeamData);
    if (result.employees[0]) setSelectedEmployee((current: string) => current || String(result.employees[0].id));
    if (result.accounts[0]) setPaymentAccount((current: string) => current || String(result.accounts[0].id));
  };
  const refreshAccess = async () => {
    const response = await fetch('/api/workspace/members', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load workspace access.');
    setAccessData(result as WorkspaceAccess);
  };
  useEffect(() => { refresh().catch((error: Error) => setLoadError(error.message)); }, []);
  useEffect(() => { if (role === 'OWNER') refreshAccess().catch((error: Error) => setAccessError(error.message)); }, [role]);

  const activeEmployees = useMemo(() => data?.employees.filter((employee) => employee.active) ?? [], [data]);
  const currentPeriod = data?.periods.find((period) => String(period.id) === selectedPeriod);
  const selectedEmployeeData = data?.employees.find((employee) => String(employee.id) === selectedEmployee);

  const openEmployee = () => { setDialogMode('employee'); setEditingEmployeeId(null); setEmployeeName(''); setJobTitle(''); setEmployeeRef(''); setStartDate(new Date().toISOString().slice(0, 10)); setMonthlySalary(''); setRateEffectiveFrom(new Date().toISOString().slice(0, 10)); setFormError(''); setDialogOpen(true); };
  const openEditEmployee = (employee: TeamData['employees'][number]) => {
    setDialogMode('employeeEdit'); setEditingEmployeeId(employee.id); setFormError('');
    setEmployeeName(employee.name); setJobTitle(employee.jobTitle); setEmployeeRef(employee.employeeRef); setStartDate(employee.startDate);
    setMonthlySalary(employee.currentSalary ? String(employee.currentSalary) : ''); setRateEffectiveFrom(employee.rateEffectiveFrom ?? employee.startDate);
    setDialogOpen(true);
  };
  const toggleEmployee = async (employee: TeamData['employees'][number]) => {
    const action = employee.active ? 'Archive' : 'Reactivate';
    if (!window.confirm(`${action} ${employee.name}? Salary history will be kept.`)) return;
    try {
      const response = await fetch(`/api/team/employees/${employee.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !employee.active }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not ${action.toLowerCase()} employee.`);
      setData(result as TeamData); writeCache(TEAM_CACHE, result as TeamData);
      const revert = employee.active; // undo restores the pre-action state
      toast.withUndo(revert ? 'Employee archived' : 'Employee reactivated', () => {
        void (async () => {
          try {
            const revertResponse = await fetch(`/api/team/employees/${employee.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: revert }) });
            const revertResult = await revertResponse.json();
            if (revertResponse.ok) { setData(revertResult as TeamData); writeCache(TEAM_CACHE, revertResult as TeamData); toast.success(revert ? 'Employee reactivated' : 'Employee archived'); }
            else toast.error('Could not undo that change.', revertResult.error);
          } catch { toast.error('Could not undo that change.'); }
        })();
      }, 'Salary history was kept.');
    } catch (error) { toast.error('Could not update employee status.', error instanceof Error ? error.message : undefined); }
  };
  const openPeriod = () => {
    setDialogMode('period'); setFormError(''); setPeriodStart(monthStart()); setPeriodEnd(monthEnd()); setDueDate(`${monthStart().slice(0, 7)}-10`);
    setPeriodAmount(selectedEmployeeData?.currentSalary ? String(selectedEmployeeData.currentSalary) : ''); setDialogOpen(true);
  };
  const openPayment = (period: TeamData['periods'][number]) => {
    setDialogMode('payment'); setFormError(''); setSelectedPeriod(String(period.id)); setPaymentAmount(String(period.balance));
    setPaymentDate(new Date().toISOString().slice(0, 10)); setPaymentNote(''); setDialogOpen(true);
  };

  const openInvite = () => { setInviteName(''); setInviteEmail(''); setInviteRole('BOOKKEEPER'); setInviteError(''); setInviteLink(''); setInviteOpen(true); };
  const createInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setInviteSaving(true); setInviteError('');
    try {
      const response = await fetch('/api/workspace/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: inviteName, email: inviteEmail, role: inviteRole }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create invitation.');
      setInviteLink(`${window.location.origin}/invite/${result.token}`);
      await refreshAccess(); toast.invite('Invitation created', 'Share the link with the invitee. It expires in 7 days.');
    } catch (error) { setInviteError(error instanceof Error ? error.message : 'Could not create invitation.'); }
    finally { setInviteSaving(false); }
  };
  const changeMember = async (id: number, update: { role?: string; active?: boolean }) => {
    try {
      const response = await fetch(`/api/workspace/members/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update access.');
      setAccessData(result as WorkspaceAccess); toast.success('Workspace access updated');
    } catch (error) { setAccessError(error instanceof Error ? error.message : 'Could not update access.'); }
  };
  const revokeInvite = async (id: number, email: string) => {
    if (!window.confirm(`Revoke the pending invitation for ${email}?`)) return;
    try {
      const response = await fetch(`/api/workspace/invitations/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not revoke invitation.');
      setAccessData(result as WorkspaceAccess); toast.success('Invitation revoked');
    } catch (error) { setAccessError(error instanceof Error ? error.message : 'Could not revoke invitation.'); }
  };
  const copyInviteLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); sounds.tap(); toast.success('Link copied'); }
    catch { setInviteError('Copy was blocked. Select and copy the invitation link below.'); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setFormError('');
    try {
      let url = '/api/team/employees';
      let method = 'POST';
      let body: Record<string, unknown> = {};
      if (dialogMode === 'employee') {
        body = { name: employeeName, jobTitle, employeeRef, startDate, monthlySalary: Number(monthlySalary), rateEffectiveFrom: startDate };
      } else if (dialogMode === 'employeeEdit') {
        const employee = data?.employees.find((item) => item.id === editingEmployeeId);
        const rateChanged = Boolean(monthlySalary) && (!employee || Number(monthlySalary) !== employee.currentSalary || rateEffectiveFrom !== employee.rateEffectiveFrom);
        url = `/api/team/employees/${editingEmployeeId}`; method = 'PATCH';
        body = { name: employeeName, jobTitle, employeeRef, startDate, ...(rateChanged ? { monthlySalary: Number(monthlySalary), rateEffectiveFrom } : {}) };
      } else if (dialogMode === 'period') {
        url = '/api/team/salary-periods';
        body = { employeeId: Number(selectedEmployee), periodStart, periodEnd, dueDate, amountDue: periodAmount === '' ? undefined : Number(periodAmount) };
      } else {
        url = `/api/team/salary-periods/${selectedPeriod}/payments`;
        body = { amount: Number(paymentAmount), accountId: Number(paymentAccount), paidAt: paymentDate, note: paymentNote };
      }
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this record.');
      setData(result as TeamData); writeCache(TEAM_CACHE, result as TeamData); setDialogOpen(false);
      if (dialogMode === 'employee' || dialogMode === 'employeeEdit') { setEmployeeName(''); setJobTitle(''); setEmployeeRef(''); setMonthlySalary(''); setEditingEmployeeId(null); }
      if (dialogMode === 'payment') {
        toast.salaryPaid('Salary paid', 'Payment posted to the ledger and marked against the period.');
      } else {
        toast.success(
          dialogMode === 'employeeEdit' ? 'Employee updated'
            : dialogMode === 'employee' ? 'Employee added'
            : 'Salary period created',
        );
      }
    } catch (error) { sounds.error(); setFormError(error instanceof Error ? error.message : 'Could not save this record.'); }
    finally { setSaving(false); }
  };

  if (!data) return <div className="loading-screen"><div className="icon-badge"><UsersRound size={20} /></div><strong>{loadError || 'Loading team records…'}</strong><span>{loadError ? 'Refresh the page to try again.' : 'Preparing your employee and salary book'}</span></div>;

  return (
    <div className="app-shell" id="overview">
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><Link href="/#overview" style={{ color: 'inherit', textDecoration: 'none' }}>Workspace</Link><span aria-hidden="true">›</span><strong>Team & salaries</strong></div>
          <div className="top-actions"><span className="currency-badge">PRIVATE · PKR</span><span className="topbar-notif-slot" /></div>
        </header>
        <div className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />People & pay</span>
              <h1 className="page-title">Team & salaries</h1>
              <p className="page-subtitle">Keep employee details and salary obligations in one private place.</p>
            </div>
            <div className="inventory-heading-actions"><Button variant="outline" className="h-11 rounded-full bg-white" onClick={openPeriod}><CalendarDays size={14} /> Create pay period</Button><button className="lime-button" onClick={openEmployee}><Plus size={15} strokeWidth={2.6} /> Add employee</button></div>
          </section>

          <div className="payroll-notice"><ShieldCheck size={17} /><span><strong>Restricted salary data.</strong> Only owners, admins, and payroll members can access employee compensation. Hisaabook records salary obligations; it does not automate payroll or calculate statutory deductions.</span></div>

          <section className="stat-grid" aria-label="Payroll summary">
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Active employees</span><span className="stat-icon lime"><UsersRound size={16} /></span></div><div className="stat-value">{data.summary.activeEmployees}</div><div className="stat-foot">Current team records</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Salary due this month</span><span className="stat-icon terra"><CircleDollarSign size={16} /></span></div><div className="stat-value">{money(data.summary.currentSalaryDue)}</div><div className="stat-foot">Unpaid across this month’s periods</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Paid this month</span><span className="stat-icon green"><ArrowDownLeft size={16} /></span></div><div className="stat-value">{money(data.summary.paidThisMonth)}</div><div className="stat-foot">Recorded salary payments</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Open pay periods</span><span className="stat-icon slate"><CalendarDays size={16} /></span></div><div className="stat-value">{data.summary.pendingPeriods}</div><div className="stat-foot">Unpaid or partially paid</div></div>
          </section>

          <section className="soft-card" style={{ marginTop: 14 }}>
            <div className="card-header-row">
              <div><div className="card-title">Employee directory</div><div className="card-subtitle">Monthly pay rates are versioned by effective date.</div></div>
              <button className="text-link" onClick={openEmployee}>Add an employee <Plus size={12} /></button>
            </div>
            <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Reference</th><th>Start date</th><th>Monthly rate</th><th>Status</th></tr></thead><tbody>{data.employees.map((employee) => <tr key={employee.id}><td><div className="cell-title">{employee.name}</div><div className="cell-sub">{employee.jobTitle || 'Team member'}</div></td><td className="table-muted">{employee.employeeRef || '-'}</td><td className="table-muted">{dateLabel(employee.startDate)}</td><td className="cell-num">{employee.currentSalary ? money(employee.currentSalary) : 'No rate set'}<div className="cell-sub" style={{ fontWeight: 600 }}>{employee.rateEffectiveFrom ? `Effective ${dateLabel(employee.rateEffectiveFrom)}` : ''}</div></td><td><div className="row-actions"><span className={`pill ${employee.active ? 'good' : 'neutral'}`}>{employee.active ? 'Active' : 'Inactive'}</span><button className="icon-row-button" aria-label={`Edit ${employee.name}`} onClick={() => openEditEmployee(employee)}><Pencil size={13} /></button><button className="icon-row-button archive" aria-label={`${employee.active ? 'Archive' : 'Reactivate'} ${employee.name}`} onClick={() => toggleEmployee(employee)}><Archive size={13} /></button></div></td></tr>)}</tbody></table></div>
            {!data.employees.length && <div className="empty-state">Add an employee to start tracking salary periods.</div>}
          </section>

          <section className="soft-card" style={{ marginTop: 14 }}>
            <div className="card-header-row">
              <div><div className="card-title">Salary periods</div><div className="card-subtitle">Due amounts, payments, and remaining balance are shown separately.</div></div>
              <button className="text-link" onClick={openPeriod}>Create period <Plus size={12} /></button>
            </div>
            <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Employee / period</th><th>Due date</th><th>Amount due</th><th>Paid</th><th>Remaining</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.periods.map((period) => <tr key={period.id}><td><div className="cell-title">{period.employeeName}</div><div className="cell-sub">{dateLabel(period.periodStart)} to {dateLabel(period.periodEnd)}</div></td><td className="table-muted">{dateLabel(period.dueDate)}</td><td className="cell-num">{money(period.amountDue)}</td><td className="table-muted cell-num" style={{ fontWeight: 600 }}>{money(period.amountPaid)}</td><td className="cell-num">{money(period.balance)}</td><td><span className={`pill ${period.status === 'PAID' ? 'good' : period.status === 'OVERDUE' ? 'bad' : 'warn'}`}>{period.status === 'PARTIAL' ? 'Part paid' : period.status.toLowerCase()}</span></td><td>{period.balance > 0 && <button className="text-link" onClick={() => openPayment(period)}>Record payment</button>}</td></tr>)}</tbody></table></div>
            {!data.periods.length && <div className="empty-state">Create a salary period to track what is due.</div>}
          </section>

          <section className="soft-card" style={{ marginTop: 14 }}>
            <div className="card-header-row">
              <div><div className="card-title">Recent salary payments</div><div className="card-subtitle">Each recorded payment is also posted as a salaries expense in the business ledger.</div></div>
            </div>
            {data.payments.length ? <div className="movement-list">{data.payments.slice(0, 6).map((payment) => <div className="movement-row" key={payment.id}><span className="movement-icon out"><ArrowDownLeft size={16} /></span><div className="movement-description"><strong>{money(payment.amount)} salary payment</strong><small style={{ textTransform: 'none' }}>{payment.accountName}{payment.note ? ` · ${payment.note}` : ''}</small></div><div className="movement-quantity negative">−{money(payment.amount)}</div><time>{dateLabel(payment.paidAt)}</time></div>)}</div> : <div className="empty-state"><Wallet size={22} style={{ margin: '0 auto 8px', color: 'var(--lime-strong)' }} />No salary payments recorded yet.</div>}
          </section>

          {role === 'OWNER' && <section className="soft-card" style={{ marginTop: 14 }}>
            <div className="card-header-row">
              <div><div className="card-title">Workspace access</div><div className="card-subtitle">Invite people individually, assign least-privilege roles, and revoke access when needed.</div></div>
              <button className="lime-button" style={{ height: 42, fontSize: 11 }} onClick={openInvite}><UserPlus size={14} /> Invite member</button>
            </div>
            {accessError && <div className="form-error" role="alert" style={{ marginTop: 14 }}>{accessError}</div>}
            {!accessData ? <div className="empty-state">Loading workspace members…</div> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Member</th><th>Workspace role</th><th>Status</th><th>Access</th></tr></thead><tbody>{accessData.members.map((member) => <tr key={member.id}>
              <td><div className="cell-title">{member.name}</div><div className="cell-sub">{member.email}{member.role === 'OWNER' ? ' · Workspace owner' : ''}</div></td>
              <td>{member.role === 'OWNER' ? <span className="role-pill owner-role">Owner</span> : <select className="member-role-select" aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => changeMember(member.id, { role: event.target.value })}><option value="ADMIN">Admin</option><option value="BOOKKEEPER">Bookkeeper</option><option value="PAYROLL">Payroll</option><option value="VIEWER">Viewer</option></select>}</td>
              <td><span className={`pill ${member.active ? 'good' : 'neutral'}`}>{member.active ? 'Active' : 'Revoked'}</span></td>
              <td>{member.role !== 'OWNER' && <button className={`access-toggle ${member.active ? 'revoke' : 'restore'}`} onClick={() => changeMember(member.id, { active: !member.active })}>{member.active ? 'Revoke' : 'Restore'}</button>}</td>
            </tr>)}</tbody></table></div>}
            {accessData?.invitations.length ? <div className="pending-invites"><div className="card-title" style={{ padding: '0 2px 10px' }}>Pending invitations</div><div className="data-table-wrap" style={{ marginTop: 0 }}><table className="data-table"><thead><tr><th>Invitee</th><th>Role</th><th>Expires</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{accessData.invitations.map((invite) => <tr key={invite.id}><td><div className="cell-title">{invite.name}</div><div className="cell-sub">{invite.email}</div></td><td><span className="role-pill">{invite.role.replace('_', ' ').toLowerCase()}</span></td><td className="table-muted">{dateLabel(invite.expiresAt)}</td><td><button className="icon-row-button archive" aria-label={`Revoke invitation for ${invite.email}`} onClick={() => revokeInvite(invite.id, invite.email)}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div></div> : null}
            <div className="access-role-note"><strong>Role access</strong><span>Admin manages business records and salaries. Bookkeeper edits transactions and inventory. Payroll can manage employee and salary records. Viewer can read business and inventory data.</span></div>
          </section>}
          <p className="footer-note">Salary balances are tracked separately from payments. The demo recognizes salary expense when paid; this is not payroll, tax, or legal advice.</p>
        </div>
      </main>

      {/* Main form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-[560px] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">{dialogMode === 'employee' ? 'Add employee' : dialogMode === 'employeeEdit' ? 'Manage employee' : dialogMode === 'period' ? 'Create salary period' : 'Record salary payment'}</DialogTitle>
            <DialogDescription>{dialogMode === 'employee' ? 'Add the minimum employee and pay details for this record.' : dialogMode === 'employeeEdit' ? 'Update the profile or add a new effective-dated salary rate. Past rates remain in history.' : dialogMode === 'period' ? 'Use the employee’s effective monthly rate or enter an agreed period amount.' : 'Payments update the outstanding balance and create a linked salary expense.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <div className="form-grid">{dialogMode === 'employee' || dialogMode === 'employeeEdit' ? <>
              <div className="form-field full"><Label htmlFor="emp-name">Employee name</Label><Input id="emp-name" required maxLength={100} value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Full name" className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="emp-title">Job title</Label><Input id="emp-title" maxLength={80} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Designer" className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="emp-ref">Employee reference (optional)</Label><Input id="emp-ref" maxLength={40} value={employeeRef} onChange={(event) => setEmployeeRef(event.target.value)} placeholder="e.g. EMP-025" className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="emp-start">Start date</Label><Input id="emp-start" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="emp-salary">Monthly salary (PKR)</Label><Input id="emp-salary" type="number" min="1" step="1" required value={monthlySalary} onChange={(event) => setMonthlySalary(event.target.value)} placeholder="e.g. 75,000" className="h-11 rounded-xl" /></div>
              {dialogMode === 'employeeEdit' && <>
                <div className="form-field full"><Label htmlFor="emp-rate-from">New rate effective from</Label><Input id="emp-rate-from" type="date" required value={rateEffectiveFrom} onChange={(event) => setRateEffectiveFrom(event.target.value)} className="h-11 rounded-xl" /><span className="field-hint">A changed salary is added to history; it does not rewrite earlier periods.</span></div>
                <div className="salary-rate-history full"><strong>Rate history</strong>{(data.employees.find((item) => item.id === editingEmployeeId)?.salaryRates ?? []).map((rate) => <div key={rate.id}><span>{dateLabel(rate.effectiveFrom)}</span><span>{money(rate.amount)} / month</span></div>)}</div>
              </>}
            </> : dialogMode === 'period' ? <>
              <div className="form-field full"><Label htmlFor="period-employee">Employee</Label>
                <Select value={selectedEmployee} onValueChange={(value) => { setSelectedEmployee(value); const employee = data.employees.find((item) => String(item.id) === value); setPeriodAmount(employee?.currentSalary ? String(employee.currentSalary) : ''); }}>
                  <SelectTrigger id="period-employee" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{activeEmployees.map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{employee.name} · {employee.jobTitle}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="form-field"><Label htmlFor="period-start">Period starts</Label><Input id="period-start" type="date" required value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="period-end">Period ends</Label><Input id="period-end" type="date" required value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="period-due">Payment due date</Label><Input id="period-due" type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="period-amount">Amount due (PKR)</Label><Input id="period-amount" type="number" min="1" step="1" value={periodAmount} onChange={(event) => setPeriodAmount(event.target.value)} placeholder="Uses current rate if blank" className="h-11 rounded-xl" /></div>
            </> : <>
              <div className="salary-payment-summary full"><span>{currentPeriod?.employeeName ?? 'Salary period'}<small>{currentPeriod ? `${dateLabel(currentPeriod.periodStart)} to ${dateLabel(currentPeriod.periodEnd)} · ${money(currentPeriod.balance)} remaining` : ''}</small></span></div>
              <div className="form-field"><Label htmlFor="pay-amount">Payment amount (PKR)</Label><Input id="pay-amount" type="number" min="1" max={currentPeriod?.balance} step="1" required value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="pay-date">Paid date</Label><Input id="pay-date" type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="h-11 rounded-xl" /></div>
              <div className="form-field full"><Label htmlFor="pay-account">Paid from</Label>
                <Select value={paymentAccount} onValueChange={setPaymentAccount}>
                  <SelectTrigger id="pay-account" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{data.accounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="form-field full"><Label htmlFor="pay-note">Reference / note</Label><Input id="pay-note" maxLength={1000} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Optional payment reference" className="h-11 rounded-xl" /></div>
            </>}</div>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <DialogFooter className="mt-5 gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-full px-5" disabled={saving} onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="h-11 rounded-full px-6" disabled={saving}>{saving ? 'Saving…' : <><Check size={15} /> {dialogMode === 'employeeEdit' ? 'Save changes' : dialogMode === 'employee' ? 'Create employee' : dialogMode === 'period' ? 'Create period' : 'Record payment'}</>}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[92vh] max-w-[520px] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Invite a workspace member</DialogTitle>
            <DialogDescription>Choose the access this person needs. The invite link is only shown once.</DialogDescription>
          </DialogHeader>
          {inviteLink ? <div className="invite-link-result"><div className="invite-link-icon"><Link2 size={18} /></div><strong>Invitation ready to share</strong><span>Send this private link to {inviteEmail}. It expires in seven days and can be used once.</span><div className="form-field" style={{ textAlign: 'left' }}><Label htmlFor="invite-url">Invitation link</Label><Input id="invite-url" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} className="h-11 rounded-xl font-mono text-[10px]" /></div><Button className="h-11 rounded-full justify-center" onClick={copyInviteLink}><Copy size={14} /> Copy link</Button><button className="text-link" style={{ justifySelf: 'center' }} onClick={() => { setInviteLink(''); setInviteEmail(''); setInviteName(''); }}>Invite another person</button></div> : <form onSubmit={createInvite}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="form-field"><Label htmlFor="invite-name">Name</Label><Input id="invite-name" required maxLength={100} value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Invitee name" className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="invite-email">Email address</Label><Input id="invite-email" type="email" required maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="person@business.com" className="h-11 rounded-xl" /></div>
              <div className="form-field"><Label htmlFor="invite-role">Workspace role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ADMIN">Admin · manage records, employees and salaries</SelectItem><SelectItem value="BOOKKEEPER">Bookkeeper · edit transactions and inventory</SelectItem><SelectItem value="PAYROLL">Payroll · manage employee and salary records</SelectItem><SelectItem value="VIEWER">Viewer · read dashboard and inventory</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {inviteError && <div className="form-error" role="alert">{inviteError}</div>}
            <DialogFooter className="mt-5 gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-full px-5" disabled={inviteSaving} onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" className="h-11 rounded-full px-6" disabled={inviteSaving}>{inviteSaving ? 'Creating…' : <><UserPlus size={15} /> Create invitation</>}</Button>
            </DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
