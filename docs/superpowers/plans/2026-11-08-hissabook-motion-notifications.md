# Hisaabook — Motion, Glass, Sound & Notifications: Implementation Plan

**Date:** 2026-11-08 · **Branch:** `arena/286a1db9-hissabook` (work continues on it, not on this branch's parent) · **Status:** Plan ready for implementation, awaiting go-ahead
**Author context:** research + planning pass requested by the owner. No application code has been changed for this task yet (typography work sits uncommitted in the working tree).

---

## 0. What this is

Four coordinated upgrades to Hisaabook, researched against the live codebase and the npm registry (docs sites blocked by sandbox egress — package tarballs were used as the source of truth):

1. **Motion & micro-interactions** — physics-based animation across the authenticated app + landing (entrances, press feedback, springy count-up numbers, sliding active-nav indicator, page transitions).
2. **iOS-glass UI** — latest iPhone-style "Liquid Glass" material applied to Hisaabook's mint/lime design system (floating pill nav, sheets, dialogs, menus, toasts).
3. **Fine-tuned UI sound kit** — Web Audio-synthesized cues (no binary assets), full cinematic-but-tasteful palette, persisted mute/volume/haptics preference.
4. **Notifications, two surfaces** — an **in-app notification center** (bell + glass panel + polling) and **PWA web push** (service worker + VAPID), fed by every business mutation and by scheduled "smart reminders" (loans due, salary due, low stock, invitations expiring).

Delivery is **phased into 3 stacked PRs** (decided by owner): PR 1 foundation (motion+glass+sileo+sounds) → PR 2 in-app notification center → PR 3 web push. Each PR is independently mergeable and deployable, with `npm run build` green as the gate.

### 0.1 Owner decisions (from scoping Q&A, 2026-11-08)

| Question | Decision |
|---|---|
| Shipping strategy | **Phased PRs** — one branch, sequential PRs that each merge green |
| Notification triggers | **Everything** — core ledger events + team/collab events + smart reminders via Vercel Cron |
| Sound direction | **Full cinematic kit** (opt-out available), persisted per device |
| Push targets | **All web-push targets** incl. iOS 16.4+ installed PWA (with install-to-home-screen onboarding) |

### 0.2 Standing constraints (hard)

- **Pakistan-first**: mobile use, low bandwidth, shared devices. Animations = `transform`/`opacity` only; blur budget ≤ ~22px and ≤ 6 stacked translucent layers; no scroll-jacking; 44px touch targets; everything works with JS disabled except the interactive bits (SSR-first).
- **Accessibility**: honor `prefers-reduced-motion` (via `MotionConfig reducedMotion="user"` + CSS guards), `prefers-reduced-transparency` (glass → solid fallback), visible focus rings, aria roles/labels/live regions, keyboard operability.
- **Functionality first** (AGENTS.md): preserve `/api/*` contracts, role gating, pending-transaction balance rules. All new writes go through server-side permission checks (`requireWorkspaceMember`).
- **Dual storage engines**:
  - SQLite (dev/preview, `DATABASE_PATH`): schema lives inline in `lib/database.ts → schemaSql`, applied by `db.exec(schemaSql)` on file creation. New DDL must be added there.
  - PostgreSQL (production, Supabase, `DATABASE_URL`): runtime requests never run DDL — **schema is applied from `supabase/migrations/`**. New DDL must be added as a new timestamped migration, mirroring SERIAL-PK conventions, and applied to production separately (see §9.2).
  - `lib/database.ts → toPostgresSql()` rewrites `?`→`$N`, adds `RETURNING id` on INSERTs used with `db.run`, strips `COLLATE NOCASE`. Helper is engine-agnostic — application code stays the same.
- **Vercel account is `hobby` plan** (`hissabook` project, team `Gulzaib's projects`): Cron Jobs run **at most once per day** and only on **production** deployments → reminders ship as one daily batch (08:00). Not per-minute scheduling.
- **No external font/CDN dependencies**; assets self-hosted; network egress limited to npm/GitHub — we already learned `next/font/google`, shadcn registry, and docs sites are unreachable. All new deps must come from `registry.npmjs.org`.
- **Sileo accuracy**: its registry docs (sileo.aaryan.design) are blocked, so the API below was taken from the `sileo@0.1.6` tarball itself (`dist/index.d.ts`, `dist/styles.css`). It is young (16 public versions, latest 0.1.6, MIT). Pin exactly; contingency = revert to `sonner` (drop-in `<Toaster/>` + `toast()` API) if it misbehaves.
- **`.env*`, `data/`, `*.sqlite` never committed.** Demo account is public and printed in UI; never put real user data in it.
- Docs (`docs/*`, `AGENTS.md`, `README.md`) updated in the same PRs that change behavior — AGENTS.md requirement.

---

## 1. Outcome at a glance

| Surface | Before | After |
|---|---|---|
| Toasts | 3 hand-rolled `.toast` implementations (`dashboard.tsx`, `inventory-client.tsx`, `team-client.tsx`), one `role=status` div each, CSS keyframe, no queue, no variants | One physics-based **Sileo** toaster, brand-skinned, with success/error/warning/info/promise/action (Undo) flows, wired to a central wrapper that also plays sounds |
| Numbers | Instant paint, zero delight | Springy count-up on `.hero-amount` / `.stat-value` (and reduced-motion static fallback) |
| Motion | Zero JS animation; CSS keyframes only | Shared spring vocabulary; staggered card entrances; sliding lime pill in mobile nav; page fade; sheet/dialog polish |
| Glass | Solid mint cards + solid dark panels | iOS-style translucent glass layers (nav pill, dialog, menus, toasts, notification panel, sidebar) with specular edge + reduced-transparency fallback |
| Sounds | None | 16-cue synthesized kit, master mute + volume + haptics, persisted, preview button |
| Notifications | Header bell with a **fake** unread dot (`dashboard.tsx:243`) | Real **notification center**: unread badge, grouping, mark-read, polling, deep-links, per-kind icons; **web push** to installed PWA / browser; **daily smart reminders** via cron |

---

## 2. Reference-informed direction (how we got here)

- **Uploaded references** (user, typography round): Swiss ultra-black stat cards ("20K", "95.10%"), soft rounded mobile stat app, editorial serif+numerals. These already drove the type system (Archivo Black display / Inter body / Instrument Serif italic accents). This plan reuses that language: glass tiles with Archivo Black count-up numerals + Inter tracked-caps labels — i.e., image-6's stat cards rendered as iOS glass, with image-8's restraint.
- **iOS "Liquid Glass" (what "glassmorphism like latest iOS" means concretely)**: tinted translucent material (not plain blur), `backdrop-filter: blur() saturate()`, a 1px inner "specular" top highlight, soft multi-layer shadow with ambient occlusion, content-aware opacity (dark text on light glass, light text on deep glass), and spring-based motion. We apply it to Hisaabook's own tokens (`--deep #16241d`, lime `#c9f24f`, canvas `#e9ede7`) — not a purple-gradient Dribbble "glass" cliché, not a clone of iOS icons.
- **Toasts: Sileo** — physics-based, tiny (~8 kB), React 19-compatible (peer `>=18`), ships its own `motion` dependency (`^12.34.0`). Alternatives considered: `sonner` 2.0.8 (mature, CSS-based, less "physics" — kept as fallback), `react-hot-toast` (older animation model).
- **Motion: `motion` (ex-framer-motion)** — pin `^12.34.0` to match Sileo's dependency range so only one major line is installed (`npm i motion@^12.34.0`). Import from `motion/react`.
- **Sounds**: Web Audio API, zero assets, zero network, sub-millisecond scheduling, works on installed PWA & offline shells, trivially muteable. Alternative (Howler + committed audio files) rejected: binary weight + no tuning headroom.
- **In-app transport: polling**, not SSE/WebSockets — serverless functions on Vercel shouldn't hold long connections; a 25s visibility-aware poll + revalidate-on-focus is honest, cheap (1 small row query), and robust. Push brings the user into the app where the panel reconciles.
- **Reminders delivery**: Vercel Cron (hobby = once daily, production only) hitting a `CRON_SECRET`-guarded route handler. Not GitHub Actions / external cron (extra moving parts, secrets in two places).

---

## 3. Dependencies to add (all from registry.npmjs.org)

| Package | Version | Where | Why |
|---|---|---|---|
| `sileo` | `0.1.6` (exact) | runtime | Physics toasts |
| `motion` | `^12.34.0` | runtime | Animation primitives (`motion/react`) |
| `web-push` | `4.0.0` (exact) | runtime | Sending Web Push from route handlers / scripts |
| `@types/web-push` | latest | dev | Types |

No other deps. No `next-pwa` (unmaintained), no `use-sound` (we synth), no `@vercel/analytics` changes, no Sentry this round.

**Bundle budget:** expect +~38–45 kB gzip on the authenticated shell (motion is the bulk). Acceptable for Pakistan-first on 3G only because these surfaces are interactive anyway; if Lighthouse complains, `next/dynamic` the bell panel (noted in PR 2). Landing page does **not** take the authenticated-shell deps beyond the shared root layout (monitor First Load JS per route in build output).

---

## 4. Design tokens & glass material (globals.css)

Add to `app/globals.css` `:root` (extend, don't fork — existing `--canvas`, `--card`, `--ink`, `--lime`, `--deep`, radii, shadows stay):

```css
/* iOS-glass material */
--glass-surface: linear-gradient(165deg, rgb(255 255 255 / .78), rgb(255 255 255 / .52));
--glass-surface-deep: linear-gradient(165deg, rgb(29 47 38 / .78), rgb(18 31 24 / .68));
--glass-chip: rgb(255 255 255 / .55);
--glass-border: rgb(255 255 255 / .68);        /* specular edge on light glass */
--glass-border-deep: rgb(255 255 255 / .10);    /* edge on deep glass */
--glass-blur: blur(22px) saturate(1.7);
--glass-shadow: 0 18px 48px rgb(13 26 19 / .28), inset 0 1px 0 rgb(255 255 255 / .65);
--glass-shadow-deep: 0 22px 60px rgb(6 12 9 / .45), inset 0 1px 0 rgb(255 255 255 / .12);
--lime-glow: 0 0 0 1px rgb(201 242 79 / .45), 0 8px 28px rgb(201 242 79 / .22);
```

Component classes (one set, used everywhere — no per-page glass inventions):

- `.glass` — light frosted card/menu surface (dialogs, dropdowns, notification panel on desktop).
- `.glass-deep` — deep frosted surface (mobile pill nav, mobile sheet headers, toast skin).
- `.glass-chip` — small floating pills/badges.
- `.glass-tile` — stat tiles (Archivo Black numerals, subtle top specular).
- `.glass-nav` — extends the existing `.mobile-nav` rule; becomes the reference iOS-glass bar.
- Focus-visible ring: keep existing lime ring; on glass, add `box-shadow: var(--glass-shadow), 0 0 0 2px var(--lime)`.

Fallbacks & guards:

```css
@supports not (backdrop-filter: blur(1px)) { /* solid rgba fallbacks, opacity .96 */ }
@media (prefers-reduced-transparency: reduce) { .glass,.glass-deep,… { backdrop-filter:none; background: solid tokens } }
@media (prefers-reduced-motion: reduce) { /* transitions→none; count-ups snap (handled in JS too) */ }
```

Layering budget: `.mobile-nav` (deep) over content (solid) is 1 translucent layer; dialog over scrim adds 2; panel adds 1–2. Never stack glass on glass on glass. `contain: paint` on panels; `will-change` only during animation frames (motion handles this correctly by default).

---

## 5. PR 1 — Foundation: glass + motion + sileo + sound kit

**Scope:** zero server-side changes. Everything here is presentation + one small shared client lib. Merge order first.

### 5.1 Dependencies & layout wiring

- `npm i sileo@0.1.6 motion@^12.34.0 web-push@4.0.0 && npm i -D @types/web-push` (web-push used in PR 3; installing now keeps one reviewer-visible install).
- `app/layout.tsx`:
  ```tsx
  import './globals.css';
  import 'sileo/styles.css';              // AFTER globals so our overrides win
  …
  <body>
    <MotionProvider>                       // 'use client' wrapper (below)
      {children}
      <Toaster position="top-center" theme="light" offset={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
               options={{ fill: '#12241b', roundness: 18, autopilot: { expand: 800, collapse: 140 } }} />
      <PwaRegister />                      // PR 3 (no-op until then / guard inside)
    </MotionProvider>
  </body>
  ```
- `components/motion-provider.tsx` (`'use client'`): `<MotionConfig reducedMotion="user">{children}</MotionConfig>`.
- Sileo skinning (verified against `dist/styles.css`): override CSS vars in globals — `--sileo-state-success: #c9f24f; --sileo-state-error: #ff9a76; --sileo-state-warning: #ffd166; --sileo-state-info: #8fd6ff; --sileo-width: min(92vw, 380px); --sileo-height: auto; --sileo-duration: 560ms;` plus `[data-sileo-toast]` overrides: rounded deep fill comes from `fill` option; add `backdrop-filter: blur(18px) saturate(1.6); border: 1px solid rgb(255 255 255 / .10); box-shadow: var(--glass-shadow-deep);` and `[data-sileo-description]`/`[data-sileo-title]` color overrides to the brand palette. Toast body text stays Inter; the **typeface of toast titles** is Inter 600 (toasts are UI chrome, not display type — Archivo Black there would shout).

### 5.2 Glass application points (exact files)

| File | Element | Change |
|---|---|---|
| `app/globals.css` | `.mobile-nav`, `.card`, `.dialog-content?` (via overrides), `.dropdown-menu` etc. | New tokens (§4); `.mobile-nav` → deep glass bar w/ 1px specular top border; `.card` → 1px top specular shadow; add `.glass*`; delete `.toast` + `@keyframes toast-in`; add sileo overrides |
| `components/app-sidebar.tsx` | Nav shell + mobile bar | `.glass-nav` on the floating pill; `<motion.span layoutId="nav-active-pill">` lime indicator sliding between icons (spring `stiffness: 420, damping: 34`); icon pop (`y:-2`) on active; desktop sidebar → subtle `.glass` tint over canvas |
| `components/ui/dialog.tsx` | DialogContent | className merge to `.glass` (keeps max-h + scroll from PR #9); scrim gets `backdrop-filter: blur(6px)` (cheap, one layer) |
| `components/ui/dropdown-menu.tsx`, `select.tsx`, `popover`-like panels | Panels | `.glass` + tighter radii; keep item semantics untouched |
| `components/ui/button.tsx` | Base cva | add `transition-transform duration-150 ease-out active:scale-[0.97]` (transform-only; GPU-cheap; no API change) |
| `components/landing-page.tsx` | Hero stat tiles, nav | `.glass` tiles; hero count-up ships on landing too (it's the same component family) |
| `app/dashboard.tsx` | Stat cards | `.glass-tile` + count-up numerals |

### 5.3 Motion system (`motion/react`)

**Shared vocabulary** (`lib/motion.ts`): springs `{ soft: { stiffness: 260, damping: 30 }, snappy: { stiffness: 380, damping: 32 }, bouncy: { stiffness: 420, damping: 22 } }`; `y: 12px` entrances with `opacity`; stagger `0.06s` capped at 6 children; viewport `once: true, margin: '-10% 0px'`.

| # | Interaction | Implementation | Files |
|---|---|---|---|
| 1 | Card/section entrances | `<motion.section variants={stagger}>` fade+rise, `reducedMotion` aware | dashboard, transactions-client, inventory-client, team-client, landing |
| 2 | Count-up numerals | `useSpring(0 → value, { stiffness: 120, damping: 24 })` + `useTransform` → `Math.round` → `<motion.span>{rounded}</motion.span>`; render ₨ via existing `formatPKR`; SSR renders final value, client spring animates on mount; skipped under reduced motion | `lib/use-animated-number.ts`; consumed in `.hero-amount`, `.stat-value`, `.showcase-mini-amount`, landing hero |
| 3 | Mobile nav indicator | `layoutId` lime pill + icon spring | `components/app-sidebar.tsx` |
| 4 | Page transitions | `app/template.tsx`: 240ms fade + `y: 8px`, reduced-motion no-op | new file |
| 5 | Press/hover | Button `active:scale` (§5.2); card `whileHover={{ y: -2 }}` only on `$pointer: fine`; icon buttons `whileTap={{ scale: 0.92 }}` | ui/button, cards |
| 6 | Dialog/sheet polish | Keep Radix + tw-animate-css keyframe entry (already shipped); add `layout` on close icon rotation; **no double systems** — Radix owns focus, motion owns visuals | ui/dialog |
| 7 | Toast enter/exit | Sileo built-in physics | — |
| 8 | Skeleton shimmer | Existing `.skeleton` gains a 1.6s sweep gradient (CSS-only) | globals.css |
| 9 | Empty states | Fade+scale-in icon, copy stagger | dashboard/inventory/team empty blocks |
| 10 | Focus-visible rings | canvas→lime offset ring on glass | globals.css |

Explicit non-goals for PR 1: no drag-to-dismiss sheets yet (PR 2's notification sheet introduces `drag="y"`), no confetti, no parallax, no scroll-linked motion (Pakistan-first low-end phones; also avoids fighting `content-visibility`).

### 5.4 Sound engine (`lib/sounds/`)

**`lib/sounds/engine.ts` (~260 LOC)** — `SoundEngine` singleton:

- `AudioContext` created lazily on first `pointerdown`/`keydown` (autoplay policy); `resume()` on visibilitychange if suspended.
- Master chain: `GainNode (volume) → DynamicsCompressorNode (threshold -18 dB, ratio 6, knee 12) → destination`. Per-cue gains pre-tamed to −12…−22 dBFS — never clips on phone speakers.
- State: `{ enabled: true, volume: 0.55 (0|1|2 → 0.28|0.55|0.85), haptics: true }` persisted to `localStorage['hissabook:sound:v1']`; cross-tab sync via `storage` event; `data-sound="off"` stamped on `<html>` so CSS can kill non-essential transitions if desired.
- `prefers-reduced-motion` is **not** treated as a sound mute (separate senses); but if `enabled` is false everything early-returns before any node is created.

**`lib/sounds/cues.ts`** — the full cinematic kit (synth recipes, no assets):

| Cue | Recipe (freq, osc, envelope) | Use |
|---|---|---|
| `tap` | 1.8 kHz square, 2 ms, lpf 4 kHz, −18 dB, 40 ms decay | generic small buttons |
| `toggleOn` / `toggleOff` | 620→940 Hz / 940→620 Hz sine glide, 90 ms | switches, filters |
| `open` / `close` | bandpassed noise sweep 320→1400 / reverse, 170 ms | dialogs, panels, sheets |
| `success` | C5 523.25 → G5 783.99 triangle pair, 45 ms attack, 380 ms decay + 3rd-harmonic shimmer at −20 dB | saves, approvals |
| `error` | F3 174.6 + E3 164.8 sine thud, 90 ms attack, 480 ms decay (not harsh) | validation, failed saves |
| `warning` | G4 392 ×2 triangle pulses, 120 ms apart | destructive confirmations |
| `info` | single A5 880 sine, 120 ms | neutral notices |
| `toastPop` | 880 Hz blip + 1760 Hz partial, 110 ms | sileo appears |
| `notify` | B5 987.8 → E6 1318.5 sine doorbell, staggered 140 ms, sparkle partial 3.9 kHz −22 dB | new unread arrival while focused |
| `ledger` | cash-register two-hit: inharmonic partials [1, 2.51, 4.18, 5.43] × G6 1568, second hit at +55 ms lower, −14 dB | "Saved to ledger" payoff |
| `swoosh` | lpf noise ramp 400→1800, 220 ms | navigation, drawers |
| `shimmer` | fast arpeggio E6→A6→C#7→E7 sine cluster, −20 dB | setup complete, invite accepted |
| `undo` | E4 330 → B3 247 descending, 160 ms | undo action |
| `reminder` | E5 659 triangle ×2, soft | cron reminder lands while focused |
| `salaryPaid` | success + ledger combined two-stage | salary payment confirmed |
| `invite` | shimmer + notify hybrid | invitation sent/accepted |

**`lib/sounds/index.ts`** — typed facade: `sounds.success()`, `.error()`, … each safe to call server-side imported (no-op if `typeof window === 'undefined'`).
**`components/sound-control.tsx`** — compact speaker control (icon animates slash on mute). Mounted in the sidebar footer (desktop) and in the notification panel footer (mobile). Popover: master toggle, 3-step volume segmented control (Low/Medium/Full), haptics toggle, "Preview" button (plays `success`), and a one-line note. All persisted instantly.

**Haptics** (`lib/haptics.ts`): `success: [12,40,12]`, `error: [70,50,70]`, `notify: [25]`, `undo: [10]`; only where `navigator.vibrate` exists (Android; iOS Safari silently no-ops); gated by the same `haptics` flag.

**Seams**: components call `sounds.*` directly for UI chrome (dialog open, tap); all *data-mutation outcomes* flow through the central toast wrapper (§5.5) which plays the cue automatically — no duplicated call sites.

### 5.5 Sileo wiring & migration of existing toasts

**`lib/toast.ts`** (client): thin brand wrapper:

```ts
import { sileo } from 'sileo';
import { sounds } from '@/lib/sounds';
export const toast = {
  success: (title, description?, opts?) => { sounds.success(); return sileo.success({ title, description, ...opts }); },
  error:   (…) => { sounds.error(); return sileo.error(…); },
  warning, info(…plays info),
  withUndo: (title, onUndo, description?) => sileo.action({ title, description, button: { title: 'Undo', onClick: onUndo } }) + sounds.undo(),
  promise: (p, msgs) => sileo.promise(p, msgs),  // loading→success/error morph
};
```

**Call-site migration (exactly these):**

| File | Sites | Notes |
|---|---|---|
| `app/dashboard.tsx` | 6 `showToast` + `.toast` render + static red dot on bell | Replace with `toast.*`; remove `toast` state & `.toast` markup; remove fake dot (real badge arrives PR 2); save flows → `toast.promise` |
| `app/inventory/inventory-client.tsx` | `showToast` ×7 + timeout | As above; archive → `toast.withUndo('Item archived…', () => reactivate(...))` **if** `[id]` route supports reactivate (verify; else keep success toast — §9.4) |
| `app/team/team-client.tsx` | `showToast` ×4 + timeout | Same; employee archive → Undo (reactivate already supported) |
| `app/transactions/transactions-client.tsx` | **no feedback today** | Add `toast.promise` on create/update — parity fix |
| `components/auth-form.tsx`, `invite-accept-form.tsx` | inline error text | Keep inline text (form context) **and** `toast.error` for network failures |
| `components/demo-login-card.tsx` | — | subtle `sounds.tap` on demo-fill tap |

Grep gate at the end of PR 1: `git grep -n "showToast\|\.toast\"" → zero hits (except the removed CSS comment).

---

## 6. PR 2 — In-app notification center (DB + API + bell + triggers + cron)

### 6.1 Schema (dual-engine)

**SQLite** (`lib/database.ts → schemaSql`, appended before the indexes block):

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('transaction','loan','inventory','salary','member','invitation','reminder')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '/',
  dedupe_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id)
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS notifications_workspace_idx ON notifications(workspace_id, id DESC);
CREATE INDEX IF NOT EXISTS notifications_kind_idx ON notifications(workspace_id, kind, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_reads_user_idx ON notification_reads(user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_workspace_idx ON push_subscriptions(workspace_id, user_id);
```

**PostgreSQL** (new `supabase/migrations/20261109090000_notifications.sql`): identical semantics with `SERIAL PRIMARY KEY`, `CURRENT_TIMESTAMP::text` defaults, same partial unique index + indexes, `REFERENCES … ON DELETE CASCADE`; **no RLS policies needed beyond what exists** if the app connects as a privileged role (it does — same as every other table) but the migration must *enable RLS or document the exemption exactly like the initial migration does* — mirror whatever that file does; if none, note "app-layer authorization enforced; tables unreachable from anon role; DATABASE_URL is service-level" in the migration header comment.

**Design choices (deliberate):**

- **Broadcast model**: one `notifications` row per business event, read-state per user in `notification_reads`. Unread count = `(rows for workspace) − (reads for me)`. Avoids fan-out writes; N members cost 0 extra inserts; new members joining later see full history (desired for a shared ledger).
- **`actor_user_id`** powers "Ayesha recorded ₨ 85,000 income" attribution — matches the "attributable ledger" product north star. `actor_name` resolved via join to `users.display_name` at read time (no denormalized copy to go stale).
- **`dedupe_key`** (nullable, unique partial) is the cron/idempotency guard: `loan:{loanId}:{yyyy-mm-dd}`, `salary:{periodId}:{yyyy-mm-dd}`, `stock:{itemId}:{yyyy-mm-dd}`, `invite:{invitationId}:{yyyy-mm-dd}`. Cron re-runs are free.
- **No TTL/cleanup job in v1** — a `DELETE … WHERE created_at < now() - interval '180 days'` line ships inside the cron route (cheap, one statement) so the table can't grow unbounded.

### 6.2 `lib/notifications.ts` (server-only)

```ts
type NotificationKind = 'transaction'|'loan'|'inventory'|'salary'|'member'|'invitation'|'reminder';
createWorkspaceNotification({ workspaceId, actorUserId?, kind, title, body?, href?, dedupeKey? }):
  Promise<{ id: number } | null>   // null when dedupe swallowed it
  — INSERT (dual-engine via `db`); dedupe via try on unique index / ON CONFLICT DO NOTHING semantics:
    sqlite: INSERT OR IGNORE …; postgres: same statement with ON CONFLICT DO NOTHING appended by helper? 
    → simplest: pre-check SELECT id WHERE dedupe_key = ? (same tx) — race-safe enough with unique index as backstop + try/catch → null.
  — fire-and-forget push fan-out (PR 3): `sendWorkspacePush(...).catch(log)` — NEVER throws into mutation path; total added latency ≤ 1 sqlite insert (~sub-ms).
listNotifications({ workspaceId, userId, cursor?, limit = 20 }):
  { items: Array<{ id, kind, title, body, href, created_at, read, actor_name | null }>, unreadCount, nextCursor | null }
  — SELECT n.*, (r.user_id IS NOT NULL) AS read, u.display_name AS actor_name
    FROM notifications n LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
    LEFT JOIN users u ON u.id = n.actor_user_id
    WHERE n.workspace_id = ? [AND n.id < ?] ORDER BY n.id DESC LIMIT ?
markNotificationRead({ notificationId, workspaceId, userId })  // upsert read
markAllRead({ workspaceId, userId })                           // INSERT … SELECT with NOT EXISTS
getUnreadCount({ workspaceId, userId })                        // for badge/SSR seed
```

### 6.3 API routes (all: `requireWorkspaceMember` any-role; errors never leak internals)

| Route | Method | Behavior |
|---|---|---|
| `app/api/notifications/route.ts` | GET | `?cursor&limit=20` → `{ items, unreadCount, nextCursor }` |
| `app/api/notifications/[id]/read/route.ts` | POST | mark one read (verified belongs to caller's workspace) → `{ ok, unreadCount }` |
| `app/api/notifications/read-all/route.ts` | POST | mark all read → `{ ok }` |
| (PR 3) `app/api/push/config/route.ts` | GET | `{ configured: boolean, publicKey?: string }` (no auth required beyond membership; public key is public) |
| (PR 3) `app/api/push/subscribe/route.ts` | POST | upsert `push_subscriptions` by `endpoint` (`ON CONFLICT(endpoint) DO UPDATE last_seen_at`) — body `{ endpoint, keys: { p256dh, auth }, userAgent? }`; validates shape + length caps; **stores only what web-push needs** |
| (PR 3) `app/api/push/unsubscribe/route.ts` | POST | delete by `endpoint` (must belong to caller) |
| `app/api/cron/reminders/route.ts` | GET | `Authorization: Bearer ${CRON_SECRET}` else 401; `CRON_SECRET` unset → 503 (fail-closed). Runs the 4 reminder queries (§6.5) + retention purge; returns `{ ranAt, created: n }` |

### 6.4 Notification triggers (wired into existing handlers — post-commit, non-blocking)

Every call site: after the DB mutation succeeds, inside `try { await createWorkspaceNotification({...}) } catch (err) { console.error('notify failed', err) }` — **a failing notifier can never fail a save.**

| Route handler | Event | Kind | Copy (title → body) | href |
|---|---|---|---|---|
| `app/api/transactions/route.ts` POST | Transaction recorded (income/expense/contribution/withdrawal) | `transaction` | `\${typeLabel} recorded` → `₨ x · description` | `/transactions` |
| same, when `type` is `LOAN_RECEIVED`/`LOAN_GIVEN` | Loan transaction | `loan` | `Loan recorded` → `₨ x · counterparty` | `/` |
| `app/api/transactions/route.ts` PATCH/status change (if present — verify §9.3) | Cleared/VOID | `transaction` | `Transaction cleared` / `Transaction voided` → description | `/transactions` |
| `app/api/loans/[id]/repayments/route.ts` POST | Repayment/collection | `loan` | `Loan repayment recorded` → `₨ x paid · outstanding ₨ y → z` | `/` |
| `app/api/inventory/movements/route.ts` POST | Stock movement | `inventory` | `Stock \${in/out}` → `name ±qty unit` | `/inventory` |
| same + reorder check (below) | Crosses reorder level | `reminder` | `Low stock: {name}` → `{n} {unit} left · reorder at {m}` (dedupe `stock:{id}:{day}`) | `/inventory` |
| `app/api/inventory/items/route.ts` POST / `[id]` PATCH | Item added / archived / reactivated | `inventory` | `Item \${added/archived/reactivated}` → `name` | `/inventory` |
| `app/api/team/salary-periods/route.ts` POST | Salary period created | `salary` | `Salary period created` → `name · ₨ x due {date}` | `/team` |
| `app/api/team/salary-periods/[id]/payments/route.ts` POST | Salary paid | `salary` | `Salary paid` → `name · ₨ x` | `/team` |
| `app/api/team/employees/route.ts` POST / `[id]` PATCH | Employee added / archived / reactivated | `salary` | same verbs | `/team` |
| `app/api/workspace/members/route.ts` POST | Invitation sent | `invitation` | `Invitation sent` → `email · role` | `/` |
| `app/api/workspace/invitations/[id]/route.ts` DELETE | Invitation revoked | `invitation` | `Invitation revoked` → `email` | `/` |
| `app/api/invitations/accept/route.ts` POST | Member joined | `member` | `{name} joined` → `Accepted invitation · role` | `/` |
| `app/api/workspace/members/[id]/route.ts` PATCH | Role changed / deactivated | `member` | `Member updated` → `name · newRole/deactivated` | `/` |

Transaction creation also bumps a **`ledger` sound** (§5.4) — the cash-register cue is the emotional payoff of saving.

**Attribution:** `actor_user_id` always set for user-initiated events (from session); cron reminders set `actor_user_id = NULL` and render as "Hisaabook · Reminder".

### 6.5 `app/api/cron/reminders/route.ts` — daily smart reminders

Guard: bearer `CRON_SECRET`; vercel.json (production only on hobby):

```json
{ "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }] }
```

Per workspace, four queries (all dedupe-keyed, all `INSERT … SELECT … WHERE NOT EXISTS` via the unique index — re-runnable):

1. **Loans due**: `outstanding > 0 AND due_at BETWEEN today AND today+3` → overdue included (`due_at < today`) → title `Loan \${due/overdue}` body `₨ x · counterparty · due {date}` kind `reminder`, dedupe `loan:{id}:{yyyy-mm-dd}`.
2. **Salary due**: `salary_periods.due_date BETWEEN today AND today+3 AND NOT EXISTS (SELECT 1 FROM salary_payments WHERE salary_period_id = sp.id)` → title `Salary due soon`, body `name · ₨ x · due {date}`, dedupe `salary:{id}:{day}`.
3. **Low stock**: `SUM(inventory_movements.quantity_delta) < reorder_level AND reorder_level > 0 AND items.active = 1` → `Low stock: name`, dedupe `stock:{id}:{day}`.
4. **Invitations expiring**: `workspace_invitations.expires_at BETWEEN now AND now+24h AND accepted_at IS NULL AND revoked_at IS NULL` → `Invitation expiring`, dedupe `invite:{id}:{day}`.

Plus retention: `DELETE FROM notifications WHERE created_at < datetime('now','-180 days')`.

**Hobby-plan note (documented in PR):** one run/day, production deployments only — reminders are a morning briefing, not real-time; real-time fan-out happens via write-path triggers.

### 6.6 Bell + panel UI

**`components/notification-bell.tsx`** (client) — replaces the static bell.

- Mount points: `components/app-sidebar.tsx` renders it in the sidebar header area on desktop, and as a fixed **top-right floating glass circle** on mobile (`position: fixed; top: calc(env(safe-area-inset-top) + 10px); right: 12px; z-index: 60`) — visible on every authenticated page including landing-less routes; not rendered on auth/landing pages (component only mounted from the shell).
- Badge: lime dot w/ count, `max 9+`, `motion` scale-spring pop when count changes; `aria-label="Notifications, N unread"`; focus-visible ring.
- **Panel** `components/notification-panel.tsx` — one component, two breakpoints:
  - Desktop (`min-width: 901px`): anchored glass dropdown, `width: min(92vw, 384px)`, `max-height: 72dvh`, spring `scale .92→1 + y 8→0` entrance; arrow key navigation, `Esc` closes, focus returns to bell, `Home/End` jump.
  - Mobile (`< 901px`): bottom sheet — `drag="y"`, `dragConstraints={{ top: 0, bottom: 0 }}`, `dragElastic={{ top: 0, bottom: 0.6 }}`, dismiss on offset > 120px or velocity > 500; scrim tap closes; focus trapped; `role="dialog" aria-modal`.
  - Header: `Notifications` + `Mark all read` (text button, disabled at 0 unread, spinner while in flight) + close (mobile).
  - Groups: **Today** / **Earlier** (by `created_at` day boundary, `en-PK`); items: kind icon in lime-tinted 40px circle (`ReceiptText, HandCoins, Boxes, Banknote, UsersRound, MailPlus, AlarmClockCheck`), title (Inter 600, 13px), body (12px, muted), right time-ago (`Intl.RelativeTimeFormat('en', { numeric: 'auto' })`), unread item = lime 2px left rail + `rgb(201 242 79 / .06)` wash.
  - Click item → optimistic mark-read + `router.push(href)`; if `href === '/'` scroll handled by route.
  - Footer row: compact **sound toggle** (§5.4) + **"Enable device alerts"** button (PR 3; hidden entirely when push unconfigured/unsupported) + subtle `Hisaabook · attributable ledger` caption.
  - Empty state: lime ring + `CheckCheck` icon, "You're all caught up." + secondary line.
- **Data flow**: `useEffect` fetch on mount → `useState` items+unread; poll every **25 s** only while `document.visibilityState === 'visible'`; immediate revalidate on `focus`/`visibilitychange`; `AbortController` cleanup; **unread increase while panel closed → `sileo.info + sounds.notify()`** (suppressed on the very first fetch to avoid chime-on-open); while panel open, new items animate in via `AnimatePresence`.
- No SWR dependency — hand-rolled hook (`lib/use-notifications.ts`) keeps bundle flat; ~80 LOC, fully typed.
- SSR: badge count seed passed from server? Simpler: starts empty, fills on mount (badge pop animates anyway). No layout shift (bell fixed size).

### 6.7 Permissions & failure modes

- Any active member can read/mark; nobody can delete rows (moderation-free by design). Role gating for *content visibility* is inherited from the ledger itself — notifications are metadata only, same visibility class as what the member can already see in `/transactions`.
- Notifier failure ⇒ logged, user unaffected (write path already committed).
- Cron misfire ⇒ dedupe keys prevent double-notify; next run heals.
- DB outage in prod ⇒ notification GET 500 ⇒ bell hides badge (fail-silent), ledger unaffected.

---

## 7. PR 3 — Web push to installed PWA & browsers

### 7.1 VAPID key setup (one-time, per environment)

```
npx web-push generate-vapid-keys
```

| Env var | Visibility | Where |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public (safe to expose) | Vercel (all targets, plain) + `.env.local` + `.env.example` |
| `VAPID_PRIVATE_KEY` | **secret** | Vercel (all targets, **sensitive**, never committed) + `.env.local` + `.env.example` placeholder |
| `VAPID_SUBJECT` | public | `https://hissabook-eta.vercel.app` (URL form allowed by spec; avoids inventing an email address) |
| `CRON_SECRET` | secret | Vercel (production, sensitive) + `.env.local` + `.env.example` |

Vercel env changes are applied via the Vercel connector / project settings during PR 3; production gets its private key **without** the value ever entering the repo or chat.

### 7.2 Service worker `public/sw.js`

Deliberately **push-only** in v1 (no offline caching — noted as future work; caching an authed app shell is its own correctness project):

```js
// public/sw.js — push-only worker
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: 'Hisaabook', body: event.data?.text() ?? 'New activity' }; }
  event.waitUntil(self.registration.showNotification(data.title ?? 'Hisaabook', {
    body: data.body ?? '', icon: '/icons/icon-192.png', badge: '/icons/badge-96.png',
    tag: data.tag ?? data.kind ?? 'hissabook', data: { href: data.href ?? '/' },
    vibrate: [100, 40, 100], renotify: Boolean(data.renotify),
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = event.notification.data?.href ?? '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) { if ('focus' in client) { client.navigate(href); return client.focus(); } }
    return self.clients.openWindow(href);
  })());
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
```

New asset: `public/icons/badge-96.png` — 96×96 monochrome silhouette (lime knocked out on transparent) regenerated from `app/icon.png` via the existing PIL pipeline (Android status-bar badge is alpha-only).

`components/pwa-register.tsx` (`'use client'`): registers `/sw.js` on mount (production and dev — push-only SW is harmless), reload prompt **not** needed in v1. Mounted from `MotionProvider` tree.

### 7.3 Client subscription UX (inside panel footer + first-save priming)

`components/push-enroll.tsx`:

- Capability probe: `'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window` → else show "not supported" line, nothing else.
- **iPhone/iPad gate**: `isIOS && !(matchMedia('(display-mode: standalone)').matches || navigator.standalone)` → replace CTA with **"Install Hisaabook"** sheet: 3 steps (Share → Add to Home Screen → open from the new icon), note "iOS 16.4+ · notifications work once installed"; `display-mode` listener flips it to the real CTA live.
- Otherwise: "Enable device alerts" button → user gesture → `Notification.requestPermission()` → if granted:
  `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(NEXT_PUBLIC_VAPID_PUBLIC_KEY) })` → POST `/api/push/subscribe` → success state ("Alerts on · this device") + `sounds.shimmer()` + fire a **confirmation push to the device itself** ("Hisaabook — you're set. Reminders and ledger activity will land here.").
- `denied` → static hint to re-allow in browser site settings (no nagging loop). Existing subscription detected on mount via `getSubscription()` → toggle renders "Disable" (unsubscribe + DELETE).
- **Priming, not ambush**: permission is ALSO requested situationally right after the *first successful ledger save* in a session (one-time, dismissible, `localStorage['hissabook:push-primed']`) — the highest-intent moment, aligned with Pakistan-first low-friction expectations.

### 7.4 Server send path `lib/push.ts`

- `webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)` at module init; missing env ⇒ `pushEnabled=false`, one-time warn, all sends no-op (local dev without keys just skips).
- `sendWorkspacePush(workspaceId, payload)`: `SELECT … FROM push_subscriptions WHERE workspace_id = ?` (already membership-verified world) → `sendNotification(sub, JSON.stringify(payload), { TTL: 86400, urgency: 'normal', topic: payload.dedupeKey?.slice(0,32) })` (topic collapses reminders on the wire for 28-day TTL windows — nice with daily cron).
- **Dead-letter cleanup**: HTTP 404/410 ⇒ `DELETE` that row; other errors ⇒ logged, row kept, `last_seen_at` untouched; never throws.
- Payload: `{ title, body, href, kind, tag: dedupeKey ?? `kind:id` }`.
- Called from `createWorkspaceNotification` **after** insert resolves, awaited but fully try/caught (Hobby function timeout 300s is irrelevant — send is ~50 ms × N devices).

### 7.5 Test tooling & release checklist

- `scripts/send-test-push.mjs` — node ESM; loads env, reads `DATABASE_PATH` sqlite (or `DATABASE_URL` via `postgres`), sends a test notification to every subscription (or `--endpoint` one) — used for local QA and a one-shot production sanity check; documented in `docs/push-notifications.md` (new).
- Release checklist (per environment): VAPID vars present → `npm run build` green → install/enable on desktop Chrome + Android Chrome + installed iOS PWA → verify deny-path copy, disable path, dead-endpoint cleanup (subscribe, revoke via DevTools, send, row deleted).
- Rollback: remove `vercel.json` cron + unset `NEXT_PUBLIC_VAPID_PUBLIC_KEY` hides UI; worker stays inert (no fetch handler); rows harmless.

---

## 8. Vercel Cron config (`vercel.json`, repo root — new file)

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }] }
```

Hobby: deploys to production get the schedule; preview deploys don't run crons (acceptable). Note: project `crons` block currently `enabledAt` set with `definitions: []` — this fills it.

---

## 9. Risks, open items & how they're resolved

| # | Item | Resolution path |
|---|---|---|
| 9.1 | **Production DDL** — runtime never applies migrations | New `supabase/migrations/*.sql` applied manually to Supabase (SQL editor or `psql "$DATABASE_URL" -f …`) **before** the code deploys; `CREATE TABLE IF NOT EXISTS` ⇒ safe, additive, no data touched. Performed at PR 2 time with the user present/aware; documented in PR body |
| 9.2 | Existing migration file conventions (SERIAL/text-timestamps, collation handling) | Mirror exactly (checked: `INTEGER PRIMARY KEY AUTOINCREMENT` is SQLite-only and must not appear in the migration) |
| 9.3 | **Transactions PATCH?** — grep showed only GET/POST in `app/api/transactions/route.ts`. VOID/cleared flow may be elsewhere (or absent) | During PR 2 trigger pass, locate any status-mutation endpoint (search `status = 'VOID'` in repo); if none, drop that trigger row and note it |
| 9.4 | Inventory reactivate support for **Undo** button | `[id]` PATCH semantics verified in implementation; if reactivate is unsupported, PR 1 ships Undo only for team employees (supported) and inventory gets plain success toast; follow-up micro-PR can add `reactivate` |
| 9.5 | Sileo skinning depth | `dist/styles.css` uses attribute selectors + CSS vars (confirmed) — override vars + 3 attribute rules; if a hook is missing, `fill`/`roundness` options still deliver the brand look; worst case fall back to sonner (§0.2) |
| 9.6 | Bundle size on landing | Monitor build output; landing imports only layout-level providers; if landing First Load regresses > 15 kB, move `PWA register` + Toaster to authenticated shell only |
| 9.7 | Low-end Android blur jank | Blur ≤ 22 px; `.mobile-nav` is one layer; panel uses `contain: paint`; 60 fps verified via DevTools Performance on 4× CPU throttle |
| 9.8 | Sound annoyance / shared-device awkwardness | Master mute + 3-level volume + haptics toggle, one-tap access in sidebar footer & panel; default `volume: 0.55`, `enabled: true` per owner's "full kit" decision |
| 9.9 | Push endpoint rot | 404/410 cleanup; daily cron doubles as implicit health sweep only for reminders — endpoint liveness verified lazily (standard Web Push practice) |
| 9.10 | Demo workspace noise | All triggers fire in demo too (shared workspace, already "attributable") — actually desirable: visitors see the notification center work |
| 9.11 | `next start` self-host | `vercel.json` crons ignored outside Vercel — cron route still callable with secret; documented for `npm start` users |

---

## 10. Verification plan (per PR, plus release)

**Every PR:** `npm run build` (type-checks) green · routes smoke `/`, `/login`, `/setup`, `/invite/x`, `/transactions`, `/team`, `/inventory` → 200 · demo login flow works (demo@hisaabook.example) · `git grep` gates (PR 1: no `.toast`/`showToast`).

**PR 1:** Chrome DevTools → Rendering tab → `prefers-reduced-motion: reduce` → verify static, no flashes; `prefers-reduced-transparency` → glass becomes solid; delete localStorage `hissabook:sound:v1` → defaults re-seed; cross-tab mute sync; VoiceOver/NVDA pass on sidebar nav + bell placeholder; tap sound latency < 50 ms after first gesture; no console errors/hydration warnings.

**PR 2:** `npm run dev` → demo login → perform each trigger (record transaction, loan repayment, stock movement, salary payment, send invitation, accept via second browser) → badge increments ≤ 25 s (poll) and immediately on focus; mark-read optimistic; mark-all-read drains; reload → persisted; click item → correct route + read state; **cron**: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reminders` twice → second run returns `created: 0`; Direct sqlite check: rows exist in `notifications`/`notification_reads`; `npm run build` clean; adversarial: notifier throw (temporarily break SQL) → mutation still succeeds.

**PR 3:** Desktop Chrome enable → self-confirmation push arrives → click → focuses app at `/`/deep link; Android Chrome same via preview URL (HTTPS); iOS: install flow sheet → Add to Home Screen → launch from icon → enable → push received with PWA **closed** → tap opens correct page; deny path copy; disable path → row + subscription gone; garbage endpoint send → row deleted after failure; Lighthouse PWA audit ≥ PR #9 baseline; badge-96 silhouette renders in status bar (alpha channel intact).

**Cross-cutting:** run Lighthouse perf vs `main`; confirm no `fetch` to external fonts; confirm `.env*` untouched; record sizes (First Load JS per route) in PR descriptions.

---

## 11. Documentation to update in the same PRs

- `AGENTS.md` — sounds/notifications section: env vars, cron setup, "enable alerts" flow, demo guidance, dual-engine DDL rule for new tables, `oauth`/VAPID note; branch note update.
- `README.md` — feature blurbs + push screenshots (optional) + quick `.env.local` setup for push.
- `docs/FEATURES.md` — new sections (notification center, push, smart reminders, sounds, motion tokens).
- `docs/REQUIREMENTS.md` — acceptance criteria (19 items: badge math, poll cadence, dedupe, iOS install, reduced-motion, mute persistence…).
- `docs/USER_FLOWS.md` — "Enable device alerts" flow incl. iOS install path; "Morning reminder" loop.
- `docs/push-notifications.md` (new) — VAPID setup, per-platform matrix, test script, troubleshooting (denied permission, stale endpoint, iOS caveats), incident rollback.
- `.env.example` — the four new vars with comments.

---

## 12. Rollout order, sizing, and what I need from the owner

| PR | Content | Est. effort | Merge gate |
|---|---|---|---|
| **PR 1 — Foundation** | deps; glass tokens + component classes; motion provider + count-ups + nav pill + template.tsx; button press; sound engine + control + haptics; sileo skin + central wrapper + all call-site migrations + Undo | 1.5–2 days | Build green; reduced-motion verified; demo flow sign-off |
| **PR 2 — Notification center** | dual-engine DDL + Supabase migration (applied pre-merge w/ owner); `lib/notifications.ts`; 3 public routes + cron route + `vercel.json` + `CRON_SECRET`; triggers in 11 handlers; bell + panel (desktop dropdown + mobile bottom sheet) + polling + badge + footer (sound toggle); docs | 2–2.5 days | Build green; cron curl test; trigger checklist |
| **PR 3 — Web push** | VAPID keys into Vercel (connector), `public/sw.js`, mono badge icon, `pwa-register`, subscribe/unsubscribe/config routes, `lib/push.ts` + fan-out hook, enroll UX (iOS install sheet + first-save priming), `scripts/send-test-push.mjs`, docs | 1.5–2 days | Devices verified (desktop+Android+installed iOS); prod env set; prod smoke |

**Total:** ~5–6.5 engineer-days over 3 review cycles, matching the owner's "not a single turn" framing. All work stays on `arena/286a1db9-hissabook`, PRs target `main`, production deploys via the existing Vercel Git integration after each merge.

**Needed from the owner:**

1. ✅ Scope decisions (this document encodes them).
2. **Go-ahead to start PR 1.**
3. At PR 2 time: blessing to apply the notifications migration to **production Supabase** (or the operator's preferred apply path).
4. At PR 3 time: approval to write VAPID private key + `CRON_SECRET` into Vercel env (or provide via dashboard yourself).
5. Permission to keep the notification center enabled for the public demo workspace (recommended — it's the fastest way for reviewers to feel it).

---

## 13. Explicit non-goals (v1)

Offline mode / background sync / cached app shell · notification preferences matrix (per-kind muting) · snooze/quiet hours · email/SMS/WhatsApp delivery · Web Push rich actions & images · iOS < 16.4 · in-app inbox pagination beyond cursor · admin broadcast composer · migrating off Sileo after adoption · any visual reskin beyond the glass/motion spec'd here.

---

## Appendix A — `.env.example` additions

```bash
# Push (PR 3). Generate: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=replace-with-vapid-public-key
VAPID_PRIVATE_KEY=replace-with-vapid-private-key
VAPID_SUBJECT=https://hissabook-eta.vercel.app

# Daily reminders cron (PR 2). Generate: openssl rand -hex 32
CRON_SECRET=replace-with-random-secret
```

## Appendix B — Notification kind → icon/sound map

| kind | Lucide icon | Cue (PR 1) | Default href |
|---|---|---|---|
| `transaction` | ReceiptText | `ledger` | `/transactions` |
| `loan` | HandCoins | `ledger` | `/` |
| `inventory` | Boxes | `info` | `/inventory` |
| `salary` | Banknote | `salaryPaid` | `/team` |
| `member` | UsersRound | `invite` | `/` |
| `invitation` | MailPlus | `invite` | `/` |
| `reminder` | AlarmClockCheck | `reminder` | `/` |

## Appendix C — Verification commands

```bash
npm run build
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/{,login,transactions,team,inventory}
curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reminders        # expect {"created":N}
curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reminders        # expect {"created":0}
node scripts/send-test-push.mjs --dry-run                                              # PR 3
sqlite3 data/hisaabook.sqlite 'select count(*) from notifications;'                    # PR 2 local
```

## Appendix D — Open questions intentionally deferred to implementation

Whether `app/api/transactions` gains a status-mutation endpoint for the VOID/cleared trigger (§9.3) · exact Sileo attribute hooks used for the final skin (§9.5) · whether bell badge seeds via SSR (no — client mount, pop animation is a feature) · Android status-bar badge icon art direction (silhouette redraw vs reuse of maskable) — decided at PIL time.
