# Production verification — hissabook (2026-11-09)

Read-only check. **Nothing was deployed, migrated, seeded, merged or written to
production.** Every statement below is either measured (tool output) or marked
as not verified.

## 1. Vercel production (project `hissabook`, team `gulzaibs-projects-347c279f`)

| Check | Result |
|---|---|
| Production deployment | `dpl_CnoUW9TCLkL291G84fYyVNSNbgHf` — status **READY**, `readyState` PROMOTED, target `production` |
| Commit | `e4c4e520` "Merge pull request #16 … Exit settlement calculator + CSV exports (PR 3)" on `main` — i.e. production is running the latest merge, so Phases 1-5 are live |
| Aliases | `hissabook-eta.vercel.app`, `hissabook-gulzaibs-projects-347c279f.vercel.app`, `hissabook-git-main-…` |
| Crons registered | `/api/cron/reminders` `0 8 * * *`, `/api/cron/partner-digest` `0 9 1 * *` (partner digest is live) |
| Env | `DATABASE_URL` (production only, secret), `DATABASE_PATH=/tmp/hisaabook.sqlite` (fallback for preview), `AUTH_SECRET`, `CRON_SECRET`, VAPID keys present |

Not verified: the running app itself. This sandbox's outbound allow-list covers
only GitHub/registries, so `https://hissabook-eta.vercel.app` is unreachable from
here (`curl` returned `000`, no connection). Deploy health above is from the
Vercel API, not from an HTTP request to the site.

## 2. Database `hissabook-prod` (`aoursspbigylxylzishi`)

| Check | Result |
|---|---|
| Project status | ACTIVE_HEALTHY, Postgres 17.11 (ap-south-1) |
| Migration history | `20261108202730 hisaabook_initial_schema`, `20261109070745 notifications`, `20261109100315 partner_ledger` — **PR #14 schema is applied** |
| Tables present | `owner_share_changes`, `partner_entries`, `profit_distributions`, `workspace_partner_settings` (all four) |
| `owners` columns | `user_id`, `status` (default `'active'`), `exited_at` present |
| `transactions` columns | `partner_id`, `funding_kind` present |
| `accounts` column | `is_system` present (default 0) |
| Baseline backfill | 3 `owner_share_changes` rows, note `Baseline share at migration` — step 3 of the plan ran |
| RLS / grants | RLS enabled and `REVOKE ALL … FROM anon, authenticated` on the four new tables, as the migration specifies |
| Insert path | `EXPLAIN` (plan only, nothing executed) of the writes the partner page makes — partner-funded `transactions` insert with `partner_id`/`funding_kind`, and a `partner_entries` `PROFIT_SHARE` insert — both produce valid plans with no missing-column or constraint error |

**So yes: production has the PR #14 schema and the partners page can be trusted
schema-wise.** It is not "fully live" data-wise, though — see below.

### What production actually contains

| Workspace | slug | owners | accounts | transactions | partner_entries | profit_distributions |
|---|---|---|---|---|---|---|
| 1 | `hisaabook` ("My Business") | 0 | 1 | 0 | 0 | 0 |
| 2 | `hisaabook-demo` ("Safa Studio Demo") | 3 | 2 | 4 | 0 | 0 |

- The public demo workspace exists in prod (user `demo@hisaabook.example`, role
  OWNER, scrypt hash format matches the app) with its three partners and their
  baseline share rows — but it has **no partner entries and no distributions**,
  and its transactions are the original 4 sample rows (1 legacy
  `CONTRIBUTION` "Hamza · Capital" with `partner_id` NULL, which the new tray in
  PR #17 will surface, plus income, rent, and a pending software expense).
- The private "My Business" workspace is empty (no owners).
- No partner-funded expense, drawing, reimbursement or distribution has ever
  been posted in production.

### Findings worth the owner's attention (no action taken)

1. **The partner demo seed has not run in production.** `seedPartnerDemoIfEmpty`
   would create the clearing account, the fronted-expense / drawing /
   reimbursement trio, last month's posted 46,000 distribution and a
   `DEMO_PARTNER_SEEDED` audit row. None of that exists for workspace 2
   (`partner_entries` 0, `profit_distributions` 0, no clearing account, and the
   only `audit_events` row is `DEMO_WORKSPACE_SEEDED` from the older module
   seed). Its own early-return guard does **not** explain this: the guard looks at
   `partner_entries`, which is empty, so the seed would proceed. The three
   `owner_share_changes` rows carry the note `Baseline share at migration`, i.e.
   they came from migration `20261109100315`, not from the seed (the seed writes
   `Baseline share (demo seed)`). Workspace name ("Safa Studio Demo") and the
   demo user do match the current constants, so this is not a naming drift.
   Most likely the seed has simply not executed on the current deployment (it
   runs from `ensurePublicDemoAccount()` when `/login` renders, i.e. on the first
   page visit after a deploy), and the second possibility is a swallowed error:
   the seed's `catch` only calls `console.error`, leaving no trace in the
   database. Conclusion: the "demo opens on last month's distribution"
   behaviour verified locally is **not** the current state of the public prod
   demo, and we cannot tell from the database which of the two causes applies.
   To make that diagnosable, this branch now writes an
   `audit_events` row (`DEMO_PARTNER_SEED_FAILED`) with the error message when
   the seed throws, instead of failing silently. That is a code change only; it
   writes nothing until a deploy runs the seed.
2. **Demo data in prod is reachable by anyone with the published demo login**,
   which is intended, but nothing partner-related is there yet, so a reviewer
   logging into prod today sees the partner page with zero movements and an
   empty distribution history (plus, after PR #17, the legacy `Hamza · Capital`
   row in the tray).

### Proposed (needs explicit go-ahead — nothing applied)

- Open `https://hissabook-eta.vercel.app/login` once (or log in as the demo
  user) on the current production deployment: that is what triggers the partner
  seed. Afterwards, re-run the checks in this document against workspace 2 and
  expect `partner_entries` 9-ish rows, one `POSTED` October distribution and a
  `DEMO_PARTNER_SEEDED` audit row. If instead a `DEMO_PARTNER_SEED_FAILED` row
  appears (after this branch is deployed), it carries the Postgres error text.
- Alternative, no deploy needed: the owner posts the October distribution from
  the Partners page in prod (the dialog preselects the right period). Deleting
  nothing is required either way; `partner_entries` for workspace 2 is empty, so
  the seed guard would pass.
- Nothing schema-side is outstanding: no new migration is needed for PR #17
  either (`transactions.partner_id` already exists; legacy attribution only
  inserts `partner_entries` + `audit_events` rows).

## 3. Definition of "healthy" for this pass

- Deployment: READY and on the current `main` ✅ (by API).
- Login: demo credentials exist and the user is an active OWNER of the demo
  workspace ✅ (by SQL). A real login was **not** performed (network blocked).
- `/partners` loads: schema + seed prerequisites present ✅ (by SQL and by
  `EXPLAIN` of the page's queries). No HTTP request made.
- Distribution preview builds: requires at least one partner with a share change
  and a non-zero basis for the period; those inputs exist, so the preview's
  queries should resolve ✅ (by SQL). Not executed.


## 4. Follow-up (2026-11-09, after the PR #17 deploy)

The first visit to `/login` on the new deployment did run the partner seed, so
finding 1 was the "never executed" case, not a data error. It then exposed a
second, worse defect:

- **The demo seed ran twice.** Workspace 2 now has every entry duplicated
  (two `EXPENSE_PAID` 18,500 rows, two `CASH_WITHDRAWAL` 25,000 rows, two
  `ADVANCE_REIMBURSED` 10,000 rows) and **two POSTED distributions for the same
  October period** (`#1` and `#2`, both 46,000 residual 45/35/20, eleven seconds
  apart). Cause: `seedPartnerDemoIfEmpty` guarded on a `COUNT(*)` of
  `partner_entries` and then inserted, which is read-then-write. On SQLite the
  write queue hides that; on Postgres two lambdas rendering `/login` at once both
  saw zero rows. Nothing about the data is a schema error, the numbers are just
  doubled.
- Fixes shipped in this branch (no production writes): a `seed_claims` table with
  a `(workspace_id, kind)` primary key that a seed must insert into before it
  seeds (the loser of a race fails on the key and stops, a failed seed releases
  its claim), a partial unique index allowing one `POSTED` distribution per
  workspace period as a database backstop, and a friendly 400 instead of a 500
  when that index rejects a race. Verified locally: 20 concurrent first visits to
  `/login` on a fresh database produce exactly 6 partner entries, 1 distribution,
  1 clearing account, 3 inventory items, 2 employees, 2 salary periods.
- **Applied to production on 2026-11-09 after the owner's go-ahead.** Migration
  `20261109153000_profit_distribution_unique_period` ran first (it cannot be added
  while two POSTED rows for the same period exist, so the data repair went first):
  1. Data repair, in one transaction. Deleted duplicate distribution `#2` with its
     three `PROFIT_SHARE` entries, the second set of demo movements
     (`EXPENSE_PAID` 18,500 on txn 8, `CASH_WITHDRAWAL` 25,000 on txn 11,
     `ADVANCE_REIMBURSED` 10,000 on txn 12) and the duplicated last-month basis
     rows (txns 13 and 14). Kept distribution `#1`, entries 1, 2, 3, 6, 7, 9 and
     txns 5, 6, 7, 9, 10. An unrelated test entry ("Just coffee", txn 15) and its
     loan repayment were left alone, and an audit row
     `DEMO_DUPLICATE_SEED_CLEANED` records exactly what was removed.
  2. Migration applied through the migration runner: `profit_distributions_active_period_idx`
     and `seed_claims` now exist in production (`seed_claims` has RLS on and no
     grants to `anon`/`authenticated`).
  3. The index was probed in production inside a rolled-back `DO` block: a second
     POSTED row for 2026-10-01..10-31 raises `unique_violation`, a VOID row for the
     same period is accepted. Production still holds exactly 1 distribution.
  4. `seed_claims` was pre-populated for the demo workspace (`partner`, `modules`)
     so the still-deployed pre-fix build cannot seed a third time before the fix
     reaches production.
- Post-repair state of workspace 2: 6 partner entries, 1 POSTED distribution
  (46,000 residual, 20,700 / 16,100 / 9,200), 3 accounts, 3 inventory items,
  2 employees, 2 salary periods, 10 transactions.
