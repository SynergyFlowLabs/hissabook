import { Sk, SkLines, SkTableRows } from '@/components/skeletons';
import Topbar from '@/components/topbar';

/**
 * The app's shape while a route's JavaScript is still arriving.
 *
 * Mounted by each authenticated route's `loading.tsx` — not at the root, because
 * a root fallback would draw this dashboard-shaped block over the marketing
 * landing page and the sign-in forms, which have nothing to do with it.
 *
 * Keeps the real topbar chrome and page-heading footprint so the transition into
 * the screen is a fill, not a re-layout.
 */
export default function AppLoading() {
  return (
    <div className="app-shell">
      <main className="main-area">
        <Topbar />
        <div className="content" aria-busy="true">
          <span className="sk-status" role="status" aria-live="polite">Loading</span>
          <section className="page-heading">
            <div style={{ width: '100%', maxWidth: 380 }}>
              <Sk w={104} h={9} />
              <div style={{ marginTop: 12 }}><Sk w="82%" h={28} radius={9} /></div>
              <div style={{ marginTop: 10 }}><SkLines count={1} /></div>
            </div>
          </section>
          <section className="sk-kpi">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="sk-card" style={{ gap: 11 }}>
                <Sk w={index % 2 ? 92 : 116} h={9} />
                <Sk w={`${56 - (index % 3) * 6}%`} h={21} radius={7} />
              </div>
            ))}
          </section>
          <section className="soft-card" style={{ marginTop: 14 }}>
            {/* Wrapped like every real table. Bare, the skeleton table's 720px
                min-width widened the page while a route was loading, which is
                exactly when the fixed bottom bar drifted off-centre: the bar was
                centred in the widened box, not the screen. */}
            <div className="data-table-wrap" style={{ marginTop: 0 }}>
              <table className="data-table"><tbody><SkTableRows rows={6} columns={5} /></tbody></table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
