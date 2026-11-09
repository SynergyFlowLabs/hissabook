import Link from 'next/link';
import {
  ArrowRight, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Boxes,
  FileText, HandCoins, ShieldCheck, UsersRound, Wallet, PieChart, CircleCheck,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="landing-page">
      {/* Nav */}
      <header className="landing-nav">
        <Link className="landing-brand" href="/" aria-label="Hisaabook home">
          <span className="brand-mark"><img src="/logo.svg" alt="" width={38} height={38} /></span>
          <span><strong>hisaabook</strong><small>Business, in balance</small></span>
        </Link>
        <nav className="landing-nav-links" aria-label="Main navigation">
          <Link className="ghost-pill" href="/login">Sign in</Link>
          <Link className="lime-button" style={{ height: 40, fontSize: 11, padding: '0 18px', textDecoration: 'none' }} href="/setup">Set up your business <ArrowRight size={14} /></Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="landing-eyebrow"><i />SIMPLE BOOKKEEPING FOR GROWING BUSINESSES</span>
          <h1>Know where your business <span className="marker"><em className="serif-accent">stands.</em><svg viewBox="0 0 220 22" fill="none" preserveAspectRatio="none" aria-hidden="true"><path d="M4 15C58 7 152 5 216 12" stroke="#c9f24f" strokeWidth="9" strokeLinecap="round" opacity="0.95" /></svg></span></h1>
          <p className="landing-description">Cash, loans, owners, stock and team, all recorded in one shared ledger your whole business can trust. Built for Pakistani founders and the people they start with.</p>
          <div className="landing-actions">
            <Link className="lime-button" style={{ textDecoration: 'none' }} href="/setup">Set up your business <ArrowRight size={16} /></Link>
            <Link className="dark-button" style={{ textDecoration: 'none' }} href="/login">Try the demo <ArrowRight size={15} /></Link>
          </div>
          <div className="landing-note"><ShieldCheck size={15} style={{ color: 'var(--positive)' }} /> Private workspace · Owner-controlled access · PKR-native</div>
          <div className="landing-proof" aria-label="What Hisaabook tracks">
            <div><strong>One ledger</strong><span>Every entry, attributable</span></div>
            <div><strong>Cash ≠ loans</strong><span>Obligations tracked separately</span></div>
            <div><strong>Solo or shared</strong><span>Owner, bookkeeper, viewer roles</span></div>
          </div>
        </div>

        {/* Floating showcase: sample workspace */}
        <div className="showcase float-slow" aria-hidden="true">
          <div className="showcase-stage">
            <div className="showcase-glow" />
            <div className="showcase-wallet">
              <div className="hero-top">
                <span className="hero-label"><Wallet size={12} /> Safa Studio · Sample</span>
                <span className="hero-workspace" style={{ fontSize: 9 }}>PKR</span>
              </div>
              <div className="hero-amount" style={{ fontSize: 40, marginTop: 10 }}><small>PKR</small>865,420</div>
              <div className="hero-meta" style={{ marginTop: 2 }}>Total recorded balance · cleared entries</div>
              <div className="hero-chips" style={{ marginTop: 14 }}>
                <div className="hero-chip"><div className="hero-chip-label"><ArrowDownLeft size={10} /> Income · 30d</div><div className="hero-chip-value" style={{ fontSize: 14 }}>₨ 1,240,500</div></div>
                <div className="hero-chip"><div className="hero-chip-label"><ArrowUpRight size={10} /> Expenses · 30d</div><div className="hero-chip-value" style={{ fontSize: 14 }}>₨ 886,300</div></div>
              </div>
            </div>
            <div className="showcase-card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <strong style={{ fontSize: 10, letterSpacing: '-.1px' }}>Recent activity</strong>
                <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--positive)', background: 'var(--positive-soft)', padding: '3px 8px', borderRadius: 999 }}>CLEARED</span>
              </div>
              {[
                { icon: ArrowDownLeft, tone: 'income', title: 'Client invoice, Studio shoot', meta: 'Today · Bank account', amount: '+₨ 350,000', cls: 'in' },
                { icon: ArrowUpRight, tone: 'expense', title: 'Studio rent, November', meta: 'Yesterday · Bank account', amount: '−₨ 75,000', cls: '' },
                { icon: HandCoins, tone: 'expense', title: 'Loan repayment, Shah Assoc.', meta: 'Nov 3 · Cash', amount: '−₨ 40,000', cls: '' },
              ].map((row, i) => (
                <div className="showcase-row" key={i}>
                  <span className={`txn-icon ${row.tone}`} style={{ width: 36, height: 36, borderRadius: 13 }}><row.icon size={15} /></span>
                  <span style={{ minWidth: 0 }}><div className="txn-name" style={{ fontSize: 10 }}>{row.title}</div><div className="txn-sub">{row.meta}</div></span>
                  <span className={`txn-amount-value ${row.cls}`} style={{ fontSize: 10.5 }}>{row.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section" aria-label="Features">
        <span className="section-kicker">Everything in its place</span>
        <h2 className="section-title">One calm home<br />for business money.</h2>
        <div className="feature-grid">
          {[
            { icon: ArrowLeftRight, tint: 'lime', title: 'One clear ledger', copy: 'Income, expenses, owner contributions and withdrawals, transfers. All searchable, attributable, and exportable to CSV.' },
            { icon: HandCoins, tint: 'terra', title: 'Loans & dues', copy: 'Payables and receivables tracked principal-first. Record partial repayments; optional fees post separately as income or expense.' },
            { icon: PieChart, tint: 'green', title: 'Ownership, clearly recorded', copy: 'Effective-dated shares recorded as your team agrees. Contributions never masquerade as ownership.' },
            { icon: Wallet, tint: 'slate', title: 'Every account, one balance', copy: 'Cash, bank and mobile wallets. Balances derive from cleared records only, so pending never inflates your totals.' },
            { icon: Boxes, tint: 'lime', title: 'Stock & team', copy: 'Inventory movements with low-stock alerts, employee records, salary periods and part-payments, beside your money, not in separate sheets.' },
            { icon: FileText, tint: 'green', title: 'Reports & export', copy: 'A filterable ledger your accountant can actually work with, including loan repayments and who recorded what.' },
          ].map((feature, i) => (
            <div className="feature-card" key={i}>
              <span className={`feature-icon stat-icon ${feature.tint}`}><feature.icon size={18} /></span>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section" aria-label="How it works" style={{ paddingTop: 10 }}>
        <span className="section-kicker">How it works</span>
        <h2 className="section-title">Three steps to clean books.</h2>
        <div className="steps-row">
          <div className="step-item"><b>Step 1</b><strong>Set up your workspace</strong><p>Create the owner account, name your business and connect your cash, bank and wallet accounts. Five minutes, once.</p></div>
          <div className="step-item"><b>Step 2</b><strong>Record as you go</strong><p>Tap add, pick the type, enter the amount. Your bookkeeper or partner sees the same ledger, with their name on what they record.</p></div>
          <div className="step-item"><b>Step 3</b><strong>See the full picture</strong><p>Balances, dues, shares and salaries, always current, never reconstructed from notebooks at year-end.</p></div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <div className="landing-cta-inner">
          <CircleCheck size={30} style={{ color: 'var(--lime)', margin: '0 auto 14px' }} />
          <h2>Your books, in balance.</h2>
          <p>Set up the owner account in minutes. Invite your bookkeeper, your co-founder or your accountant when you’re ready.</p>
          <div className="landing-actions" style={{ justifyContent: 'center', marginTop: 0 }}>
            <Link className="lime-button" style={{ textDecoration: 'none' }} href="/setup">Create your workspace <ArrowRight size={16} /></Link>
            <Link className="ghost-pill" style={{ background: 'transparent', borderColor: '#ffffff2e', color: '#dcead8' }} href="/login">Sign in instead</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span><strong style={{ color: 'var(--ink)' }}>hisaabook</strong> · Business, in balance</span>
          <span style={{ maxWidth: 420 }}>The public demo is shared and editable. Please use sample information only. Bookkeeping reference, not legal, tax, or accounting advice.</span>
        </div>
      </footer>
    </main>
  );
}
