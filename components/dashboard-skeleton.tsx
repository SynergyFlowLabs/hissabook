'use client';

import { Sk, SkLines, SkStatus } from '@/components/skeletons';

/**
 * Overview, while the books are loading.
 *
 * This replaces a full-screen "Opening your business books…" screen. That loader
 * threw away the entire layout for a second and then rebuilt it, which on a slow
 * phone reads as a broken page twice: once when it clears, once when it fills.
 * Here the real topbar and page heading stay, and the hero card and the content
 * blocks are drawn in their final positions, so the page settles rather than
 * jumps.
 *
 * The topbar is duplicated from the screen on purpose: this file is only mounted
 * while that screen has no data, so there is never a moment with two topbars.
 */
export default function DashboardSkeleton({ dateHeading }: { dateHeading: string }) {
  return (
    <div className="app-shell" id="overview">
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><strong>Overview</strong></div>
          <div className="top-actions">
            <span className="topbar-notif-slot" />
          </div>
        </header>

        <div className="content">
          <SkStatus label="Loading your business books" />

          <section className="page-heading">
            <div style={{ width: '100%' }}>
              <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />{dateHeading}</span>
              <Sk w="58%" h={30} radius={10} />
              <div style={{ marginTop: 10, maxWidth: 340 }}><SkLines count={1} /></div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Hero balance card: same footprint as the real one. */}
            <div className="hero-panel xl:col-span-7" aria-hidden="true">
              <div className="hero-top">
                <Sk w={168} h={11} dark />
                <Sk w={92} h={11} dark />
              </div>
              <Sk w="70%" h={44} dark radius={12} />
              <div style={{ marginTop: 14, maxWidth: 300 }}><Sk h={10} dark w="88%" /></div>
              <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
                <Sk w={64} h={26} dark radius={999} />
                <Sk w={64} h={26} dark radius={999} />
                <Sk w={64} h={26} dark radius={999} />
              </div>
              <div style={{ marginTop: 16 }}><Sk h={68} dark radius={14} /></div>
            </div>

            {/* The two KPI cards beside the hero on wide screens. */}
            <div className="xl:col-span-5" style={{ display: 'grid', gap: 14 }} aria-hidden="true">
              <div className="soft-card" style={{ display: 'grid', gap: 12 }}>
                <Sk w={130} h={10} />
                <Sk w="62%" h={26} radius={8} />
                <SkLines count={2} />
              </div>
              <div className="soft-card" style={{ display: 'grid', gap: 12 }}>
                <Sk w={110} h={10} />
                <Sk w="55%" h={26} radius={8} />
                <SkLines count={2} />
              </div>
            </div>
          </section>

          {/* Recent activity + quick actions. */}
          <section style={{ marginTop: 14, display: 'grid', gap: 14 }} aria-hidden="true">
            <div className="soft-card" style={{ display: 'grid', gap: 14 }}>
              <Sk w={150} h={12} />
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="sk-split">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Sk w={34} h={34} radius={11} />
                    <span className="sk-stack sk-grow">
                      <Sk w={`${64 - index * 7}%`} h={9} />
                      <Sk w={`${40 - index * 5}%`} h={8} />
                    </span>
                  </span>
                  <Sk w={72} h={11} />
                </div>
              ))}
            </div>
            <div className="soft-card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }} aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <span key={index} style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
                  <Sk w={52} h={52} radius={999} />
                  <Sk w={44} h={8} />
                </span>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
