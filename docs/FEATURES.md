# Feature Inventory — HisaabBook

This inventory covers the intended product, not an implementation. Priority labels are provisional: **P0** = required for a credible first pilot, **P1** = valuable soon after, **P2** = later / validate first.

## 1. Business setup and profile
| Feature | Priority | Notes |
|---|---:|---|
| Create a business workspace | P0 | Name, business type (optional), base currency, date/time preferences. |
| Solo and multi-owner modes | P0 | Collaboration is optional; no forced partnership setup. |
| Add and manage business members | P0 | Invitation, acceptance, removal, and role assignment. |
| Business profile and contact details | P1 | Optional registration/tax identifiers; protect sensitive data. |
| Multiple business workspaces per person | P1 | Keep each business's data isolated. |

## 2. People, ownership, and agreements
| Feature | Priority | Notes |
|---|---:|---|
| Owner register | P0 | Name/member identity, status, joined/effective date. |
| Ownership shares or units | P0 | Explicitly informational; total shares/percentages and effective dates. |
| Ownership change history | P0 | Preserve prior arrangements; show who recorded a change and when. |
| Record an agreement reference or attachment | P1 | Do not imply legal validation or create a binding contract. |
| Ownership/profit-sharing rules | P2 | Implemented in Hisaabook as day-weighted profit-sharing ratios (effective-dated share history, largest-remainder apportionment) for appropriation runs and exit settlements; kept separate from ownership and contributions. The original "only after discovery" gate was cleared by the owner for the pilot. |
| Roles and permissions | P0 | Owner/admin, bookkeeper/editor, viewer (final roles to validate). |
| Partner ledger (fronts, drawings, reimbursements) | P0 | Hisaabook implements this: one running hisaab per partner. Fronted business expenses credit the partner (reimbursable or count as capital), counter drawings debit them, multi-partner splits post per funding partner in one transaction. |
| Deed-configurable appropriation run | P1 | Implemented. Salary, interest on capital (capped by profit remaining after salary), interest on drawings (added back), residual shared by day-weighted PSR; POSTED/VOID with mirrored correction entries; full workings persisted per distribution. A partial unique index allows only one POSTED distribution per workspace period, so a double tap or a retry cannot post the same period twice; VOID rows are excluded so a period can be voided and re-posted. |
| Exit settlement calculator | P1 | Implemented. s.48-style order: auto-post any unposted distribution first, revaluation lines shared by exit-date PSR, goodwill methods (raise-and-write-off in old PSR, or cash adjustment borne by remaining partners), settle as payment or loan, partner marked exited, ledger closes to zero, unpaid balance booked as a loan. |
| Partner statements and CSV export | P0 | Implemented. Per-partner dated statement (print-friendly + CSV) with opening/closing balances; workspace-level movements CSV; distribution history CSV. The print view is laid out for A4 with repeating table headers. |
| Exit terms and settlement default in deed settings | P1 | Implemented. Workspace-level deed settings (salary, interest toggles and rates, drawing cap, settlement method); plain-language copy; deed silent means off, nothing is invented. |
| Drawing cap guard and monthly partner digest | P2 | Implemented. Drawings over the cap warn (never block) with the numbers and an audit flag; monthly cron summarizes partner money in/out. |
| Demo workspace seed | P2 | The public demo seeds partner movements, a clearing account and last month's posted distribution on first login. Seeding is claimed once per workspace in a `seed_claims` primary key, so concurrent first visits cannot seed twice; a failed seed releases its claim (retryable) and records a `DEMO_PARTNER_SEED_FAILED` audit row. |
| Legacy unattributed entries | P1 | Implemented. Contribution/withdrawal rows recorded before partners existed stay unlinked and are listed as "Unattributed (pre-partners)" on the Partners page (owners and admins only). One-tap tagging links the activity row to a partner, posts the matching sub-ledger entry (contribution to capital, withdrawal to a counter drawing) and writes a LEGACY_ATTRIBUTED audit event, all in one database transaction. Nothing is guessed from names or descriptions; a tagged row is immutable and drops out of the tray. |
| Record review/approval workflow | P1 | Optional business policy; do not make a simple solo flow cumbersome. |

## 3. Transactions and ledger
| Feature | Priority | Notes |
|---|---:|---|
| Income and sales receipts | P0 | Separate from loans and owner funding. |
| Expenses and bills paid | P0 | Category, payee, account, date, description, proof. |
| Owner contributions/investments | P0 | Record cash or supported non-cash contributions; no automatic share change. |
| Owner withdrawals/drawings | P0 | Not silently classified as business expenses. |
| Loans received | P0 | Lender, principal, date, due date/terms and outstanding amount. |
| Loans given / receivables | P0 | Borrower, principal, repayments, remaining amount. |
| Loan repayments | P0 | Principal and any explicit fee/interest components separately. |
| Internal transfers | P0 | Between business cash/bank accounts; excluded from income and expense totals. |
| Opening balance and adjustment | P0 | Explain source and effective date; audit the adjustment. |
| Refunds, reversals, and corrections | P0 | Keep original and correction/reversal history. |
| Categories and tags | P0 | Useful defaults plus custom categories. |
| Counterparty, payer/payee, and participating owner | P0 | Optional when not applicable. |
| Notes and attachments/receipts | P0 | File-size/access/retention policies needed. |
| Recurring transactions | P1 | Reminders or templates; avoid silently posting an unverified transaction. |
| Split transaction across categories/accounts | P1 | Validate usability and accounting model. |
| Multi-currency transaction support | P1 | Define exchange rate, conversion date, and reporting currency. |
| Draft transaction | P1 | For entries awaiting review or more evidence. |

## 4. Loans and obligations
| Feature | Priority | Notes |
|---|---:|---|
| Loan/receivable register | P0 | Current and settled obligations. |
| Repayment schedule and reminders | P1 | Optional due dates and reminders; no automated collections. |
| Partial repayment tracking | P0 | Balance updates from explicit repayment records. |
| Loan terms and supporting documents | P1 | Notes and attachments; not legal advice. |
| Payables and receivables beyond loans | P1 | Bills due to suppliers and customer amounts owed. |
| Interest/fees | P1 | Explicit, transparent treatment; never infer automatically. |

## 5. Accounts and cash position
| Feature | Priority | Notes |
|---|---:|---|
| Cash, bank, wallet, and custom accounts | P0 | Display balances and transaction history. |
| Account transfers | P0 | Avoid double-counting as income/expense. |
| Account reconciliation | P1 | Compare app records with a statement or counted cash. |
| Bank statement import/integration | P2 | Security, consent, and local provider availability need validation. |
| Personal funds used for business | P1 | Capture whether treated as reimbursable expense, contribution, or loan. |

## 6. Dashboards, reports, and exports
| Feature | Priority | Notes |
|---|---:|---|
| Business overview | P0 | Cash/account balances, recent activity, loans, period totals. A "This month, explained" card repeats the reports' income, expense and difference figures with the same counting rules, so the dashboard and the reports cannot disagree. The balance hero leads with the total, carries a 7/30/90 day range switch and a running net-movement curve (cleared income minus cleared expenses, zero line drawn, net total stated), then the month's income and spend. The curve is net rather than in-versus-out so it shows direction rather than restating the bar chart card below it. |
| Income and expense summary | P0 | Implemented at `/reports`: date range with presets, income and expense categories with shares, cash in and out per account, an explicit "kept out of income and expenses" table, owner money and transfers listed apart, pending and voided counts, and the counting rules printed under every report. CSV matches the screen. |
| Cash movement report | P0 | Implemented inside the summary report: cleared inflow and outflow per account for the range. Internal transfers are excluded and labelled as such, because counting both legs would inflate every total. |
| Owner contributions and withdrawals | P0 | Implemented in the summary report and on the Partners page. Reports show them in their own table, never inside income or expenses. |
| Loan/receivable balances | P0 | Overview lists each loan with principal, repaid and outstanding. Reports add the fee and principal split of repayments in the range. |
| Ownership register and effective history | P0 | Partners page. Reports never derive ownership from any balance. |
| Search, filters, and date ranges | P0 | Transactions page. Reports add quick ranges: this month, last month, last 30 days, this quarter, this year, or a custom pair of dates. |
| CSV export | P0 | Ledger, partner movements, statements, distributions, and all four reports export the exact payload on screen, with the range and counting rules in the file header. Salary CSV is limited to owner, admin, and payroll roles. |
| Human-readable statement/report | P1 | Reports are print-ready: report cards and tables print on A4 with headers repeating across pages and without the app chrome. |
| Profit and loss summary | P1 | Implemented as "Profit summary" with its basis stated in the UI and the CSV: only cleared records, loan fees treated as costs and fee income as income, principal and owner money excluded, salaries and stock counted once at payment, and partner profit shares listed as an appropriation rather than an expense. Labelled informational, not audited accounts. |
| Custom reports and scheduled exports | P2 | Not built. A report link carries its range and type in the URL, which is the building block if demand appears. |

## 7. Collaboration, trust, and auditability
| Feature | Priority | Notes |
|---|---:|---|
| Per-user identity and invitations | P0 | Do not rely on a shared account for collaboration. |
| Attribution on every record | P0 | Creator, created time, last editor, and record history. |
| Audit log | P0 | Changes, reversals, ownership updates, permission changes, exports. |
| Flag a transaction / request correction | P0 | Track status, author, comments, and resolution. |
| Approval thresholds or dual approval | P1 | Configurable by business; retain audit trail. |
| Notifications | P1 | Invitations, review requests, loan due reminders, optional activity updates. |
| Comments/discussion on a record | P1 | Keep business discussion tied to the source transaction. |
| Downloadable activity history | P2 | For audit and dispute review. |

## 8. Localization, accessibility, and security
| Feature | Priority | Notes |
|---|---:|---|
| PKR default and local number formatting | P0 | One money form product-wide: `PKR 519,850` (integer, en-PK grouping), including masked balances (`PKR ••••••`). The rupee glyph is not used because most display fonts fall back to an `Rs` monogram that reads as a second currency next to `PKR`. Rule lives in `lib/format.ts`. |
| Pakistan-friendly date display | P0 | Consistent timezone and unambiguous stored date. |
| English-first content with Urdu/RTL readiness | P0 | Validate actual language and RTL launch scope with users. |
| Responsive, low-friction mobile experience | P0 | Core entry and review flows usable at 320px and up. The bottom pill centres with left/right insets (never a translate plus a scroll container) and carries Home, Activity, Stock, Team, Alerts and a Menu button; under 390px it tightens padding and drops the Menu label so six items still clear a 320px screen. Everything the pill cannot hold (Partners, Reports, the remaining workspace links, profile and sign out) lives in the mobile menu sheet, because the desktop sidebar is `display: none` below 901px. Quick actions are swipeable (`touch-action: pan-x pan-y`). Two-column overview/report grids state `grid-cols-1` explicitly so an `auto` track cannot size to the long quick-actions row; hero chips drop to one column under 400px; the bottom pill nav reserves 94px plus the device inset below content; captions hold a 9px floor. Guarded by `lib/anti-slop/mobile-overview.test.ts`. |
| Accessible labels, contrast, and non-color status cues | P0 | Include assistive technology and keyboard considerations. |
| Secure sign-in and session controls | P0 | Final authentication design requires security review. |
| Least-privilege data access | P0 | Business-level membership boundaries. |
| Data export, retention, and deletion controls | P0 | Define policies before pilot. |
| Backup and recovery | P0 | Operational requirement before relying on records. |
| Offline transaction capture | P2 | Conflict and sync behavior require careful design. |

## 9. Inventory management (planned follow-on)
| Feature | Priority | Notes |
|---|---:|---|
| Item catalogue | P1 | Item name, optional SKU/barcode, category, unit of measure, active status, and optional description. |
| Record stock received | P1 | Quantity, date, source/vendor, unit and optional purchase cost/evidence; connect to a purchase transaction to prevent duplicate financial entries. |
| Record stock sold, used, or issued | P1 | Quantity, date, reason/customer where relevant; stock movement is distinct from the money transaction. |
| Returns and adjustments | P1 | Dated, attributable movement with reason; preserve history rather than overwriting counts. |
| On-hand stock and movement history | P1 | Show current quantity by item and a ledger of receipts/issues/returns/adjustments. |
| Stock movement report | P1 | Implemented at `/reports`: opening, received, issued and closing quantity per item for the range, reorder flags, and the cash actually spent on linked stock purchases. Quantities only; stock is deliberately not valued until a valuation method is reviewed. |
| Low-stock threshold and alert | P1 | Per-item reorder point; no automated purchase order in the first inventory release. |
| Stock count/reconciliation | P1 | Compare counted quantity to recorded quantity and record an approved adjustment. |
| Multiple storage locations | P2 | Validate need and transfer semantics before implementation. |
| Inventory valuation and cost of goods sold | P2 | Requires an explicit, reviewed valuation method and must not be presented as audited accounting. |
| Expiry, batches, variants, serial numbers | P2 | Validate by target business type before adding complexity. |

## 10. Employee and salary tracking (planned follow-on)
| Feature | Priority | Notes |
|---|---:|---|
| Employee directory | P1 | Name, optional employee reference, role/job title, start/end dates, status, and contact details only where needed. |
| Effective-dated pay rates | P1 | Monthly salary initially; retain prior rate and effective date when compensation changes. |
| Salary periods | P1 | Define pay period and due date, amount due, and status (unpaid, partially paid, paid). |
| Record salary payment | P1 | Date, amount, payment account/method, and reference; support partial payments and remaining payable. |
| Salary expense and payable summaries | P1 | Implemented at `/reports`: salary due, paid and outstanding per employee period, with the basis stated. Payments are expensed when paid, so the salary report reports the obligation beside the payment and never adds to expenses a second time. Restricted to owner, admin and payroll roles. |
| Employee-level access restrictions | P1 | Payroll/owner-authorized roles only; do not expose another employee's salary to ordinary workspace members. |
| Employee advances | P2 | Link to a separately tracked advance/receivable and repayment history; do not silently net against salary. |
| Hourly/daily wages, commissions, bonuses, deductions | P2 | Validate demand and local rules; show each component explicitly if supported. |
| Payslip generation and payroll exports | P2 | Informational record only until reviewed for local requirements and privacy. |
| Automated payroll calculation, statutory deductions, tax filing, or bank disbursement | Out of scope | Do not claim compliance or provide tax/legal advice; require separate professional and security review. |

## 11. Other potential later modules
- Invoicing and customer statements.
- Tax preparation integrations or accountant collaboration.
- Budgeting, forecasts, and cash runway.
- Branches, multiple legal entities, and consolidation.
- Payment initiation or bank feeds.

Any financial, legal, tax, or compliance-related module requires targeted discovery and qualified review before being represented as authoritative.

## 12. Notifications and alerts

Hisaabook ships an in-app notification center and optional Web Push alerts. Both are workspace-scoped; reading state is per user.

| Feature | Priority | Notes |
|---|---:|---|
| In-app notification center | P1 | Bell in the sidebar footer (desktop) and in the bottom pill nav (mobile). Today/Earlier grouping, unread rail, optimistic mark-read, `Mark all read`, cursor-paginated history, 25 s polling gated by tab visibility with focus revalidate. |
| Notification triggers | P1 | Transactions posted/voided, loan repayments, inventory movements and low-stock, team archive/reactivate, salary periods paid and low-coverage pay, workspace member add/remove/role change, invitation create/accept/decline. |
| Smart reminders (cron) | P1 | Daily Vercel Cron (`/api/cron/reminders`, Hobby plan once per day, `0 8 * * *`): salary due within 7 days (dedupe per user+period), overdue/undelivered salary payment detection, low-stock items. Fail-closed: returns 503 without `CRON_SECRET`; Vercel calls it with a Bearer token. |
| Web Push (browser + installed PWA) | P1 | `public/sw.js` push-only service worker; VAPID keys in env; per-device enrollment in the notification panel footer and a one-time first-save permission prime. Supports Chrome/Edge/Firefox/Safari and iOS/iPadOS 16.4+ home-screen PWAs (install sheet shown when needed). Dead endpoints (404/410) are pruned automatically. |
| Opt-out and honesty | P0 | Push is strictly opt-in per device. Toggles, iOS install instructions and blocked-permission states are surfaced in the panel; `SW push` degrades silently to in-app only when VAPID is unconfigured. |

Out of scope (v1): email/SMS/WhatsApp notifications, push-based document delivery, rich notification images, per-category mute preferences, and offline data caching (the service worker is push-only).
