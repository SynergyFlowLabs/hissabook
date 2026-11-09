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
