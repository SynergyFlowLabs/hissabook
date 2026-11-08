# Product Requirements — HisaabBook

**Status:** Draft for discovery and design  
**Related document:** [PRD.md](PRD.md)

The requirements below describe expected product behavior. They do not prescribe a technical implementation. **P0** marks a first-pilot requirement; **P1** marks a follow-on requirement. All requirements remain subject to user research and professional review.

## 1. Account and business workspace

| ID | Priority | Requirement | Acceptance criteria |
|---|---:|---|---|
| ACC-01 | P0 | A user can create a private business workspace. | The user can enter a business name, select a base currency (PKR by default), and set applicable date/time preferences; the workspace is not visible to non-members. |
| ACC-02 | P0 | A workspace supports a single owner or multiple owners. | Setup does not require more than one owner; solo users can access the same core ledger and reports. |
| ACC-03 | P0 | A business owner can invite another person to the workspace. | An invitee must accept before accessing business data; pending and revoked invitations are distinguishable. |
| ACC-04 | P0 | Workspace members have roles and permissions. | A member can only perform actions allowed by their role; the business owner can review and change a member's access. |
| ACC-05 | P0 | Business data is isolated between workspaces. | A member of one business cannot view or alter another business's records without an explicit membership. |
| ACC-06 | P1 | A user can manage more than one business. | Switching businesses makes the active workspace obvious and prevents cross-business record entry. |

## 2. Ownership register

| ID | Priority | Requirement | Acceptance criteria |
|---|---:|---|---|
| OWN-01 | P0 | A workspace can record one or more owners. | Each owner entry identifies a person and its effective date/status. |
| OWN-02 | P0 | A workspace can record ownership as percentages or units. | The representation is explicit, and the product does not derive ownership from contribution amounts or balances. |
| OWN-03 | P0 | Ownership changes are versioned. | A change records its effective date, actor, and prior value; previous arrangements remain viewable. |
| OWN-04 | P0 | The product distinguishes ownership from contributions, loans, cash, and profit. | Relevant screens and reports label these separately and do not infer one from another. |
| OWN-05 | P0 | Ownership records include an informational disclaimer. | Users are told that recording an arrangement does not verify legal status or create a legal agreement. |
| OWN-06 | P1 | A user can attach or reference supporting agreement evidence. | Access follows business permissions; the file or reference is linked to a dated ownership record. |

## 3. Transaction ledger

| ID | Priority | Requirement | Acceptance criteria |
|---|---:|---|---|
| TXN-01 | P0 | An authorized member can create a transaction. | A saved record has a unique identity, business, transaction type, amount, date, account, description, creator, and creation timestamp. |
| TXN-02 | P0 | The ledger supports income, expense, contribution/investment, withdrawal/drawing, loan received, loan given, repayment, transfer, opening balance, and adjustment types. | Users can select a distinct type; totals and labels do not combine semantically different types by default. |
| TXN-03 | P0 | A transaction can include category, counterparty, payer/payee, owner, payment method, notes, and attachments where relevant. | Optional fields can be left blank; entered fields are visible on the transaction detail. |
| TXN-04 | P0 | The user can review a plain-language transaction summary before saving. | The summary makes direction, amount, category/type, account, and date understandable. |
| TXN-05 | P0 | A user can search and filter ledger records. | Results can be narrowed by date range, type, account, category, owner, counterparty, and status where available. |
| TXN-06 | P0 | A transaction can be corrected without erasing its history. | The original value and correction actor/time remain auditable; users can see the current value and prior change. |
| TXN-07 | P0 | A transaction can be reversed or voided. | It remains in history with a reason/status and is excluded or included in summaries according to a clearly disclosed rule. |
| TXN-08 | P0 | The app prevents internal transfers from being treated as income or expense. | A transfer links the source and destination accounts and is represented as cash movement only. |
| TXN-09 | P0 | Owner contributions and withdrawals are not automatically treated as revenue or expenses. | They appear in dedicated views and are excluded from ordinary income/expense totals unless explicitly reclassified with an audited change. |
| TXN-10 | P0 | Amounts and currencies are unambiguous. | The currency is visible with the amount; the system does not silently add different currencies into a single total. |
| TXN-11 | P0 | Each record identifies its creator and relevant history. | Users with permission can see who created or changed the record and when. |
| TXN-12 | P1 | A user can create a draft for later completion or review. | Drafts are clearly distinguished from posted records and are not included in posted totals. |
| TXN-13 | P1 | A transaction may be split across categories or accounts. | The displayed total reconciles to the split lines and the split is retained in the transaction history. |

## 4. Loans and amounts owed

| ID | Priority | Requirement | Acceptance criteria |
|---|---:|---|---|
| LOAN-01 | P0 | Users can record a loan received or a loan given. | Each loan identifies principal, lender, borrower, date, currency, and business relationship. |
| LOAN-02 | P0 | Users can record a due date and notes/terms. | These fields are optional; when present they are visible on the loan detail. |
| LOAN-03 | P0 | Users can record full or partial repayments. | Repayments are separate dated records linked to the loan; outstanding principal is recalculated transparently. |
| LOAN-04 | P0 | The app shows outstanding loan balances separately from income and expenses. | A loan principal is not counted as revenue or expense by default; due and settled obligations are distinguishable. |
| LOAN-05 | P0 | Fees, interest, or adjustments are explicit. | The app does not infer or silently add charges; each amount has a separately identified type and date. |
| LOAN-06 | P1 | The app can show upcoming and overdue obligations. | Users can review due dates and outstanding amounts; reminders are optional and configurable. |
| LOAN-07 | P1 | Users can track other receivables and payables. | Amounts owed by customers or to suppliers have counterparty, due amount/date, and settlement history. |

## 5. Accounts and summaries

| ID | Priority | Requirement | Acceptance criteria |
|---|---:|---|---|
| ACT-01 | P0 | A workspace can define business cash/bank/wallet accounts. | Each account has a name and currency; users can view its transaction history and current recorded balance. |
| ACT-02 | P0 | A workspace can record a dated opening balance. | The amount and as-of date are visible and the record is attributable. |
| ACT-03 | P0 | The overview shows account balances and recent activity. | The selected business and relevant date/context are clear; the overview distinguishes balances from period totals. |
| RPT-01 | P0 | Users can view income and expense summaries for a date range. | Summary definitions and excluded transaction types are available to users. |
| RPT-02 | P0 | Users can view cash movement by account and period. | Inflows, outflows, and transfers are represented without double-counting internal transfers as business income/expense. |
| RPT-03 | P0 | Users can view owner contributions and withdrawals by owner and period. | Results do not imply ownership percentage or profit share. |
| RPT-04 | P0 | Users can view loan/receivable balances. | The report includes original principal, repayments, current balance, and due information when supplied. |
| RPT-05 | P0 | Users can view the current ownership register and prior effective arrangements. | Ownership is not presented as a bank balance, contribution total, or guaranteed profit entitlement. |
| RPT-06 | P0 | Users can export permitted records. | Export follows workspace access permissions and selection criteria; users see the export's scope and date range. |
| RPT-07 | P1 | The app can provide a profit-and-loss style summary. | Calculation and recognition limitations are visible; the product does not represent an informal summary as audited accounts. |

## 6. Inventory management

| ID | Priority | Requirement | Acceptance criteria |
|---|---:|---|---|
| INV-01 | P1 | An authorized member can create and maintain an inventory item. | The item has a name, unit of measure, active status, and optional SKU/category/description and reorder threshold. |
| INV-02 | P1 | A member can record stock received. | A receipt records item, quantity, date, source/counterparty, actor, and optional unit cost/evidence; receipt history is retained. |
| INV-03 | P1 | A member can record stock sold, used, issued, or returned. | Each movement records item, signed quantity/direction, date, reason/reference, and actor; stock movement is not mistaken for cash income/expense. |
| INV-04 | P1 | Stock corrections are recorded as adjustments rather than silent quantity edits. | An adjustment requires a reason and actor and preserves the previous quantity and movement history. |
| INV-05 | P1 | The app displays on-hand quantity and movement history per item. | The current quantity reconciles to the opening quantity plus recorded movements; unit of measure is always visible. |
| INV-06 | P1 | The app warns when a stock movement would take an item below zero. | Negative stock is blocked by default; any permitted override requires appropriate permission and a reason. |
| INV-07 | P1 | An item can have a low-stock threshold. | The UI identifies items at or below their threshold; it does not create an order or claim stock is available from an external vendor. |
| INV-08 | P1 | A stock receipt may reference a related purchase transaction. | The link is visible in both records and does not create a duplicate cash movement or expense. |
| INV-09 | P2 | Users can manage multiple stock locations. | A transfer between locations reduces one location and increases another without changing business-wide quantity. |
| INV-10 | P2 | The app can provide stock valuation or cost-of-goods-sold summaries. | A disclosed and professionally reviewed method is required; results are not presented as audited accounts. |

## 7. Employee and salary tracking

| ID | Priority | Requirement | Acceptance criteria |
|---|---:|---|---|
| EMP-01 | P1 | An authorized user can create and maintain an employee record. | The record supports name, job title, optional internal reference, start/end date, and active/inactive status; unnecessary personal data is not required. |
| EMP-02 | P1 | The business can record an effective-dated pay rate. | Initial release supports an agreed monthly salary; changes preserve the old rate and its effective dates and do not rewrite past salary periods. |
| EMP-03 | P1 | An authorized user can create a salary period. | The record identifies the employee, period start/end, due date, amount due, currency, and status (unpaid, partially paid, or paid). |
| EMP-04 | P1 | A salary period supports one or more payments. | Each payment has a date, amount, account/method, and optional reference; the unpaid balance is calculated as amount due minus recorded payments. |
| EMP-05 | P1 | Salary due, salary paid, and salary expense are distinguishable. | The product explains its reporting basis and links payments to their salary period to prevent double-counting in cash and expense summaries. |
| EMP-06 | P1 | Salary and employee data is protected by dedicated permissions. | Only owner/payroll-authorized roles can see or change compensation; ordinary workspace members cannot browse individual salary details by default. |
| EMP-07 | P1 | Pay-rate and salary-period changes retain an audit history. | The history identifies actor, timestamp, previous value, new value, and reason where applicable. |
| EMP-08 | P1 | The business can review salary obligations by employee and period. | Authorized users can filter by employee, period, due date, and payment status and export only with permission. |
| EMP-09 | P1 | The product does not calculate statutory deductions or claim payroll compliance. | Any supported deduction is explicitly entered and identified; the UI does not describe the output as tax/legal advice or compliant payroll. |
| EMP-10 | P2 | Employee advances can be tracked. | Advances are separate linked obligations and are not silently netted against salary; repayments remain visible. |
| EMP-11 | P2 | Hourly/daily wages, commissions, bonuses, and payslips may be supported. | Rules, calculations, access, and local professional review are defined before a feature is presented as authoritative. |

## 8. Collaboration, review, and audit

| ID | Priority | Requirement | Acceptance criteria |
|---|---:|---|---|
| COL-01 | P0 | Users can flag a transaction for review. | A flag has a reason, author, timestamp, status, and resolution note; the linked transaction stays accessible. |
| COL-02 | P0 | Authorized users can request a correction. | The request is linked to the record and has a visible outcome; no unapproved silent replacement occurs. |
| COL-03 | P0 | Material actions are logged. | Transaction changes/reversals, ownership changes, permission changes, and exports record actor and time. |
| COL-04 | P0 | A removed member loses future access. | Access is revoked without rewriting the member's historical attribution on records. |
| COL-05 | P1 | A business can require review/approval for selected records. | The business can identify pending versus approved records; the policy and effect on summaries are clearly explained. |
| COL-06 | P1 | Members can comment on a transaction. | Comments retain author and time and are visible only to authorized workspace members. |

## 9. Localization, privacy, and operational quality

| ID | Priority | Requirement | Acceptance criteria |
|---|---:|---|---|
| NFR-01 | P0 | The experience is usable on common mobile screen sizes. | Core setup, transaction entry, review, and report flows remain usable without horizontal scrolling at supported mobile widths. |
| NFR-02 | P0 | Currency and date presentation is localized for the business. | PKR is the default for a Pakistan-based setup; formatting and timezone are consistent and unambiguous. |
| NFR-03 | P0 | Urdu/RTL support is planned and validated before claiming availability. | Where Urdu is supported, layout direction, numerals, labels, forms, and exported content are tested end-to-end. |
| NFR-04 | P0 | Only authorized members can access workspace data. | Access is denied by default to non-members and is verified across screens, exports, and attachments. |
| NFR-05 | P0 | Sensitive records and attachments are protected. | Security review defines protections in transit and at rest, permission checks, backup, retention, and recovery before pilot. |
| NFR-06 | P0 | Users can understand data export and deletion behavior. | Policies identify what is exported/deleted, who can do it, and any retention constraints before launch. |
| NFR-07 | P0 | The product avoids unsupported legal, accounting, and tax claims. | UI and documentation state that records are informational and are not legal verification, audit, or professional advice. |
| NFR-08 | P0 | Status and transaction meaning are not communicated by color alone. | Text labels/icons and accessible names communicate status and direction. |
| NFR-09 | P1 | The product remains understandable under slow or intermittent connectivity. | Research identifies minimum viable behavior and users receive clear feedback when an action has not been saved. |

## 10. Cross-cutting rules and edge cases
- A business can have one owner; owner count must not gate ledger usage.
- A person can be an owner, lender, borrower, payer, or payee in different contexts. Those roles must not be conflated.
- A contribution is not automatically a loan; a loan is not automatically an investment; the user must choose and records must preserve that choice.
- Recording a contribution does not change ownership. An ownership change requires a separate, dated action.
- A repayment reduces an obligation; it is not automatically an expense or income. Any explicit fee/interest is represented separately.
- Transfers between business accounts affect balances but not income/expense totals.
- Negative values, refunds, corrections, voids, and duplicate-looking transactions need explicit, understandable handling and an audit trail.
- Reports must state the business, currency, selected period, and calculation basis.
- Inventory counts are derived from the movement ledger; count corrections require a reason and must retain history.
- A linked stock purchase and inventory receipt must not double-count cash movement or expenses.
- Salary amounts, salary payment, and unpaid balance are separate facts; link salary payments to the relevant period to avoid double-counting.
- Employee compensation is confidential and limited to authorized roles; removal or deactivation of an employee must not erase salary history.
- A collaborator's removal must not erase historical records or attribution.
- If an amount's currency differs from the business currency, conversion and any exchange-rate assumptions must be explicit before aggregation.

## 11. Validation checklist before pilot
- Interview solo operators and multi-owner businesses, including informal ventures, in the intended launch communities.
- Test the distinction between income, contribution, loan, withdrawal, transfer, and ownership with representative scenarios.
- Validate commonly used categories, account types, transaction language, and evidence/receipt practices.
- Test inventory receipts, issues, returns, stock counts, negative-stock prevention, low-stock thresholds, and financial links with representative retailers/service businesses.
- Test monthly salary setup, effective-dated rate changes, partial and late payments, access control, and report calculations with employers and payroll professionals.
- Review local privacy, employee data handling, payroll, salary record retention, consumer, financial record retention, and business/legal wording with qualified Pakistan-based professionals.
- Conduct permission, data export, attachment, backup/restore, and deletion tests.
- Test workflows on low-cost mobile devices and the intended network conditions.
- Confirm that exported records are useful to users and their accountants without overstating their accounting status.
