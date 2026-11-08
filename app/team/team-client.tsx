'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Archive, ArrowDownLeft, CalendarDays, Check, CircleDollarSign, Copy, Link2, Pencil, Plus, ShieldCheck, Trash2, UserPlus, UsersRound, X } from 'lucide-react';
import AppSidebar from '@/components/app-sidebar';

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
const money = (amount: number) => `₨ ${Math.abs(amount).toLocaleString('en-PK')}`;
const dateLabel = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' });
const monthStart = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); };
const monthEnd = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10); };

export default function TeamClient({ userName, role }: { userName: string; role: string }) {
  const [data, setData] = useState<TeamData | null>(null);
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
  const [toast, setToast] = useState('');
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
    setData(result as TeamData);
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
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000); };

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
      setData(result as TeamData); showToast(employee.active ? 'Employee archived. Salary history was kept.' : 'Employee reactivated.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not update employee status.'); }
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
      await refreshAccess(); showToast('Invitation created. Share the link with the invitee.');
    } catch (error) { setInviteError(error instanceof Error ? error.message : 'Could not create invitation.'); }
    finally { setInviteSaving(false); }
  };
  const changeMember = async (id: number, update: { role?: string; active?: boolean }) => {
    try {
      const response = await fetch(`/api/workspace/members/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update access.');
      setAccessData(result as WorkspaceAccess); showToast('Workspace access updated.');
    } catch (error) { setAccessError(error instanceof Error ? error.message : 'Could not update access.'); }
  };
  const revokeInvite = async (id: number, email: string) => {
    if (!window.confirm(`Revoke the pending invitation for ${email}?`)) return;
    try {
      const response = await fetch(`/api/workspace/invitations/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not revoke invitation.');
      setAccessData(result as WorkspaceAccess); showToast('Invitation revoked.');
    } catch (error) { setAccessError(error instanceof Error ? error.message : 'Could not revoke invitation.'); }
  };
  const copyInviteLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); showToast('Invitation link copied.'); }
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
      setData(result as TeamData); setDialogOpen(false);
      if (dialogMode === 'employee' || dialogMode === 'employeeEdit') { setEmployeeName(''); setJobTitle(''); setEmployeeRef(''); setMonthlySalary(''); setEditingEmployeeId(null); }
      showToast(dialogMode === 'employeeEdit' ? 'Employee record updated.' : dialogMode === 'employee' ? 'Employee record added.' : dialogMode === 'period' ? 'Salary period created.' : 'Salary payment recorded.');
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save this record.'); }
    finally { setSaving(false); }
  };

  if (!data) return <div className="loading-screen"><div className="brand-mark"><UsersRound size={20} /></div><strong>{loadError || 'Loading team records…'}</strong><span>{loadError ? 'Refresh the page to try again.' : 'Preparing your employee and salary book'}</span></div>;

  return <div className="app-shell" id="overview">
    <AppSidebar workspaceName={data.workspace.name} businessType="Team & payroll records" userName={userName} userRole={role} current="team" />
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><a href="/#overview">Workspace</a><span>/</span><strong>Team & salaries</strong></div><div className="top-actions"><span className="currency-badge">PRIVATE · PKR</span></div></header>
      <div className="content">
        <section className="page-heading"><div><div className="eyebrow">PEOPLE & PAY</div><h1 className="page-title">Team & salaries</h1><div className="page-subtitle">Keep employee details and salary obligations in one private place.</div></div><div className="inventory-heading-actions"><button className="subtle-button" onClick={openPeriod}><CalendarDays size={13} /> Create pay period</button><button className="primary-button" onClick={openEmployee}><Plus size={15} /> Add employee</button></div></section>
        <div className="payroll-notice"><ShieldCheck size={15} /><span><strong>Restricted salary data.</strong> Only owners, admins, and payroll members can access employee compensation. Hisaabook records salary obligations; it does not automate payroll or calculate statutory deductions.</span></div>
        <section className="stats-grid inventory-stats">
          <div className="stat-card"><div className="stat-top"><span className="stat-label">Active employees</span><span className="stat-icon inventory-stat-icon"><UsersRound size={15} /></span></div><div className="stat-value">{data.summary.activeEmployees}</div><div className="stat-foot">Current team records</div></div>
          <div className="stat-card"><div className="stat-top"><span className="stat-label">Salary due this month</span><span className="stat-icon inventory-stat-warn"><CircleDollarSign size={15} /></span></div><div className="stat-value">{money(data.summary.currentSalaryDue)}</div><div className="stat-foot">Unpaid amount across this month’s periods</div></div>
          <div className="stat-card"><div className="stat-top"><span className="stat-label">Paid this month</span><span className="stat-icon inventory-stat-blue"><ArrowDownLeft size={15} /></span></div><div className="stat-value">{money(data.summary.paidThisMonth)}</div><div className="stat-foot">Recorded salary payments</div></div>
          <div className="stat-card"><div className="stat-top"><span className="stat-label">Open pay periods</span><span className="stat-icon inventory-stat-gold"><CalendarDays size={15} /></span></div><div className="stat-value">{data.summary.pendingPeriods}</div><div className="stat-foot">Unpaid or partially paid</div></div>
        </section>

        <section className="panel inventory-panel">
          <div className="panel-header"><div><div className="panel-title">Employee directory</div><div className="panel-subtitle">Monthly pay rates are versioned by effective date.</div></div><button className="link-button" onClick={openEmployee}>Add an employee <Plus size={12} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></button></div>
          <div className="inventory-table-wrap"><table className="transaction-table inventory-table"><thead><tr><th>Employee</th><th>Reference</th><th>Start date</th><th>Monthly rate</th><th>Status</th></tr></thead><tbody>{data.employees.map((employee) => <tr key={employee.id}><td><div className="inventory-item-name">{employee.name}<small>{employee.jobTitle || 'Team member'}</small></div></td><td className="table-muted">{employee.employeeRef || '—'}</td><td className="table-muted">{dateLabel(employee.startDate)}</td><td className="inventory-quantity">{employee.currentSalary ? money(employee.currentSalary) : 'No rate set'}<small>{employee.rateEffectiveFrom ? `Effective ${dateLabel(employee.rateEffectiveFrom)}` : ''}</small></td><td><div className="employee-actions"><span className={`stock-pill ${employee.active ? 'healthy' : 'low'}`}><i />{employee.active ? 'Active' : 'Inactive'}</span><button className="row-icon-button" aria-label={`Edit ${employee.name}`} onClick={() => openEditEmployee(employee)}><Pencil size={12} /></button><button className="row-icon-button archive" aria-label={`${employee.active ? 'Archive' : 'Reactivate'} ${employee.name}`} onClick={() => toggleEmployee(employee)}><Archive size={12} /></button></div></td></tr>)}</tbody></table></div>
          {!data.employees.length && <div className="empty-state">Add an employee to start tracking salary periods.</div>}
        </section>

        <section className="panel inventory-panel movement-panel">
          <div className="panel-header"><div><div className="panel-title">Salary periods</div><div className="panel-subtitle">Due amounts, payments, and remaining balance are shown separately.</div></div><button className="link-button" onClick={openPeriod}>Create period <Plus size={12} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></button></div>
          <div className="inventory-table-wrap"><table className="transaction-table inventory-table"><thead><tr><th>Employee / period</th><th>Due date</th><th>Amount due</th><th>Paid</th><th>Remaining</th><th>Status</th><th></th></tr></thead><tbody>{data.periods.map((period) => <tr key={period.id}><td><div className="inventory-item-name">{period.employeeName}<small>{dateLabel(period.periodStart)} – {dateLabel(period.periodEnd)}</small></div></td><td className="table-muted">{dateLabel(period.dueDate)}</td><td>{money(period.amountDue)}</td><td className="table-muted">{money(period.amountPaid)}</td><td className="inventory-quantity">{money(period.balance)}</td><td><span className={`stock-pill ${period.status === 'PAID' ? 'healthy' : period.status === 'OVERDUE' ? 'low' : 'due'}`}><i />{period.status === 'PARTIAL' ? 'Part paid' : period.status.toLowerCase()}</span></td><td>{period.balance > 0 && <button className="link-button" onClick={() => openPayment(period)}>Record payment</button>}</td></tr>)}</tbody></table></div>
          {!data.periods.length && <div className="empty-state">Create a salary period to track what is due.</div>}
        </section>

        <section className="panel salary-history-panel"><div className="panel-header"><div><div className="panel-title">Recent salary payments</div><div className="panel-subtitle">Each recorded payment is also posted as a salaries expense in the business ledger.</div></div></div>
          {data.payments.length ? <div className="movement-list">{data.payments.slice(0, 6).map((payment) => <div className="movement-row" key={payment.id}><span className="movement-icon out"><ArrowDownLeft size={14} /></span><div className="movement-description"><strong>{money(payment.amount)} salary payment</strong><small>{payment.accountName}{payment.note ? ` · ${payment.note}` : ''}</small></div><div className="movement-quantity negative">−{money(payment.amount)}</div><time>{dateLabel(payment.paidAt)}</time></div>)}</div> : <div className="empty-state">No salary payments recorded yet.</div>}
        </section>
        {role === 'OWNER' && <section className="panel workspace-access-panel">
          <div className="panel-header"><div><div className="panel-title">Workspace access</div><div className="panel-subtitle">Invite people individually, assign least-privilege roles, and revoke access when needed.</div></div><button className="primary-button" onClick={openInvite}><UserPlus size={14} /> Invite member</button></div>
          {accessError && <div className="form-error access-error" role="alert">{accessError}</div>}
          {!accessData ? <div className="empty-state">Loading workspace members…</div> : <div className="inventory-table-wrap"><table className="transaction-table inventory-table"><thead><tr><th>Member</th><th>Workspace role</th><th>Status</th><th>Access</th></tr></thead><tbody>{accessData.members.map((member) => <tr key={member.id}>
            <td><div className="inventory-item-name">{member.name}{member.role === 'OWNER' && <small>{member.email} · Workspace owner</small>}{member.role !== 'OWNER' && <small>{member.email}</small>}</div></td>
            <td>{member.role === 'OWNER' ? <span className="role-pill owner-role">Owner</span> : <select className="form-control member-role-select" aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => changeMember(member.id, { role: event.target.value })}><option value="ADMIN">Admin</option><option value="BOOKKEEPER">Bookkeeper</option><option value="PAYROLL">Payroll</option><option value="VIEWER">Viewer</option></select>}</td>
            <td><span className={`stock-pill ${member.active ? 'healthy' : 'low'}`}><i />{member.active ? 'Active' : 'Access revoked'}</span></td>
            <td>{member.role !== 'OWNER' && <button className={`access-toggle ${member.active ? 'revoke' : 'restore'}`} onClick={() => changeMember(member.id, { active: !member.active })}>{member.active ? 'Revoke' : 'Restore'}</button>}</td>
          </tr>)}</tbody></table></div>}
          {accessData?.invitations.length ? <div className="pending-invites"><div className="panel-title">Pending invitations</div><div className="inventory-table-wrap"><table className="transaction-table inventory-table"><thead><tr><th>Invitee</th><th>Role</th><th>Expires</th><th></th></tr></thead><tbody>{accessData.invitations.map((invite) => <tr key={invite.id}><td><div className="inventory-item-name">{invite.name}<small>{invite.email}</small></div></td><td><span className="role-pill">{invite.role.replace('_', ' ').toLowerCase()}</span></td><td className="table-muted">{dateLabel(invite.expiresAt)}</td><td><button className="row-icon-button archive" aria-label={`Revoke invitation for ${invite.email}`} onClick={() => revokeInvite(invite.id, invite.email)}><Trash2 size={13} /></button></td></tr>)}</tbody></table></div></div> : null}
          <div className="access-role-note"><strong>Role access</strong><span>Admin manages business records and salaries. Bookkeeper edits transactions and inventory. Payroll can manage employee and salary records. Viewer can read business and inventory data.</span></div>
        </section>}
        <div className="footer-note">Salary balances are tracked separately from payments. The demo recognizes salary expense when paid; this is not payroll, tax, or legal advice.</div>
      </div>
    </main>

    <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-card"><div className="dialog-header"><div><Dialog.Title className="dialog-title">{dialogMode === 'employee' ? 'Add employee' : dialogMode === 'employeeEdit' ? 'Manage employee' : dialogMode === 'period' ? 'Create salary period' : 'Record salary payment'}</Dialog.Title><Dialog.Description className="dialog-description">{dialogMode === 'employee' ? 'Add the minimum employee and pay details for this record.' : dialogMode === 'employeeEdit' ? 'Update the profile or add a new effective-dated salary rate. Past rates remain in history.' : dialogMode === 'period' ? 'Use the employee’s effective monthly rate or enter an agreed period amount.' : 'Payments update the outstanding balance and create a linked salary expense.'}</Dialog.Description></div><Dialog.Close asChild><button className="close-button" aria-label="Close"><X size={15} /></button></Dialog.Close></div>
      <form onSubmit={submit}><div className="form-grid">{dialogMode === 'employee' || dialogMode === 'employeeEdit' ? <>
        <label className="form-field full"><span className="form-label">Employee name</span><input className="form-control" required maxLength={100} value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Full name" /></label>
        <label className="form-field"><span className="form-label">Job title</span><input className="form-control" maxLength={80} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Designer" /></label>
        <label className="form-field"><span className="form-label">Employee reference (optional)</span><input className="form-control" maxLength={40} value={employeeRef} onChange={(event) => setEmployeeRef(event.target.value)} placeholder="e.g. EMP-025" /></label>
        <label className="form-field"><span className="form-label">Start date</span><input className="form-control" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label className="form-field"><span className="form-label">Monthly salary (PKR)</span><input className="form-control" type="number" min="1" step="1" required value={monthlySalary} onChange={(event) => setMonthlySalary(event.target.value)} placeholder="e.g. 75,000" /></label>{dialogMode === 'employeeEdit' && <><label className="form-field full"><span className="form-label">New rate effective from</span><input className="form-control" type="date" required value={rateEffectiveFrom} onChange={(event) => setRateEffectiveFrom(event.target.value)} /><span className="field-hint">A changed salary is added to history; it does not rewrite earlier periods.</span></label><div className="salary-rate-history full"><strong>Rate history</strong>{(data.employees.find((item) => item.id === editingEmployeeId)?.salaryRates ?? []).map((rate) => <div key={rate.id}><span>{dateLabel(rate.effectiveFrom)}</span><span>{money(rate.amount)} / month</span></div>)}</div></>}
      </> : dialogMode === 'period' ? <>
        <label className="form-field full"><span className="form-label">Employee</span><select className="form-control" required value={selectedEmployee} onChange={(event) => { setSelectedEmployee(event.target.value); const employee = data.employees.find((item) => String(item.id) === event.target.value); setPeriodAmount(employee?.currentSalary ? String(employee.currentSalary) : ''); }}>{activeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.jobTitle}</option>)}</select></label>
        <label className="form-field"><span className="form-label">Period starts</span><input className="form-control" type="date" required value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
        <label className="form-field"><span className="form-label">Period ends</span><input className="form-control" type="date" required value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        <label className="form-field"><span className="form-label">Payment due date</span><input className="form-control" type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <label className="form-field"><span className="form-label">Amount due (PKR)</span><input className="form-control" type="number" min="1" step="1" value={periodAmount} onChange={(event) => setPeriodAmount(event.target.value)} placeholder="Uses current rate if blank" /></label>
      </> : <>
        <div className="salary-payment-summary full"><span>{currentPeriod?.employeeName ?? 'Salary period'}<small>{currentPeriod ? `${dateLabel(currentPeriod.periodStart)} – ${dateLabel(currentPeriod.periodEnd)} · ${money(currentPeriod.balance)} remaining` : ''}</small></span></div>
        <label className="form-field"><span className="form-label">Payment amount (PKR)</span><input className="form-control" type="number" min="1" max={currentPeriod?.balance} step="1" required value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
        <label className="form-field"><span className="form-label">Paid date</span><input className="form-control" type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
        <label className="form-field full"><span className="form-label">Paid from</span><select className="form-control" required value={paymentAccount} onChange={(event) => setPaymentAccount(event.target.value)}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label className="form-field full"><span className="form-label">Reference / note</span><input className="form-control" maxLength={1000} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Optional payment reference" /></label>
      </>}</div>{formError && <div className="form-error" role="alert">{formError}</div>}<div className="dialog-footer"><Dialog.Close asChild><button type="button" className="cancel-button" disabled={saving}>Cancel</button></Dialog.Close><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : <><Check size={14} /> {dialogMode === 'employeeEdit' ? 'Save changes' : dialogMode === 'employee' ? 'Create employee' : dialogMode === 'period' ? 'Create period' : 'Record payment'}</>}</button></div></form>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={inviteOpen} onOpenChange={setInviteOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-card"><div className="dialog-header"><div><Dialog.Title className="dialog-title">Invite a workspace member</Dialog.Title><Dialog.Description className="dialog-description">Choose the access this person needs. The invite link is only shown once.</Dialog.Description></div><Dialog.Close asChild><button className="close-button" aria-label="Close"><X size={15} /></button></Dialog.Close></div>
      {inviteLink ? <div className="invite-link-result"><div className="invite-link-icon"><Link2 size={17} /></div><strong>Invitation ready to share</strong><span>Send this private link to {inviteEmail}. It expires in seven days and can be used once.</span><label className="form-field"><span className="form-label">Invitation link</span><input className="form-control invite-url-input" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /></label><button className="primary-button invite-copy-button" onClick={copyInviteLink}><Copy size={13} /> Copy link</button><button className="link-button invite-another" onClick={() => { setInviteLink(''); setInviteEmail(''); setInviteName(''); }}>Invite another person</button></div> : <form onSubmit={createInvite}><div className="form-grid">
        <label className="form-field full"><span className="form-label">Name</span><input className="form-control" required maxLength={100} value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Invitee name" /></label>
        <label className="form-field full"><span className="form-label">Email address</span><input className="form-control" type="email" required maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="person@business.com" /></label>
        <label className="form-field full"><span className="form-label">Workspace role</span><select className="form-control" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="ADMIN">Admin · manage records, employees and salaries</option><option value="BOOKKEEPER">Bookkeeper · edit transactions and inventory</option><option value="PAYROLL">Payroll · manage employee and salary records</option><option value="VIEWER">Viewer · read dashboard and inventory</option></select></label>
      </div>{inviteError && <div className="form-error" role="alert">{inviteError}</div>}<div className="dialog-footer"><Dialog.Close asChild><button type="button" className="cancel-button" disabled={inviteSaving}>Cancel</button></Dialog.Close><button className="primary-button" type="submit" disabled={inviteSaving}>{inviteSaving ? 'Creating…' : <><UserPlus size={14} /> Create invitation</>}</button></div></form>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    {toast && <div role="status" className="toast">{toast}</div>}
  </div>;
}
