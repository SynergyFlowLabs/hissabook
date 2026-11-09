# Hisaabook — Partners' Ledger: Implementation Plan

**Date:** 2026-11-09 · **Branch:** `arena/168d2c96-hissabook` · **Status:** Research complete; owner decisions locked (§0.1). Plan ready for implementation on owner go-ahead. No application code changed yet.
**Author context:** research + planning pass requested by the owner; scoping Q&A answered 2026-11-09.

---

## 0.1 Owner decisions (scoping Q&A, 2026-11-09)

| Question | Decision |
|---|---|
| Out-of-pocket expense treatment | **Advance (A)** — firm owes the partner, reimbursable anytime. Pre-selected in the fronted-expense dialog; (B) capital still offered as a toggle. |
| PR bundle shape | Phased PRs exactly as §9: **PR 1** = Phase 1+2 (ledger core + counter flows), **PR 2** = Phase 3 (distribution engine), **PR 3** = Phase 4+5 (exits & audit). |
| Profit distribution rhythm | **Monthly-ish** — month presets (this month / last month), month-end oriented notifications and the monthly digest cron. |
| Deed default terms | **All off by default** — s.13 defaults; each workspace opts in (interest on capital, salary, interest on drawings). Drawing cap assumed 70% per workspace (unanswered, adjustable). |
| Exit settlement scope | Phase 4 (PR 3) — not part of PR 1 or 2. |
| Profit frequency effect | Digest + preview presets default to month; void/history unchanged. |

Unanswered assumptions baked in (flag if wrong): drawing cap 70% per workspace; partner withdrawals counted from **all** account types (cash/bank/wallet); Partners UI shown even for sole owners; partners without app accounts get in-app/email only (no WhatsApp/SMS in this scope); interest and salary remain strictly opt-in.

## 1. The problem, in the owner's words

> When there are two or more than two partners in a business, any single or more than one partner gives money towards expenses every day, and any single or more than one partner can take cash from the counter at any time.

In Hisaabook's target market (Pakistani small businesses — shops, studios, agencies), this is the everyday reality of a "hisaab" shared between partners. Nobody writes it down the moment it happens, so by month-end nobody can answer: *who fronted what, who took what from the till, who is owed what, and what does each partner actually get when profit is split?*

The ask: implement this properly in Hisaabook — **finance, audit, and money all taken care of** — with every split, share, investment, expense, and income calculated precisely and intelligently.

## 2. What Hisaabook has today (live codebase audit, 2026-11-09)

| Capability | State | Location |
|---|---|---|
| Partners / owners | Exists as **display-only**. `owners(id, workspace_id, name, role, share REAL 0–100, effective_at)`. Seed: Areeba 45% / Hamza 35% / Sara 20%. Rendered as a share bar in "Ownership overview". "View details" is a toast ("Ownership history is coming next") | `lib/database.ts:99`, `app/dashboard.tsx` (`.owners-panel`) |
| Contributions | `CONTRIBUTION` transaction type exists (signed inflow). **No partner attribution** — demo row is literally `'Hamza · Capital'` as free text | `app/api/transactions/route.ts`, `lib/database.ts` seed |
| Withdrawals / drawings | `WITHDRAWAL` transaction type exists (signed outflow). **No partner attribution**, no counter-vs-bank distinction | same |
| Partner-fronted expenses | **Not supported.** Expense always debits a business account; a partner paying out of pocket is invisible or recorded as a fake "capital contribution" | — |
| Reimbursements | **Not supported** | — |
| Profit split / distribution | **Not supported.** No appropriation logic, no effective-dated PSR, no distribution record | — |
| Share history | **Not supported** (single `owners.share` value, mutated in place; changing shares silently rewrites history) | — |
| Audit trail | `audit_events` exists and is written for transactions/loans/salary — the pattern to reuse | `lib/database.ts:156` |
| Immutability pattern | VOID status (reversal, never delete) — the pattern to reuse for ledger entries | `transactions.status` |
| Roles | `OWNER, ADMIN, BOOKKEEPER, VIEWER, PAYROLL` via `requireWorkspaceMember(roles?)` | `lib/authorization.ts` |
| Amounts | Whole PKR integers everywhere (CHECK `amount > 0`) | schema-wide |
| Notifications | In-app bell + web push, `createWorkspaceNotification(...)` | `lib/notifications.ts` |
| Export | CSV via `csvCell` escaping (+₨ formula-injection guard) in `/api/transactions` | reuse pattern |
| Tests | **No test runner.** Pure-TS module + ad-hoc verification recommended (§10) | `package.json` |

**Gap summary:** Hisaabook records *that* money moved, but never *who* it belonged to. The owners panel knows percentages but not balances; nothing nets contributions against drawings; profit is never split; nothing survives an audit question like "Hamza took ₨40,000 from the counter on 3 Nov — against what?"

## 3. Research summary (what the law and accounting practice say)

### 3.1 Partnership Act, 1932 (Pakistan) — binding defaults, overridable only by contract

- **s.13(b)** — absent an agreement, partners share profits **equally** and contribute equally to losses. The ownership panel's shares are therefore a contractual override, not a legal default; the app must store and honor the deed ratio, and warn when none is set. ([Partnership Act, 1932](https://paklawyer.com/wp-content/uploads/2019/10/Partnership-Act.-1932-1.pdf); [thelex.live PDF](https://thelex.live/wp-content/uploads/2023/07/PARTNERSHIP-ACT.1932.pdf))
- **s.13(c)** — a partner entitled to interest on capital receives it **only out of profits**. Translation into product behavior: interest on capital may never drive the firm into loss / must be capped by available appropriable profit.
- **s.13(a)** — no partner is entitled to remuneration for working in the business **unless the partnership agreement provides it**. Partner salary must be an explicit deed setting.
- **s.13(d)** — a partner who makes **payment/advance** for the purpose of the business **beyond his agreed capital** is entitled to **6% p.a. interest** on that advance absent an agreed rate. (Distinct from drawings; distinct from capital.)
- **Interest on drawings** — chargeable **only if the deed says so**; it is an appropriation item, a debit to the partner's account and a credit to the appropriation account. Silent deed ⇒ no interest. ([Law Insider clause explainer](https://www.lawinsider.com/clause/interest-on-partners-drawings))
- **Dissolution settlement order (s.48)** — losses/deficiencies paid first out of profits, then capital, lastly by partners personally in profit-sharing proportions; then (ii) advances rated ratably, (iii) capital ratably, (iv) residue in profit ratio. The exit-settlement calculator should mirror this order. ([Partnership Act PDF](https://thelex.live/wp-content/uploads/2023/07/PARTNERSHIP-ACT.1932.pdf))
- **Goodwill** — recognized as a firm asset on admission/retirement/death; goodwill share valued by the agreed method (2 years' purchase of average profits is a common convention) or by capitalized-value method; the retiring/deceased partner is settled for capital + goodwill share + accumulated reserves ± revaluation. ([IGP Unit 4 — Retirement](https://shop.igpinstitute.org/insight/wp-content/uploads/2024/12/Unit-4-Retirement-of-a-Partner.pdf); [KNGAC e-content](https://www.kngac.ac.in/elearning-portal/ec/admin/contents/5_18K3CO05_2020120304185956.pdf))
- **Revaluation** — on constitution change, assets/liabilities revalued; profit/loss shared in **old PSR**; reserves distributed in **old PSR**; goodwill raised in old PSR or adjusted in cash in new PSR.
- **True accounts duty** — partners are bound to render true accounts and full information to each other (s.9). This is the legal hook for the audit/immutability design below.

### 3.2 How partnership accounting actually books the owner's scenario

Fixed capital + current account method (the dominant practice; keeps capital accounts stable and every partner's running position in one current account):

| Event | Entry | Effect on partner's current account |
|---|---|---|
| Partner contributes capital | Dr Cash/Bank, Cr Capital a/c | none (capital moves) |
| **Partner pays a business expense out of pocket** | Dr Expense a/c, Cr Partner's current a/c (or "Due to partner" liability) | **increases what the firm owes the partner** |
| **Partner takes cash from the counter (drawings)** | Dr Partner's current a/c, Cr Cash | decreases what the firm owes the partner |
| Partner reimbursed for fronted expenses | Dr Partner's current a/c, Cr Cash | decreases what the firm owes the partner |
| Year-end P&L | Dr/Cr P&L → Cr/Dr **Appropriation a/c** | — |
| Partner salary per deed | Dr Appropriation, Cr Current a/c | increases |
| Interest on capital (deed; only out of profits) | Dr Appropriation, Cr Current a/c | increases |
| Interest on drawings (deed) | Dr Current a/c, Cr Appropriation | decreases |
| Residual profit/loss to PSR | Dr Appropriation / Cr Current a/c (profit) — reverse for loss | ± |
| Drawings closed off | closing transfer current ↔ drawings | — |

([ACCA technical article — Accounting for partnerships](https://www.accaglobal.com/uk/en/student/exam-support-resources/foundation-level-study-resources/fa2/fa2-technical-articles/accounting-for-partnerships.html); [ACCA — Working in partnership](https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f3/technical-articles/working-partnership.html); [Partnership Firm Accounting Concepts](https://www.slideshare.net/slideshow/partnership-firm-accounting-concepts-and-final-accounts/274671448); [GeeksForGeeks — Interest on drawings](https://www.geeksforgeeks.org/accountancy/interest-on-drawing-in-case-of-partnership/))

Two consequences baked into the design:

1. **Drawings and fronted expenses live in one running account per partner** — this is exactly what a Pakistani shopkeeper calls "hisaab". They must net against each other, and the balance must be visible to every partner at any time.
2. **Profit distribution is an event with a record**, not a silent percentage on a card. The appropriation workings (salary → interest on capital → interest on drawings → residual PSR) must be printable on demand.

### 3.3 Out-of-pocket expense — the two legitimate treatments (owner decision needed)

Both are correct; the firm picks per entry, with the workspace default set (2026-11-09: **(A) advance, pre-selected**):

- **(A) Advance (due to firm)** — Dr Expense, Cr Partner current a/c. Reimbursable later on demand. **DEFAULT per owner decision.**
- **(B) Capital contribution** — Dr Expense, Cr Partner capital a/c. Not reimbursable; permanent equity. Use when the partner will never ask for it back (informal "hissa lagwa diya").

Hisaabook offers both as a toggle with (A) pre-selected.

## 4. Design principles (non-negotiable)

1. **No double-entry rewrite.** Hisaabook is a single-entry ledger with account balances computed from signed movements. We add a **partner sub-ledger** alongside it (append-only, typed, linked to transactions) — not a parallel accounting universe. If a number can't be explained from `transactions` + `partner_entries`, it doesn't ship.
2. **Integer PKR everywhere.** PSR stays REAL (existing column), day-weights are integers, and every distribution ends in an exact integer split (§6.4).
3. **Append-only partner ledger.** Corrections are new entries (`CORRECTION`), never edits/deletes. Mirrors the existing VOID pattern; `audit_events` records every posting.
4. **Effective-dated ownership.** Share history is a table, never an UPDATE. Historical splits recompute correctly after any mid-period change.
5. **Deed-driven, not law-driven.** All interest/salary/drawings terms are opt-in settings (defaults: all off ⇒ profit shared by PSR only, which is s.13(b)-style equity default modulo the recorded ratio). The app never invents contractual terms.
6. **Pakistan-first UX**: ₨ formatting, English labels (owner-set language posture unchanged), mobile-first quick actions ("Counter drawing" / "Spent ₨ out of pocket" as two prominent buttons), 44px targets, no precision beyond whole PKR.
7. **Role gating respected**: distribution/shares/deed settings = OWNER/ADMIN only; recording movements = OWNER/ADMIN/BOOKKEEPER; viewing = everyone, partner statements restricted to OWNER/ADMIN + the linked partner's own user.
8. **No silent automation.** Suggested splits and accrued-share estimates are always labeled "estimate"; nothing posts without confirmation.

## 5. Data model (additive only; dual-storage discipline)

SQLite DDL goes inline in `lib/database.ts` (`schemaSql`). Postgres goes in a new `supabase/migrations/20261109_partner_ledger.sql` with the same shape (BIGINT/INTEGER PKs, timestamptz, FKs, CHECK constraints). No existing table is destructively altered.

### 5.1 `owners` — promote to partner master (additive columns)

```sql
ALTER TABLE owners ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;  -- optional login link
ALTER TABLE owners ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','exited'));
ALTER TABLE owners ADD COLUMN exited_at TEXT;                 -- set on exit settlement
ALTER TABLE owners ADD COLUMN role_title ...                  -- NOT NEEDED; existing owners.role text is fine
```

### 5.2 `owner_share_changes` — effective-dated PSR history

```sql
CREATE TABLE owner_share_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  share REAL NOT NULL CHECK (share >= 0 AND share <= 100),
  effective_at TEXT NOT NULL,                -- ISO date (YYYY-MM-DD)
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_osc_ws_owner ON owner_share_changes(workspace_id, owner_id, effective_at);
```

Backfill (one-time, in migration SQL): one baseline row per existing owner with `share = owners.share`, `effective_at = owners.effective_at`. From then on, **all** share reads go through the history table; `owners.share` stays as the current-value cache.

### 5.3 `partner_entries` — the append-only partner sub-ledger

```sql
CREATE TABLE partner_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'CAPITAL_CONTRIBUTION','CAPITAL_RETURN',
    'EXPENSE_PAID','ADVANCE_REIMBURSED','DUE_TO_OWNER',          -- deed-style leftovers kept out; see §5.6
    'CASH_WITHDRAWAL',
    'INTEREST_ON_CAPITAL','INTEREST_ON_DRAWINGS','PARTNER_SALARY','PARTNER_COMMISSION',
    'PROFIT_SHARE','LOSS_SHARE',
    'SETTLEMENT','CORRECTION')),
  direction TEXT NOT NULL CHECK (direction IN ('CREDIT','DEBIT')),  -- CREDIT = firm owes partner more
  amount INTEGER NOT NULL CHECK (amount > 0),                        -- signed magnitude, never 0/negative
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  distribution_id INTEGER REFERENCES profit_distributions(id) ON DELETE SET NULL,
  split_share REAL,                       -- 0..1 when one expense is fronted by 2+ partners (audit aid)
  note TEXT NOT NULL DEFAULT '',
  transaction_date TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_pe_ws_owner ON partner_entries(workspace_id, owner_id, transaction_date);
```

**Position formula (per partner, integer PKR):**

```
position(owner) = Σ(CREDIT) − Σ(DEBIT)
  CREDIT: CAPITAL_CONTRIBUTION? NO — see below
```

Careful definition (this is the heart of the feature; getting it wrong breaks every report):

- **Capital postings** (`CAPITAL_CONTRIBUTION`, `CAPITAL_RETURN`) affect the partner's **capital balance**, not the current-account position used for "owes me / I owe" settlements — but both live in `partner_entries` so a single `position` query works if capital types are included. Decision:
  - `partner_position` (settleable) = `ADVANCE_OUTSTANDING` + `APPROPRIATIONS_NET` where
    - `ADVANCE_OUTSTANDING = Σ(EXPENSE_PAID) − Σ(ADVANCE_REIMBURSED)`
    - `APPROPRIATIONS_NET = Σ(PROFIT_SHARE) − Σ(LOSS_SHARE) + Σ(INTEREST_ON_CAPITAL) + Σ(PARTNER_SALARY) + Σ(PARTNER_COMMISSION) − Σ(INTEREST_ON_DRAWINGS)`
    - `MINUS Σ(CASH_WITHDRAWAL)`           (drawings offset appropriations and advances)
    - `PLUS/MINUS SETTLEMENT, CORRECTION` with their directions
  - `capital_balance` = `Σ(CAPITAL_CONTRIBUTION) − Σ(CAPITAL_RETURN)`
  - `net_partner_value = position + capital_balance` — what exit settlement pays out, before revaluation/goodwill.
- A partner who fronts ₨10,000 and then draws ₨4,000 from the till shows: advances 10,000 − drawings 4,000 = ₨6,000 owed to partner. Precisely the counter hisaab.

### 5.4 `profit_distributions` — the appropriation record (immutable once POSTED)

```sql
CREATE TABLE profit_distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_from TEXT NOT NULL, period_to TEXT NOT NULL,   -- inclusive YYYY-MM-DD
  basis_profit INTEGER NOT NULL,                        -- Σ(CLEARED INCOME) − Σ(CLEARED EXPENSE) in period
  salary_total INTEGER NOT NULL DEFAULT 0,
  interest_capital_total INTEGER NOT NULL DEFAULT 0,
  interest_drawings_total INTEGER NOT NULL DEFAULT 0,
  residual_distributed INTEGER NOT NULL,                -- basis − salary − interest_capital + interest_drawings (may be negative ⇒ loss)
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','VOID')),
  workings_json TEXT NOT NULL DEFAULT '{}',             -- full preview snapshot incl. per-partner lines (audit)
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Posting a distribution writes one `partner_entries` row per partner (`PROFIT_SHARE`/`LOSS_SHARE`, plus `INTEREST_ON_CAPITAL`, `INTEREST_ON_DRAWINGS`, `PARTNER_SALARY` when the deed enables them) and one `audit_events` row. Voiding writes a mirrored set of `CORRECTION` entries and sets `status='VOID'` — nothing is deleted.

### 5.5 `transactions` additions

```sql
ALTER TABLE transactions ADD COLUMN partner_id INTEGER REFERENCES owners(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN funding_kind TEXT   -- 'ACCOUNT' | 'PARTNER_ADVANCE' | 'PARTNER_CAPITAL'
  CHECK (funding_kind IN ('ACCOUNT','PARTNER_ADVANCE','PARTNER_CAPITAL'));   -- NULL for legacy rows
```

### 5.6 System clearing account (for out-of-pocket expenses)

Out-of-pocket expenses don't move any business account, yet must appear in expense totals (P&L) and activity. One lazy-created **system** account per workspace anchors the FK and keeps every expense attributable:

```sql
ALTER TABLE accounts ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;
-- lazy row on first partner-expense posting:
--   name 'Partner out-of-pocket (clearing)', account_type 'PARTNER_ADVANCE', opening_balance 0, is_system 1
```

Rules: system accounts are **excluded** from account lists, balances, and `cashBalance` (add `WHERE is_system = 0` to the account queries). Their transactions remain visible in activity (account name shown as "Partner out-of-pocket"). Not part of the cash ledger; the payable relationship lives entirely in `partner_entries` (which is reconciliable to the paisa).

### 5.7 `workspace_partner_settings` — the deed, as data

```sql
CREATE TABLE workspace_partner_settings (
  workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  partner_salary_enabled INTEGER NOT NULL DEFAULT 0,     -- deed-gated; off by default (s.13(a))
  interest_on_capital_enabled INTEGER NOT NULL DEFAULT 0, -- deed-gated (s.13(c))
  interest_on_capital_pct REAL,                           -- % p.a.; only out of profits
  interest_on_drawings_enabled INTEGER NOT NULL DEFAULT 0, -- deed-gated
  interest_on_drawings_pct REAL,                          -- % p.a. on day-outstanding drawings
  drawing_cap_pct REAL NOT NULL DEFAULT 70,                -- warn when partner drawn > X% of accrued distributed share
  settlement_method TEXT NOT NULL DEFAULT 'PAY' CHECK (settlement_method IN ('PAY','LOAN')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 5.8 Backfill & migration order

1. Create new tables; add new columns.
2. Insert `is_system=0` default everywhere (existing accounts untouched).
3. Seed `owner_share_changes` baseline rows for every existing owner (`effective_at = owners.effective_at`, `created_by='migration'`).
4. Best-effort attribute legacy `CONTRIBUTION` rows to owners by **exact name match** on `description` token? NO — unsafe. Legacy `CONTRIBUTION`/`WITHDRAWAL` rows stay `partner_id = NULL` and are labeled "Unattributed (pre-partners)" in reports. Manual attribution action in the UI (OWNER/ADMIN) can tag them later — one tap each.
5. Postgres migration mirrors every step; both paths share the TypeScript DDL-free query layer.

## 6. The money math (specify exactly, implement once, test)

Module: `lib/partners/ledger.ts` — **pure functions, no I/O**, unit-testable:

### 6.1 Share on a date
`shareOn(changes, ownerId, date)` → latest `share` with `effective_at ≤ date` (baseline row covers pre-history). Basis points as REAL; compare by string ISO dates (safe, avoids TZ bugs).

### 6.2 Day-weighted PSR over a period `[from, to]`
Split the period at every share-change boundary inside it. For each segment `s` with day-count `d_s`, segment share `r_{p,s}` for partner `p`:
`weightedRounds[p] = Σ_s d_s × r_{p,s}` — this is partner `p`'s effective weight in partner-days; normalize by `Σ_p weightedRounds[p]` to get the effective ratio for the period. Output: per-partner effective ratio + the segment table (for the "show your workings" preview).

### 6.3 Appropriation order (distribution preview → post)
```
P = Σ(CLEARED INCOME) − Σ(CLEARED EXPENSE)          [partner-expense rows included as EXPENSE]
0. If P < 0: residual loss L = −P shared by PSR → LOSS_SHARE DEBIT entries. No interest/salary (s.13(c): interest only out of profits; salary only from profit). Done.
1. Salaries (if enabled): S = Σ partner_salary amounts → CREDIT each; P₁ = P − S
2. Interest on capital (if enabled): day-weighted interest on each partner's opening capital balance for the period (avg capital × rate × days/365); if P₁ < total interest I: scale I pro-rata to P₁ (never below zero) and flag "interest capped by available profit"; else pay in full. CREDIT entries; P₂ = P₁ − I
3. Interest on drawings (if enabled): each CASH_WITHDRAWAL accrues rate × (days from withdrawal date to period end)/365; DEBIT entries; P₃ = P₂ + D
4. Residual R = P₃ shared by period PSR (§6.2) → PROFIT_SHARE CREDIT entries
5. Rounding: each partner's line is `floor`-ed; the ₨ remainder distributes one PKR at a time to largest fractional remainders (largest-remainder apportionment) ⇒ **Σ allocations == distributed total exactly**, always.
6. `workings_json` persisted on the distribution row: P, segments, per-partner salary/interest/share lines, rounding residues. Immutable preview = the audit receipt.
```
VOID of a POSTED distribution: status→VOID + CORRECTION entries mirrored with flipped directions. Distribution history stays visible forever.

### 6.4 Drawing cap / "intelligent" guards
- `accrued_estimate(partner, asOf)` = last POSTED distribution's PROFIT_SHARE + current-period estimate (labeled estimate; computed live, never stored).
- When a drawing/reimbursement would make `Σ(CASH_WITHDRAWAL) > drawing_cap_pct% × accrued_estimate`: dialog shows amber warning with exact numbers; OWNER/ADMIN can proceed (their call, their audit trail); BOOKKEEPER is allowed but the flag is recorded in `audit_events`.
- Monthly digest notification: per partner — fronted, reimbursed, drawn, net; plus firm-level "partner money in/out vs profit" line. Reuses `createWorkspaceNotification` + existing Vercel Cron (`/api/cron/reminders` pattern, e.g. monthly on the 1st).

### 6.5 Multi-funder split (one expense, two pockets)
`partner_entries` gets one EXPENSE_PAID row per funding partner with `split_share` (pro-rata 0..1, must Σ=1) sharing the single source `transactions` row. Split UI: equal split default; editable amounts must still sum to the expense (disable Post until it does).

### 6.6 Exit / settlement calculator (Phase 4 preview; POST only on explicit confirm)
Inputs: partner, as-of date, revaluation lines (asset/liability, delta ±), goodwill value + method (raise-and-write-off in old PSR, or cash adjustment by remaining partners), mode (PAY now / convert to loan).
Output (mirrors s.48 order + standard admission/retirement mechanics):
```
capital_balance + current_position + share of undistributed retained profit
+ share of revaluation profit (old PSR) + share of goodwill (new-PSR adjustment from gaining partners ∝ sacrifice) − share of revaluation loss
= amount due (payable to / receivable from partner)
```
On confirm: SETTLEMENT entry (closing the partner's position to zero), `owners.status='exited'`, `exited_at`, goodwill/revaluation posted as CORRECTION/SETTLEMENT lines, optional `loans` row if mode=LOAN. Partnership's deed defaults respected; nothing hard-coded.

## 7. User flows & UI

### 7.1 New page `/partners`
Server component (`app/partners/page.tsx`) reusing the authenticated shell pattern; client component for interactivity. Sections:

1. **Header strip** — workspace name, deed status chips ("Salary: off · Interest on capital: 6% p.a. · Drawings: no interest" — tap to edit, OWNER/ADMIN), "Add partner" (OWNER/ADMIN).
2. **Partner cards** (one per active partner) — avatar/initials, role, current PSR with effective date, three headline numbers: **Capital in · Owed by firm (or Overdrawn) · Drew this month**, mini table of last 5 movements (fronts/draws/reimbursements), action row:
   - `Spent ₨ out of pocket` (phone-first quick action; dialog §7.2)
   - `Counter drawing` (§7.3)
   - `Reimburse` (opens list of outstanding EXPENSE_PAID claims; pay one or many, from any account)
   - `Statement` (§7.6)
3. **Unattributed legacy entries** tray (if any `partner_id IS NULL` CONTRIBUTION/WITHDRAWAL rows) — one-tap attribution.
4. **Deed settings** panel (OWNER/ADMIN): toggles + rates + drawing cap + settlement default. Copy: plain, no legalese; each setting notes what the Act says when silent (e.g. "Deed silent ⇒ no interest on drawings (s.13)").

### 7.2 Fronted expense dialog
Kind = Expense (existing form post) **+ source**: `[Paid by: Account ▾ | Partner: Hamza ▾ (split 1/2 ways) | Split among partners ▾]`. If partner-funded:
- (A) "Hamza fronts it — firm owes Hamza" (default) → `EXPENSE_PAID` CREDIT
- (B) "Count it as Hamza's capital" → `CAPITAL_CONTRIBUTION` CREDIT + `EXPENSE_PAID` offset? NO — (B) posts only `CAPITAL_CONTRIBUTION` CREDIT + expense row (partner_id set, funding_kind='PARTNER_CAPITAL'); position unaffected.
Split mode: equal chips; per-partner amounts; total must equal expense (inline check). Creates 1 `transactions` row (account = system clearing account) + N `partner_entries` + 1 audit row. One DB transaction — all-or-nothing.

### 7.3 Counter drawing dialog
Big-number keypad input (native-feel, matches command-dialog style), account selector (defaults to Cash in hand), note optional. Posts `WITHDRAWAL` transaction + `CASH_WITHDRAWAL` DEBIT entry + audit + soft cap warning if tripped (§6.4). Bookkeeper allowed; OWNER override recorded when over cap.

### 7.4 Distribution dialog (OWNER/ADMIN)
1. Pick period (presets: this month / last month / quarter / custom; preselected = since last POSTED distribution).
2. Preview screen (the receipt): basis profit; salary lines; interest on capital with the s.13(c) cap note when binding; interest on drawings lines; residual; PSR table **with day-weight segments shown** (e.g. "1–14 Sep: Areeba 50%, 15 Sep–30 Sep: Areeba 45%"); per-partner totals; rounding note ("largest-remainder rounding; Σ equals residual exactly"); estimate label for any auto-caps.
3. Post → distribution row + entries + audit + notifications to every partner ("Profit for Oct distributed — your share ₨X").
4. History list below with VOID action (reason required).

### 7.5 Share change dialog (OWNER/ADMIN)
New share per partner, effective date, note ("Sara raises to 25% from 1 Dec — buying out Areeba pro-rata"). Validates 0–100 per partner; shows the workspace total; warns if ≠100% but allows posting (audit note when posting a ≠100% state; distribution blocked until reconciled or explicitly confirmed in the dialog with the mismatch displayed).

### 7.6 Partner statement (per partner)
Date range → printable ledger: opening balance, rows (date · description · entry type · debit · credit · running balance), closing balance, footer with totals + "Prepared by Hisaabook" + workspace + generation timestamp. **Print CSS** (`@media print`) not a new PDF dependency. CSV export (reuse `csvCell`). Linked user sees only their own statement; OWNER/ADMIN see all.

### 7.7 Dashboard integration
"Ownership overview" panel upgraded: per partner row gains a net-position chip (`₨12,400 due to Hamza` / `₨8,000 overdrawn`) and the CTA becomes "Partners & shares →" linking `/partners`. No change to layout density. Sidebar: add `Partners` (`/partners`) under Manage; retire `Owners → /#owners` (redirect `/#owners` → `/partners` for back-compat).

### 7.8 Empty & single-owner states
"Hisaabook works for one owner too. Record your own top-ups and till drawings — the math still lands." Sole owner sees identical flows with share forced to 100 (UI locks PSR with a note, not an error).

## 8. API surface (all `runtime='nodejs', dynamic='force-dynamic'`, JSON, `requireWorkspaceMember`)

| Route | Method | Roles | Purpose |
|---|---|---|---|
| `/api/partners` | GET | any member | Partners + live position/capital/month stats (one round trip for the page) |
| `/api/partners` | POST | OWNER, ADMIN | Add partner (name, role title, share, effective date, optional user link) |
| `/api/partners/[id]` | PATCH | OWNER, ADMIN | Edit role/status (exit), unlink/link user |
| `/api/partners/share` | POST | OWNER, ADMIN | Record effective-dated share change (batch for multiple partners) |
| `/api/partners/movement` | POST | OWNER, ADMIN, BOOKKEEPER | `kind: expense-fronted (splits[]) | capital | drawing | reimburse | capital-return` — atomic post |
| `/api/partners/movements` | GET | any member (statements: see 7.6) | Filtered partner ledger feed (powers statements) |
| `/api/partners/distribution/preview` | GET | OWNER, ADMIN | Computed appropriation with full workings (nothing posted) |
| `/api/partners/distribution` | POST | OWNER, ADMIN | Post previewed distribution (idempotency key on client) |
| `/api/partners/distribution/[id]/void` | POST | OWNER, ADMIN | Void + reversing CORRECTION entries (reason required) |
| `/api/partners/statement` | GET | OWNER, ADMIN, linked partner | Statement JSON / `format=csv` |
| `/api/partners/settings` | GET/PATCH | OWNER, ADMIN | Deed settings |
| `/api/partners/settlement` | GET/POST | OWNER, ADMIN | Exit calculator preview / confirm (Phase 4) |

Movement notifications (`createWorkspaceNotification`): drawing recorded (to OWNER/ADMIN actors), fronted-expense recorded (to OWNER/ADMIN), reimbursement paid, distribution posted (to all partners), cap-warning events, exit settlement completed. Kind reuse: extend `NotificationKind` union with `'partner'` (schema CHECK already enumerates kinds — migration updates the CHECK lists in both storages).

## 9. Delivery phases (each independently mergeable, build-green gate)

- **Phase 1 — Ledger core.** Schema both storages + migration; `lib/partners/ledger.ts` (pure math §6) + verification harness; system clearing account; movement posting API + audit events; backfill baseline PSR rows. No UI changes. *Gate: build green; math harness exact on fixtures incl. rounding.*
- **Phase 2 — Partners page.** `/partners` (cards, movements dialogs, reimburse flow, legacy attribution tray), sidebar link, dashboard net-position chips + CTA, statements (JSON/CSV/print CSS). *Gate: build green; manual smoke of all dialogs at 375px.*
- **Phase 3 — Appropriation engine.** Distribution preview/post/void with day-weighted PSR + deed settings (salary/interest capital/interest drawings/drawing cap), cap warnings, notifications + monthly digest cron, settings panel. *Gate: golden-fixture distributions reconcile to the paisa; loss period refuses interest/salary.*
- **Phase 4 — Exit & audit polish.** Settlement calculator (revaluation lines + goodwill methods + LOAN/PAY settlement), `SETTLEMENT` postings, distribution history + void UX, legacy unattributed manager polish.
- **Phase 5 — Reporting & docs.** CSV pack (statement/distribution/movements), demo-seed update (Hamza fronts ₨18,500 electricity; Sara draws ₨25,000; Hamza reimbursed ₨10,000; one posted distribution for last month), README + `docs/` update, `anti-slop/audit-002` pass, final device checklist.

Suggested PR shape: P1+P2 one PR (the counter flows — the owner's daily pain), P3 second PR (the money math), P4+P5 third PR (exits & audit). Each merge auto-deploys prod (standing heads-up for every merge).

## 10. Testing & verification

No test runner exists. Recommended: add `vitest` (dev-only; npm registry reachable) scoped to `lib/partners/**`. Fixture suite (must pass before P1 merges):
1. PSR change mid-period ⇒ day-weighted effective ratio exact (e.g. 50/50 for 10 days, 45/55 for 20 days ⇒ 46.67/53.33).
2. Largest-remainder apportionment: residual ₨100 across 3 equal partners ⇒ 34/33/33, Σ=100.
3. Loss period: no salary/interest posted; LOSS_SHARE recorded; distribution still exact.
4. Interest on capital when P₁ < interest ⇒ scaled to P₁, flag set, never negative.
5. Position formula: fronted 10,000 − reimbursed 4,000 − drawn 3,000 = 3,000 owed.
6. Distribution void ⇒ entries mirrored, sums to zero, audit rows written.
7. Multi-funder split rounding: ₨1,000 split ⅓/⅓/⅓ ⇒ 334/333/333 with split_share stored.
8. Backfill: legacy CONTRIBUTION rows unattributed, baseline PSR rows present, idempotent re-run.

Manual/device: 375px dialogs, keypad, safe-area, print preview of statement, VoiceOver order on movement dialogs, reduced-motion. (Click-through findings from audit-001 finding 20 carry forward; this feature inherits them.)

## 11. Risks & honest limits

- **Single-entry heritage.** The partner ledger is precise but parallel; the "expense" leg still posts through the activity ledger. We accept this deliberately; a double-entry rewrite is out of scope and not warranted at this scale.
- **Shares ≠ deed.** The app enforces recorded shares, not legal validity. Copy states: "Hisaabook records the deed you tell it; it is not legal, tax or accounting advice" (already the footer posture).
- **Cash counting.** Counter drawings assume trust (no till-count verification in v1; a till-count feature is a future phase).
- **Tax.** Profit share belongs to partners in their own tax returns (Pakistan: AOP returns). The app surfaces figures, not tax computation — same disclaimer as salary module.
- **Multi-currency.** Whole-PKR per workspace (existing constraint); no FX handling in this scope.
- **Backfill is lossy by design.** Legacy free-text "Hamza · Capital" rows are NOT auto-attributed (false positives worse than NULLs); one-tap manual attribution instead.
- **Time precision.** Share changes are day-effective; intraday changes are out of scope (last effective_at wins).

## 12. Owner questions — resolved 2026-11-09

1. **Out-of-pocket default** → (A) advance, pre-selected. ✓
2. **Interest on capital** → strictly opt-in per workspace (all deed terms off by default). ✓
3. **Drawing cap default** → 70% of accrued distributed share, per workspace (owner did not override). ✓
4. **Partners without app accounts** → in-app/email only; no WhatsApp/SMS in this scope. ✓ (assumed)
5. **Withdrawal scope** → all account types (cash, bank, wallet). ✓ (assumed)
6. **Exit settlement** → Phase 4, PR 3. Not in PR 1/2. ✓
7. **Sole proprietorship** → Partners UI always shown; share locked at 100. ✓ (assumed)
8. **Profit frequency** → monthly-ish; month presets + month-end digest. ✓

Remaining assumptions to flag if wrong: drawing cap 70% (changeable per workspace in deed settings); effective-dating granularity is per day; ₨ whole units only.

## 13. Appendix — why not just "split expenses 50/50" or use existing CONTRIBUTION types

- Shared expenses split **equally** ignore deed PSR and day-weighting; business expense allocation is a capital/appropriation question, not a billing question.
- `CONTRIBUTION`-as-fronting loses reimburseability; `WITHDRAWAL`-as-drawing loses attribution; free-text names are unauditable.
- A full double-entry system (Bernard-style) would double the schema and migration risk for zero decision-quality gain at ₨-whole-entry scale; the sub-ledger gives every number a traceable source while reusing the proven void/audit/notification infrastructure.

---

### Research sources
- [Partnership Act, 1932 (Pakistan) — full text](https://paklawyer.com/wp-content/uploads/2019/10/Partnership-Act.-1932-1.pdf) · [mirror](https://thelex.live/wp-content/uploads/2023/07/PARTNERSHIP-ACT.1932.pdf) · [Plain-language Q&A](http://balochistanlawforum.blogspot.com/p/q.html) · [LawInsider — interest on drawings clause](https://www.lawinsider.com/clause/interest-on-partners-drawings)
- [ACCA FA2 — Accounting for partnerships](https://www.accaglobal.com/uk/en/student/exam-support-resources/foundation-level-study-resources/fa2/fa2-technical-articles/accounting-for-partnerships.html) · [ACCA F3 — Working in partnership](https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f3/technical-articles/working-partnership.html) · [Partnership firm accounting concepts & final accounts](https://www.slideshare.net/slideshow/partnership-firm-accounting-concepts-and-final-accounts/274671448) · [GeeksForGeeks — interest on drawings](https://www.geeksforgeeks.org/accountancy/interest-on-drawing-in-case-of-partnership/) · [P&L Appropriation account](https://www.championsprep.in/blog/profit-and-loss-appropriation-account/)
- [QuickBooks community — expense paid from partner's personal funds](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/my-partner-fronted-some-costs-related-to-my-business-i-m-making/00/1159968) · [Reddit r/Bookkeeping — repairs from personal funds](https://www.reddit.com/r/Bookkeeping/comments/1je7lxe/how_do_i_account_for_this_payment_from_personal/)
- [Retirement of a partner — IGP Unit 4](https://shop.igpinstitute.org/insight/wp-content/uploads/2024/12/Unit-4-Retirement-of-a-Partner.pdf) · [Admission/retirement adjustments](https://www.citycollegekolkata.org/documents/online_course_materials/20260129_bcom_partnership_account_1_financial_accounting_2_sem_3_admission_retirement_cbcs.pdf) · [KNGAC e-content — Partnership accounts](https://www.kngac.ac.in/elearning-portal/ec/admin/contents/5_18K3CO05_2020120304185956.pdf)
