'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowRight, Briefcase, Check, ShieldCheck, UsersRound, BookOpenCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function InviteAcceptForm({ token, email, name, role, workspaceName }: { token: string; email: string; name: string; role: string; workspaceName: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const accept = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await fetch('/api/invitations/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not accept the invitation.');
      const login = await signIn('credentials', { email, password, redirect: false, redirectTo: '/' });
      if (login?.error) throw new Error('Invitation accepted. Sign in with your new account to continue.');
      router.replace(login?.url || '/'); router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not accept the invitation.'); setSaving(false);
    }
  };

  return (
    <main className="auth-screen">
      <aside className="auth-aside" aria-hidden="true">
        <a href="/" className="auth-brand" style={{ color: '#eef6ea', marginBottom: 0, position: 'relative', zIndex: 1 }}>
          <span className="brand-mark"><Briefcase size={19} strokeWidth={2.2} /></span>
          <span><strong style={{ color: '#eef6ea' }}>hisaabook</strong><small style={{ color: '#8fa889' }}>Business, in balance</small></span>
        </a>
        <div className="auth-aside-copy">
          <div className="auth-eyebrow" style={{ color: 'var(--lime)' }}>Workspace invitation</div>
          <h1>You’re invited to {workspaceName}.</h1>
          <p>{name} asked you to join as a {role.toLowerCase().replace('_', ' ')}. Accept with a password and you’ll see the same shared ledger they do.</p>
          <ul className="auth-aside-points">
            <li><Check size={15} strokeWidth={2.6} /><span>Your access level is set by the workspace owner — bookkeeper, payroll, admin or viewer.</span></li>
            <li><Check size={15} strokeWidth={2.6} /><span>Everything you record is attributed to you. Change history is preserved.</span></li>
            <li><Check size={15} strokeWidth={2.6} /><span>Salary and compensation records stay visible only to authorized roles.</span></li>
          </ul>
        </div>
        <div className="auth-aside-foot"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><UsersRound size={13} /> Shared, transparent books</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><BookOpenCheck size={13} /> Bookkeeping, not accounting advice</span></div>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <a href="/" className="auth-brand">
            <span className="brand-mark"><Briefcase size={19} strokeWidth={2.2} /></span>
            <span><strong>hisaabook</strong><small>Business, in balance</small></span>
          </a>
          <div className="auth-eyebrow">Workspace invitation</div>
          <h1 className="auth-title">Join {workspaceName}</h1>
          <p className="auth-subtitle">{name} invited you to join <strong>{workspaceName}</strong> as a <strong>{role.toLowerCase().replace('_', ' ')}</strong>. Invitation for {email}.</p>
          <form onSubmit={accept} className="auth-form">
            <div className="form-field"><Label htmlFor="password" className="form-label">Create or enter your account password</Label><Input id="password" className="h-12 rounded-xl bg-[#fcfdfb]" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" /></div>
            <p className="auth-hint" style={{ marginTop: -6 }}><Check size={12} /> If you already have a Hisaabook account, enter its current password.</p>
            {error && <div className="form-error" role="alert" style={{ marginTop: 0 }}>{error}</div>}
            <Button type="submit" className="h-12 w-full rounded-full text-[13px] font-extrabold" disabled={saving}>{saving ? 'Joining workspace…' : <>Accept invitation <ArrowRight size={15} /></>}</Button>
          </form>
          <p className="auth-security"><ShieldCheck size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />This link expires after seven days and can only be used once.</p>
        </div>
      </section>
    </main>
  );
}
