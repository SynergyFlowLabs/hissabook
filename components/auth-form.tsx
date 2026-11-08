'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowRight, Briefcase, Check, ShieldCheck, UsersRound, BookOpenCheck } from 'lucide-react';
import DemoLoginCard from '@/components/demo-login-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const asideCopy = {
  login: {
    eyebrow: 'WELCOME BACK',
    title: 'Your business books, in balance.',
    body: 'Pick up right where you left off — every balance, loan, share and salary obligation, exactly as you recorded it.',
    points: [
      'Owner-controlled access — add your bookkeeper, co-founder or accountant with the role they need.',
      'Every record shows who recorded it. No mysteries at month-end.',
      'Cash, loans and ownership tracked separately — the way your business actually works.',
    ],
  },
  setup: {
    eyebrow: 'FIRST-TIME SETUP',
    title: 'Set up your business in minutes.',
    body: 'Create the owner account, name your workspace, and start recording. You can invite your team later — start solo if you want.',
    points: [
      'Five minutes to your first entry — no credit card, no onboarding calls.',
      'Works for solo founders and informal partnerships alike.',
      'Your data stays in your private workspace. Always exportable, never locked in.',
    ],
  },
} as const;

export default function AuthForm({ mode }: { mode: 'login' | 'setup' }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const aside = asideCopy[mode];

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

  return (
    <main className="auth-screen">
      {/* Brand aside (desktop) */}
      <aside className="auth-aside" aria-hidden="true">
        <a href="/" className="auth-brand" style={{ color: '#eef6ea', marginBottom: 0, position: 'relative', zIndex: 1 }}>
          <span className="brand-mark"><Briefcase size={19} strokeWidth={2.2} /></span>
          <span><strong style={{ color: '#eef6ea' }}>hisaabook</strong><small style={{ color: '#8fa889' }}>Business, in balance</small></span>
        </a>
        <div className="auth-aside-copy">
          <div className="auth-eyebrow" style={{ color: 'var(--lime)' }}>{aside.eyebrow}</div>
          <h1>{aside.title}</h1>
          <p>{aside.body}</p>
          <ul className="auth-aside-points">
            {aside.points.map((point, i) => <li key={i}><Check size={15} strokeWidth={2.6} /><span>{point}</span></li>)}
          </ul>
        </div>
        <div className="auth-aside-foot"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><UsersRound size={13} /> Built for Pakistan-first businesses</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><BookOpenCheck size={13} /> Bookkeeping, not accounting advice</span></div>
      </aside>

      {/* Form panel */}
      <section className="auth-main">
        <div className="auth-card">
          <a href="/" className="auth-brand">
            <span className="brand-mark"><Briefcase size={19} strokeWidth={2.2} /></span>
            <span><strong>hisaabook</strong><small>Business, in balance</small></span>
          </a>
          <div className="auth-eyebrow">{mode === 'setup' ? 'First-time setup' : 'Your business books'}</div>
          <h1 className="auth-title">{mode === 'setup' ? 'Create your owner account' : 'Welcome back'}</h1>
          <p className="auth-subtitle">{mode === 'setup' ? 'Set up the first owner account for this Hisaabook workspace.' : 'Sign in to continue to your private business workspace.'}</p>
          {mode === 'login' && <div style={{ marginBottom: 18 }}><DemoLoginCard compact /></div>}
          <form onSubmit={submit} className="auth-form">
            {mode === 'setup' && (
              <div className="form-field"><Label htmlFor="name" className="form-label">Your name</Label><Input id="name" className="h-12 rounded-xl bg-[#fcfdfb]" required maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Areeba Khan" /></div>
            )}
            <div className="form-field"><Label htmlFor="email" className="form-label">Email address</Label><Input id="email" className="h-12 rounded-xl bg-[#fcfdfb]" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" /></div>
            <div className="form-field"><Label htmlFor="password" className="form-label">Password</Label><Input id="password" className="h-12 rounded-xl bg-[#fcfdfb]" type="password" required minLength={mode === 'setup' ? 12 : 1} maxLength={128} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'setup' ? 'At least 12 characters' : 'Your password'} /></div>
            {mode === 'setup' && <p className="auth-hint" style={{ marginTop: -6 }}><Check size={12} /> Use 12 or more characters. Your password is stored as a salted hash.</p>}
            {error && <div className="form-error" role="alert" style={{ marginTop: 0 }}>{error}</div>}
            <Button type="submit" className="h-12 w-full rounded-full text-[13px] font-extrabold" disabled={saving}>{saving ? 'Please wait…' : mode === 'setup' ? <>Create account <ArrowRight size={15} /></> : <>Sign in <ArrowRight size={15} /></>}</Button>
          </form>
          <div className="auth-switch">{mode === 'setup' ? <>Already set up? <a href="/login">Sign in</a></> : <>First time here? <a href="/setup">Set up the owner account</a></>}</div>
          <p className="auth-security"><ShieldCheck size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />Private workspace access · Your business records aren’t public</p>
        </div>
      </section>
    </main>
  );
}
