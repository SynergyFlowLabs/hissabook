# AGENTS.md — Hisaabook

Guidance for AI agents and humans working in this repository. Hisaabook (hisaabook) is a business bookkeeping and ownership-tracking product for solo founders and teams, aimed at Pakistani businesses. Read this before making changes.

## Product context

- Product plan lives in [`docs/PRD.md`](docs/PRD.md), [`docs/FEATURES.md`](docs/FEATURES.md), [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), and [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md). Keep code and copy consistent with those documents; if you change behavior, update the docs in the same session.
- Currency is Pakistani Rupee (format `₨ 1,234,567`), dates render in `en-PK` locale, and the audience is Pakistan-first (mobile use, low bandwidth, shared devices).
- The product is not a bank, payment processor, tax filer, or legal/accounting advisor. Never add copy that implies it is.
- The public demo workspace (`demo@hisaabook.example`) is intentionally shared and editable; never put real user data or secrets in it.

## Tech stack

- **Next.js 16 (App Router)** + React 19 + TypeScript, strict mode.
- **Tailwind CSS v4** (via `@tailwindcss/postcss`) and **shadcn/ui** components in `components/ui/`.
- Icons: `lucide-react`. Charts: `recharts`. Radix primitives underneath shadcn.
- Auth: Auth.js v5 (`next-auth`) credentials + signed sessions. Server-side role checks in `lib/authorization.ts` and `lib/page-auth.ts` — always enforce permissions server-side; the UI role flags are only for presentation.
- Storage: local SQLite (`better-sqlite3`) for dev/preview, Supabase PostgreSQL (`postgres`, transaction pooler) in production. Schema + RLS in `supabase/migrations/`.
- State: server-rendered where possible; client components (`'use client'`) only for interactivity. Data fetching from client components uses the `/api/*` route handlers.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server on 0.0.0.0:3000
npm run build        # production build (also type-checks)
npm start            # serve production build
```

There is no test runner yet; `npm run build` is the verification gate. Exercise changed flows manually (the public demo login is the fastest way in) and say so in your final message.

## Repository layout

```
app/                  App Router: pages, route handlers (api/), globals.css (design tokens + components)
components/           Shared components: app shell (app-sidebar.tsx), auth forms, landing page
components/ui/        shadcn/ui components (generated — edit tokens/variants, don't fork lightly)
lib/                  Server utilities: database, auth, authorization, passwords, demo account
docs/                 Product planning documents
supabase/migrations/  PostgreSQL schema and RLS
.agents/skills/       Project skills installed via skills.sh (committed)
.claude/skills/       Symlinks into .agents/skills for Claude Code / Eve (committed)
agent/skills/         Reformatted copy of the skills for universal agents (committed)
skills-lock.json      skills.sh lockfile — restores skills with `npx skills experimental_install`
```

## Design system (reference-driven)

The UI redesign (November 2026) follows a modern-fintech reference: light mint canvas, big white cards with large radii, lime-green primary actions, near-black green panels, bold oversized balance typography, circular quick-action buttons, and a floating dark pill navigation on mobile.

- **Tokens** are CSS custom properties in `app/globals.css` (`--canvas`, `--card`, `--ink`, `--lime`, `--lime-strong`, `--deep`, radii, shadows). Use them; don't scatter raw hex values in new code.
- **shadcn/ui** is the component library. Compose from `components/ui/` first (Button, Card, Dialog, Input, Select, Badge, Avatar, Table, Tabs, Tooltip, Skeleton…). Add new shadcn primitives with `npx shadcn@latest add <component>` rather than hand-rolling.
- Prefer Tailwind utilities inline; keep `globals.css` for tokens, element defaults, and a small set of cross-cutting component classes.
- Layout conventions: authenticated pages render `<AppSidebar>` + `.main-area` + a page-specific content grid. Mobile: sidebar collapses into a floating dark pill bottom nav (`.mobile-nav`).
- Amounts: positive flows use the deep green tint, outgoing/expense flows use the terracotta tint, transfers stay neutral. Pending/void states use Badge variants.
- Accessibility: every icon-only button needs an `aria-label`; keep visible focus rings; honor `prefers-reduced-motion`; ensure contrast of text on lime (use `--lime-foreground` / ink).

## Agent skills (skills.sh)

This repo pins project-scope skills via skills.sh so every agent gets the same tools. They are committed under `.agents/skills/` (universal), `.claude/skills/` (Claude Code / Eve symlinks) and `agent/skills/` (plain-YAML copy). Restore or update with:

```bash
npx skills ls                      # list installed project skills
npx skills experimental_install    # restore from skills-lock.json
npx skills update -p               # update project skills
```

Installed skills and when to use them:

| Skill | Use for |
| --- | --- |
| `find-skills` | Discovering/installing more skills from skills.sh ("is there a skill for X?") |
| `ui-ux-pro-max` | UI/UX design intelligence: styles, palettes, font pairings, UX guidelines, Next.js/Tailwind stack rules |
| `copywriting` | Landing/marketing copy, headlines, CTAs, microcopy |
| `content-strategy` | Content plans, editorial direction, docs and SEO content |
| `copy-editing` | Tightening and polishing existing copy |
| `cro` | Conversion rate optimization for signup/onboarding/landing pages |
| `customer-research` | Understanding founders/bookkeepers; voice-of-customer inputs |
| `marketing-psychology` | Behavioral science framing for product and pricing pages |
| `onboarding` | First-run and activation flows |

Review a skill's `SKILL.md` before relying on it; skills run with full agent permissions.

## Working conventions

- **Branch:** all session work happens on `arena/f30105f8-hissabook`. Don't switch branches, and don't rename it.
- **Functionality first:** the redesign is presentation + component-library work. Preserve API contracts (`/api/*`), role gating, and data derivation rules (pending transactions never affect balances).
- **Server components by default**; `'use client'` only where interactivity requires it.
- **Never** log secrets, commit `data/`, `*.sqlite`, or `.env*` files. `.env.example` documents required variables.
- Commit `skills-lock.json` changes together with `.agents/` updates.
- Keep diffs reviewable; don't reformat untouched files. Match the existing zero-JS-PDF, no-`eval` stance.
