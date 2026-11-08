'use client';

import { CSSProperties, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowRight, Briefcase } from 'lucide-react';

const authScreenStyle: CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '28px 16px', background: 'radial-gradient(circle at 15% 18%, #e7f2e9 0, transparent 31%), radial-gradient(circle at 85% 82%, #e9efe7 0, transparent 28%), #f6f8f5' };
const authCardStyle: CSSProperties = { boxSizing: 'border-box', width: 'min(100%, 410px)', padding: 30, border: '1px solid #e8ede8', borderRadius: 18, background: '#fff', boxShadow: '0 18px 60px #203b2d12' };

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
  return <main className="auth-screen" style={authScreenStyle}><section className="auth-card" style={authCardStyle}>
    <a href="/login" className="auth-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#17241f', marginBottom: 34 }}><span className="brand-mark"><Briefcase size={19} /></span><span style={{ display: 'grid', gap: 2 }}><strong style={{ fontSize: 17, letterSpacing: '-.5px' }}>hisaabook</strong><small style={{ color: '#8b958e', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em' }}>Business, in balance</small></span></a>
    <div className="auth-eyebrow" style={{ color: '#176b50', fontSize: 9, letterSpacing: '.14em', fontWeight: 800, marginBottom: 8 }}>WORKSPACE INVITATION</div>
    <h1 className="auth-title" style={{ margin: 0, color: '#1c2c23', fontSize: 23, letterSpacing: '-.8px' }}>Join {workspaceName}</h1>
    <p className="auth-subtitle" style={{ margin: '8px 0 22px', color: '#89958d', fontSize: 11, lineHeight: 1.6 }}>{name} invited you to join <strong>{workspaceName}</strong> as a <strong>{role.toLowerCase().replace('_', ' ')}</strong>. Invitation for {email}.</p>
    <form onSubmit={accept} className="auth-form" style={{ display: 'grid', gap: 14 }}><label className="form-field" style={{ display: 'grid', gap: 6 }}><span className="form-label" style={{ color: '#58675e', fontSize: 9, fontWeight: 700 }}>Create or enter your account password</span><input className="form-control" style={{ boxSizing: 'border-box', width: '100%', height: 42, padding: '0 11px', border: '1px solid #e6ebe6', borderRadius: 8, background: '#fcfdfb', color: '#34453a', fontSize: 11 }} type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" /></label>
      <p className="auth-hint" style={{ margin: '-5px 0 0', color: '#75867a', fontSize: 9 }}>If you already have a Hisaabook account, enter its current password.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button type="submit" className="primary-button auth-submit" style={{ width: '100%', justifyContent: 'center', height: 42, marginTop: 4 }} disabled={saving}>{saving ? 'Joining workspace…' : <>Accept invitation <ArrowRight size={14} /></>}</button>
    </form>
    <p className="auth-security" style={{ margin: '17px 0 0', color: '#a0aaa3', fontSize: 8, textAlign: 'center' }}>This link expires after seven days and can only be used once.</p>
  </section></main>;
}
