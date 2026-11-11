'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowRight, FlaskConical, ShieldCheck } from 'lucide-react';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo-account';
import { Button } from '@/components/ui/button';

export default function DemoLoginCard({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tryDemo = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        redirect: false,
        redirectTo: '/',
      });
      if (result?.error) throw new Error('Demo sign-in is temporarily unavailable. Please try again.');
      router.replace(result?.url || '/');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open the demo. Please try again.');
      setLoading(false);
    }
  };

  return (
    <aside className="demo-login-card" aria-label="Public demo workspace" style={compact ? { padding: 15, borderRadius: 18, boxShadow: 'none' } : undefined}>
      <div className="demo-login-heading">
        <span className="demo-login-icon"><FlaskConical size={17} /></span>
        <div><strong>Try the live demo</strong><small>Sample workspace · Safa Studio</small></div>
      </div>
      <div className="demo-login-credentials">
        <div><span>Email</span><code>{DEMO_EMAIL}</code></div>
        <div><span>Password</span><code>{DEMO_PASSWORD}</code></div>
      </div>
      {!compact && <p className="demo-login-notice">Shared and editable demo: changes are visible to other visitors. Don’t enter real information.</p>}
      {error && <div className="form-error demo-login-error" role="alert" style={{ marginTop: 11 }}>{error}</div>}
      <Button className="mt-3 h-12 w-full rounded-full text-[12px] font-extrabold" type="button" onClick={tryDemo} disabled={loading}>
        {loading ? 'Opening demo…' : <>Try demo now <ArrowRight size={15} /></>}
      </Button>
      <p className="demo-login-notice" style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 9 }}><ShieldCheck size={11} /> No sign-up. No real data.</p>
    </aside>
  );
}
