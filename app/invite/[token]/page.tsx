import Link from 'next/link';
import { Briefcase, ShieldX } from 'lucide-react';
import InviteAcceptForm from '@/components/invite-accept-form';
import { getInvitationByHash } from '@/lib/database';
import { hashInvitationToken } from '@/lib/invitation-tokens';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = token.length >= 32 && token.length <= 128 ? await getInvitationByHash(hashInvitationToken(token)) : undefined;
  const valid = invite && !invite.acceptedAt && !invite.revokedAt && new Date(invite.expiresAt).getTime() > Date.now();
  if (!valid || !invite) {
    return (
      <main className="auth-screen">
        <aside className="auth-aside" aria-hidden="true">
          <a href="/" className="auth-brand" style={{ color: '#eef6ea', marginBottom: 0, position: 'relative', zIndex: 1 }}>
            <span className="brand-mark"><Briefcase size={19} strokeWidth={2.2} /></span>
            <span><strong style={{ color: '#eef6ea' }}>hisaabook</strong><small style={{ color: '#8fa889' }}>Business, in balance</small></span>
          </a>
          <div className="auth-aside-copy">
            <div className="auth-eyebrow" style={{ color: 'var(--lime)' }}>Invitation unavailable</div>
            <h1>This link isn’t valid anymore.</h1>
            <p>Invitation links can be used once and expire after seven days. The owner can send you a fresh one in seconds.</p>
          </div>
          <div className="auth-aside-foot"><span>hisaabook · Business, in balance</span></div>
        </aside>
        <section className="auth-main">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="brand-mark" style={{ margin: '0 auto 18px' }}><ShieldX size={19} strokeWidth={2.2} /></span>
            <div className="auth-eyebrow">Invitation unavailable</div>
            <h1 className="auth-title">This link can’t be used</h1>
            <p className="auth-subtitle" style={{ marginBottom: 22 }}>The invitation may have expired, been revoked, or already been accepted. Ask the workspace owner for a new link.</p>
            <Button asChild className="h-12 w-full rounded-full text-[13px] font-extrabold"><Link href="/login">Go to sign in</Link></Button>
          </div>
        </section>
      </main>
    );
  }
  return <InviteAcceptForm token={token} email={invite.email} name={invite.name} role={invite.role} workspaceName={invite.workspaceName} />;
}
