'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo-account';

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
    <aside className={compact ? 'demo-login-card demo-login-card-compact' : 'demo-login-card'} aria-label="Public demo workspace">
      <div className="demo-login-heading"><span className="demo-login-icon"><FlaskConical size={16} /></span><div><strong>Try the demo</strong><small>Explore a sample business workspace</small></div></div>
      <div className="demo-login-credentials">
        <div><span>Email</span><code>{DEMO_EMAIL}</code></div>
        <div><span>Password</span><code>{DEMO_PASSWORD}</code></div>
      </div>
      <p className="demo-login-notice">Shared and editable demo: changes are visible to other visitors. Don’t enter real information.</p>
      {error && <div className="form-error demo-login-error" role="alert">{error}</div>}
      <button className="primary-button demo-login-button" type="button" onClick={tryDemo} disabled={loading}>
        {loading ? 'Opening demo…' : <>Try demo now <ArrowRight size={15} /></>}
      </button>
    </aside>
  );
}
