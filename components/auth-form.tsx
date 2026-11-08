'use client';

import { CSSProperties, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowRight, Briefcase, Check } from 'lucide-react';
import DemoLoginCard from '@/components/demo-login-card';

const authScreenStyle: CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '28px 16px', background: 'radial-gradient(circle at 15% 18%, #e7f2e9 0, transparent 31%), radial-gradient(circle at 85% 82%, #e9efe7 0, transparent 28%), #f6f8f5' };
const authCardStyle: CSSProperties = { boxSizing: 'border-box', width: 'min(100%, 410px)', padding: 30, border: '1px solid #e8ede8', borderRadius: 18, background: '#fff', boxShadow: '0 18px 60px #203b2d12' };

export default function AuthForm({ mode }: { mode: 'login' | 'setup' }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (mode === 'setup') {
        const response = await fetch('/api/setup', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not create your account.');
      }
      const result = await signIn('credentials', { email, password, redirect: false, redirectTo: '/' });
      if (result?.error) throw new Error(mode === 'setup' ? 'Account created, but automatic sign-in failed. Go to sign in and try again.' : 'Email or password is incorrect.');
      router.replace(result?.url || '/');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return <main className="auth-screen" style={authScreenStyle}><section className="auth-card" style={authCardStyle}>
    <a href="/" className="auth-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#17241f', marginBottom: 34 }}><span className="brand-mark"><Briefcase size={19} /></span><span style={{ display: 'grid', gap: 2 }}><strong style={{ fontSize: 17, letterSpacing: '-.5px' }}>hisaabook</strong><small style={{ color: '#8b958e', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em' }}>Business, in balance</small></span></a>
    <div className="auth-eyebrow" style={{ color: '#176b50', fontSize: 9, letterSpacing: '.14em', fontWeight: 800, marginBottom: 8 }}>{mode === 'setup' ? 'FIRST-TIME SETUP' : 'YOUR BUSINESS BOOKS'}</div>
    <h1 className="auth-title" style={{ margin: 0, color: '#1c2c23', fontSize: 23, letterSpacing: '-.8px' }}>{mode === 'setup' ? 'Create your owner account' : 'Welcome back'}</h1>
    <p className="auth-subtitle" style={{ margin: '8px 0 22px', color: '#89958d', fontSize: 11, lineHeight: 1.6 }}>{mode === 'setup' ? 'Set up the first owner account for this Hisaabook workspace.' : 'Sign in to continue to your private business workspace.'}</p>
    {mode === 'login' && <div style={{ marginBottom: 18 }}><DemoLoginCard compact /></div>}
    <form onSubmit={submit} className="auth-form" style={{ display: 'grid', gap: 14 }}>
      {mode === 'setup' && <label className="form-field" style={{ display: 'grid', gap: 6 }}><span className="form-label" style={{ color: '#58675e', fontSize: 9, fontWeight: 700 }}>Your name</span><input className="form-control" style={{ boxSizing: 'border-box', width: '100%', height: 42, padding: '0 11px', border: '1px solid #e6ebe6', borderRadius: 8, background: '#fcfdfb', color: '#34453a', fontSize: 11 }} required maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Areeba Khan" /></label>}
      <label className="form-field" style={{ display: 'grid', gap: 6 }}><span className="form-label" style={{ color: '#58675e', fontSize: 9, fontWeight: 700 }}>Email address</span><input className="form-control" style={{ boxSizing: 'border-box', width: '100%', height: 42, padding: '0 11px', border: '1px solid #e6ebe6', borderRadius: 8, background: '#fcfdfb', color: '#34453a', fontSize: 11 }} type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" /></label>
      <label className="form-field" style={{ display: 'grid', gap: 6 }}><span className="form-label" style={{ color: '#58675e', fontSize: 9, fontWeight: 700 }}>Password</span><input className="form-control" style={{ boxSizing: 'border-box', width: '100%', height: 42, padding: '0 11px', border: '1px solid #e6ebe6', borderRadius: 8, background: '#fcfdfb', color: '#34453a', fontSize: 11 }} type="password" required minLength={mode === 'setup' ? 12 : 1} maxLength={128} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'setup' ? 'At least 12 characters' : 'Your password'} /></label>
      {mode === 'setup' && <p className="auth-hint" style={{ margin: '-5px 0 0', display: 'flex', alignItems: 'center', gap: 5, color: '#75867a', fontSize: 9 }}><Check size={12} /> Use 12 or more characters. Your password is stored as a salted hash.</p>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button type="submit" className="primary-button auth-submit" style={{ width: '100%', justifyContent: 'center', height: 42, marginTop: 4 }} disabled={saving}>{saving ? 'Please wait…' : mode === 'setup' ? <>Create account <ArrowRight size={14} /></> : <>Sign in <ArrowRight size={14} /></>}</button>
    </form>
    <div className="auth-switch" style={{ borderTop: '1px solid #edf0ed', marginTop: 22, paddingTop: 16, color: '#87928b', fontSize: 10, textAlign: 'center' }}>{mode === 'setup' ? <>Already set up? <a href="/login" style={{ color: '#176b50', fontWeight: 700, textDecoration: 'none' }}>Sign in</a></> : <>First time here? <a href="/setup" style={{ color: '#176b50', fontWeight: 700, textDecoration: 'none' }}>Set up the owner account</a></>}</div>
    <p className="auth-security" style={{ margin: '17px 0 0', color: '#a0aaa3', fontSize: 8, textAlign: 'center' }}>Private workspace access · Your business records aren't public</p>
  </section></main>;
}
