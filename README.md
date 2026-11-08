# Hisaabook

A business bookkeeping and ownership-tracking product for solo founders and teams. Product planning documents are in [`docs/`](docs/).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first run, Hisaabook creates an ignored local SQLite database at `data/hisaabook.sqlite` and seeds the Safa Studio demo workspace if it is empty. The first visit opens one-time owner setup; create an owner account to continue. Setup closes after the first account is created. Set `DATABASE_PATH` to use a different SQLite file. Development generates an ignored local session secret in `data/.auth-secret`; production requires a unique `AUTH_SECRET` (see [`.env.example`](.env.example)).

## Current working slice

- Next.js App Router dashboard with a responsive UI built using Tailwind CSS, Radix UI Dialog, Lucide icons, and Recharts.
- Owner account setup, credentials sign-in, hashed passwords, signed sessions, sign-out, and server-side workspace membership/role checks.
- Owner-managed member invitations with expiring one-time acceptance links, role assignment, access revocation/reactivation, and audit events.
- Persistent SQLite storage for a demo business, its PKR cash/bank accounts, owners, ownership percentages, transactions, loans, and transaction-creation audit events.
- Dashboard figures and the 90-day income/expense chart are derived from stored cleared transactions; pending transactions do not affect balances or totals.
- Create income, expense, owner contribution/withdrawal, loan received/given, and inter-account transfer records. Record partial loan principal repayments and receivable collections; optional interest/fees are posted separately as income or expense. Transfers and principal repayments do not inflate income/expense totals.
- Search recent transactions and view business account balances, owners/shares, and outstanding loans.
- Inventory workspace with editable/archiveable item records, stock receipts/issues/returns/adjustments, low-stock alerts, movement history, and an optional linked purchase expense.
- Team workspace with employee profile updates and archive/reactivation, effective-dated monthly salary rates, salary periods, partial salary payments, remaining payables, and linked salary expenses.

## Current limitations

This is an early single-workspace MVP slice. Invitations are copyable one-time links (not emailed); roles are owner, admin, bookkeeper, payroll, and viewer, with server-side permission checks. Password recovery and multi-workspace switching are not implemented. Inventory and employee modules are demonstration-level and do not yet support multiple stock locations, formal stock valuation, statutory payroll calculations, payslips, transaction correction/reversal, account/owner management screens, attachments, export, or production database configuration. The seeded workspace is demonstration data. Before storing sensitive production records, configure and protect `AUTH_SECRET`, deploy on durable encrypted storage, set up backups/recovery and account recovery, and complete a privacy/security review.

See [`docs/PRD.md`](docs/PRD.md), [`docs/FEATURES.md`](docs/FEATURES.md), [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), and [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md) for the product plan.
