# Hisaabook

A business bookkeeping and ownership-tracking product for solo founders and teams. Product planning documents are in [`docs/`](docs/). Working agreements for humans and AI agents are in [`AGENTS.md`](AGENTS.md); agent skills from [skills.sh](https://skills.sh) are pinned in [`skills-lock.json`](skills-lock.json) and restored with `npx skills experimental_install`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local development uses an ignored SQLite database at `data/hisaabook.sqlite` and seeds the Safa Studio workspace if it is empty. The landing and sign-in pages both show the shared public demo login (`demo@hisaabook.example` / `HisaabookDemo2026!`) and offer one-click access to its sample workspace. Changes in that demo are shared with other visitors; never enter real information. Set `DATABASE_PATH` to use a different local SQLite file. Development generates an ignored local session secret in `data/.auth-secret`; deployments require a unique `AUTH_SECRET` (see [`.env.example`](.env.example)). With `DATABASE_URL` configured, the app uses Supabase PostgreSQL.

## Current working slice

- Next.js App Router dashboard with a mobile-first, responsive UI built with shadcn/ui components (Tailwind CSS v4, Radix primitives), Lucide icons, and Recharts. The design system lives in `app/globals.css` (mobile-first, mint canvas, lime primary, deep-green panels) and follows a modern-fintech reference with circular quick actions, a dark hero balance card, and a floating pill navigation on mobile.
- Installable PWA: `app/manifest.ts` (standalone display, shortcuts, maskable icons), full `<head>` metadata via `app/layout.tsx` (Open Graph, Twitter card, theme-color per color scheme, `mask-icon`, MS Tile, canonical), AI-generated logo and social card under `public/` and the `app/opengraph-image.png` convention.
- Owner account setup, credentials sign-in, hashed passwords, signed sessions, sign-out, and server-side workspace membership/role checks.
- Owner-managed member invitations with expiring one-time acceptance links, role assignment, access revocation/reactivation, and audit events.
- Local/demo SQLite storage and a Supabase PostgreSQL production backend for business accounts, owners, transactions, loans, inventory, team records, and audit events.
- Dashboard figures and the 90-day income/expense chart are derived from stored cleared transactions; pending transactions do not affect balances or totals.
- Create income, expense, owner contribution/withdrawal, loan received/given, and inter-account transfer records. Record partial loan principal repayments and receivable collections; optional interest/fees are posted separately as income or expense. Transfers and principal repayments do not inflate income/expense totals.
- Search recent transactions and view business account balances, owners/shares, and outstanding loans.
- Full activity ledger with pagination, text/date/type/category/account/status/creator filters, plus a filtered CSV export that includes loan repayments and recorder attribution.
- Inventory workspace with editable/archiveable item records, stock receipts/issues/returns/adjustments, low-stock alerts, movement history, and an optional linked purchase expense.
- Team workspace with employee profile updates and archive/reactivation, effective-dated monthly salary rates, salary periods, partial salary payments, remaining payables, and linked salary expenses.
- Partners workspace for multi-owner businesses: per-partner running hisaab (fronted expenses, counter drawings, reimbursements, capital in/out), effective-dated day-weighted profit-sharing ratios, a deed-configurable appropriation engine (partner salary, interest on capital capped by remaining profit, interest on drawings added back, residual shared by PSR, largest-remainder rounding), POSTED/VOID distribution history with mirrored corrections, partner statements with print/CSV, deed terms per workspace, drawing-cap warnings, a monthly partner digest cron, share-change history, and a full exit-settlement calculator (auto unposted distribution, revaluation lines split by exit-date PSR, goodwill raise-and-write-off or cash adjustment, PAY/LOAN settlement, ledger closed to zero, loan booked for any unpaid balance). The demo workspace seeds last month's posted distribution and opens on a realistic appropriation history.

## Current limitations

This is an early MVP slice. Each account is assigned to one workspace; workspace switching is not implemented. Invitations are copyable one-time links (not emailed); roles are owner, admin, bookkeeper, payroll, and viewer, with server-side permission checks. Password recovery is not implemented. The public demo credentials are intentionally visible on the login page and grant owner-level access only to the isolated demo workspace; visitors share and can change its records. Inventory and employee modules are demonstration-level and do not yet support multiple stock locations, formal stock valuation, statutory payroll calculations, payslips, transaction correction/reversal, account/owner management screens, and attachments. New financial transactions record the signed-in member; seeded demo history retains its sample attribution labels.

## Deployment and database

Production deployments use Supabase PostgreSQL through the transaction pooler (`DATABASE_URL`); the schema and restrictive RLS defaults are in [`supabase/migrations/`](supabase/migrations/). Set `DATABASE_URL` only as a server-side secret and never expose it to browser code. The private production workspace remains separate from a seeded public demo workspace. Demo data is created idempotently on demo login and includes example balances, transactions, owners, loans, inventory, employees, and salary periods. Vercel preview deployments remain on local SQLite under `/tmp` unless separately configured, so preview data is disposable and must not contain real records. The selected Supabase Free project has plan limitations; arrange independent backups and recovery before relying on it for financial or payroll records. Complete account recovery, privacy, and security reviews before treating this MVP as production-critical.

See [`docs/PRD.md`](docs/PRD.md), [`docs/FEATURES.md`](docs/FEATURES.md), [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), and [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md) for the product plan.
