import Link from 'next/link';
import { ArrowRight, BarChart3, Briefcase, CircleDollarSign, ShieldCheck, UsersRound } from 'lucide-react';
import DemoLoginCard from '@/components/demo-login-card';

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="Hisaabook home">
          <span className="brand-mark"><Briefcase size={18} /></span>
          <span><strong>hisaabook</strong><small>Business, in balance</small></span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <Link href="/login">Sign in</Link>
          <Link className="landing-nav-cta" href="/setup">Set up your business <ArrowRight size={14} /></Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <div className="landing-eyebrow"><span /> SIMPLE BOOKKEEPING FOR GROWING BUSINESSES</div>
          <h1>Know where your business stands.</h1>
          <p className="landing-description">Keep money, owners, loans, stock, and team records in one clear place—so you can focus on the work ahead.</p>
          <div className="landing-proof-points">
            <span><CircleDollarSign size={16} /> Track money in and out</span>
            <span><BarChart3 size={16} /> See the bigger picture</span>
            <span><UsersRound size={16} /> Keep your team aligned</span>
          </div>
          <div className="landing-primary-actions">
            <Link className="primary-button landing-signin" href="/login">Sign in to Hisaabook <ArrowRight size={15} /></Link>
            <span>New here? <Link href="/setup">Create your owner account</Link></span>
          </div>
          <div className="landing-privacy"><ShieldCheck size={15} /><span>Your business workspace is private. Demo records are kept separate.</span></div>
        </div>

        <div className="landing-demo-wrap">
          <div className="landing-demo-kicker">NO ACCOUNT SETUP NEEDED</div>
          <DemoLoginCard />
          <p className="landing-demo-caption">One click opens the sample workspace. No real business data is used.</p>
        </div>
      </section>

      <section className="landing-bottom" aria-label="What you can explore">
        <div><strong>One clear ledger</strong><span>Search activity and export records.</span></div>
        <div><strong>Cash, loans, and ownership</strong><span>Keep different kinds of money distinct.</span></div>
        <div><strong>Stock and team records</strong><span>See operational details alongside finances.</span></div>
      </section>
      <footer className="landing-footer">Hisaabook · Business, in balance <span>Public demo is shared and editable. Please use sample information only.</span></footer>
    </main>
  );
}
