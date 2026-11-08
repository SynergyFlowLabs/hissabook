# Hisaabook

A business bookkeeping and ownership-tracking product for solo founders and teams. Product planning documents are in [`docs/`](docs/).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local development uses an ignored SQLite database at `data/hisaabook.sqlite` and seeds the Safa Studio demo workspace if it is empty. Set `DATABASE_PATH` to use a different local SQLite file. Development generates an ignored local session secret in `data/.auth-secret`; deployments require a unique `AUTH_SECRET` (see [`.env.example`](.env.example)). With `DATABASE_URL` configured, the app uses Supabase PostgreSQL instead and creates an empty “My Business” workspace rather than demo financial or payroll records.

## Current working slice

- Next.js App Router dashboard with a responsive UI built using Tailwind CSS, Radix UI Dialog, Lucide icons, and Recharts.
- Owner account setup, credentials sign-in, hashed passwords, signed sessions, sign-out, and server-side workspace membership/role checks.
- Owner-managed member invitations with expiring one-time acceptance links, role assignment, access revocation/reactivation, and audit events.
- Local/demo SQLite storage and a Supabase PostgreSQL production backend for business accounts, owners, transactions, loans, inventory, team records, and audit events.
- Dashboard figures and the 90-day income/expense chart are derived from stored cleared transactions; pending transactions do not affect balances or totals.
- Create income, expense, owner contribution/withdrawal, loan received/given, and inter-account transfer records. Record partial loan principal repayments and receivable collections; optional interest/fees are posted separately as income or expense. Transfers and principal repayments do not inflate income/expense totals.
- Search recent transactions and view business account balances, owners/shares, and outstanding loans.
- Full activity ledger with pagination, text/date/type/category/account/status/creator filters, plus a filtered CSV export that includes loan repayments and recorder attribution.
- Inventory workspace with editable/archiveable item records, stock receipts/issues/returns/adjustments, low-stock alerts, movement history, and an optional linked purchase expense.
- Team workspace with employee profile updates and archive/reactivation, effective-dated monthly salary rates, salary periods, partial salary payments, remaining payables, and linked salary expenses.

## Current limitations

This is an early single-workspace MVP slice. Invitations are copyable one-time links (not emailed); roles are owner, admin, bookkeeper, payroll, and viewer, with server-side permission checks. Password recovery and multi-workspace switching are not implemented. Inventory and employee modules are demonstration-level and do not yet support multiple stock locations, formal stock valuation, statutory payroll calculations, payslips, transaction correction/reversal, account/owner management screens, and attachments. New financial transactions record the signed-in member; seeded demo history retains its sample attribution labels.

## Deployment and database

Production deployments use Supabase PostgreSQL through the transaction pooler (`DATABASE_URL`); the schema and restrictive RLS defaults are in [`supabase/migrations/`](supabase/migrations/). Set `DATABASE_URL` only as a server-side secret and never expose it to browser code. Production initializes an empty workspace; it does not seed demo balances, transactions, employees, or salaries. Vercel preview deployments remain on local SQLite under `/tmp` unless separately configured, so preview data is disposable and must not contain real records. The selected Supabase Free project has plan limitations; arrange independent backups and recovery before relying on it for financial or payroll records. Complete account recovery, privacy, and security reviews before treating this MVP as production-critical.

See [`docs/PRD.md`](docs/PRD.md), [`docs/FEATURES.md`](docs/FEATURES.md), [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), and [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md) for the product plan.
