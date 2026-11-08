import { Briefcase } from 'lucide-react';
import InviteAcceptForm from '@/components/invite-accept-form';
import { getInvitationByHash } from '@/lib/database';
import { hashInvitationToken } from '@/lib/invitation-tokens';

export const dynamic = 'force-dynamic';

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = token.length >= 32 && token.length <= 128 ? await getInvitationByHash(hashInvitationToken(token)) : undefined;
  const valid = invite && !invite.acceptedAt && !invite.revokedAt && new Date(invite.expiresAt).getTime() > Date.now();
  if (!valid || !invite) return <main className="auth-screen" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '28px 16px', background: '#f6f8f5' }}><section className="auth-card" style={{ boxSizing: 'border-box', width: 'min(100%, 410px)', padding: 30, border: '1px solid #e8ede8', borderRadius: 18, background: '#fff', boxShadow: '0 18px 60px #203b2d12' }}>
    <a href="/" className="auth-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#17241f', marginBottom: 34 }}><span className="brand-mark"><Briefcase size={19} /></span><span><strong style={{ fontSize: 17 }}>hisaabook</strong><small style={{ display: 'block', color: '#8b958e', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em' }}>Business, in balance</small></span></a>
    <div className="auth-eyebrow" style={{ color: '#176b50', fontSize: 9, letterSpacing: '.14em', fontWeight: 800, marginBottom: 8 }}>INVITATION UNAVAILABLE</div><h1 className="auth-title" style={{ margin: 0, color: '#1c2c23', fontSize: 23 }}>This link can’t be used</h1>
    <p className="auth-subtitle" style={{ margin: '8px 0 22px', color: '#89958d', fontSize: 11, lineHeight: 1.6 }}>The invitation may have expired, been revoked, or already been accepted. Ask the workspace owner for a new link.</p>
    <div className="auth-switch"><a href="/login">Go to sign in</a></div>
  </section></main>;
  return <InviteAcceptForm token={token} email={invite.email} name={invite.name} role={invite.role} workspaceName={invite.workspaceName} />;
}
