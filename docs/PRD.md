# Product Requirements Document — HisaabBook

**Status:** Draft  
**Product:** HisaabBook (working name)  
**Initial market:** Pakistan  
**Document owner:** Product team  
**Last updated:** 8 November 2026

## 1. Summary

HisaabBook is a simple, trustworthy business-records app for businesses of every size and ownership model. A single person can use it to understand their business finances; friends, family, or formal partners can use it together to maintain a shared record and reduce disagreements. It records the business's financial activity—not just partnership shares—including income, expenses, owner contributions and withdrawals, investments, loans, transfers, and other adjustments. Planned business-management modules also cover stock/inventory and employee records with salary obligations and payments. Ownership, cash, inventory, and profit concepts remain distinct.

The product is intended to improve day-to-day record keeping and shared understanding. It is not, by itself, a bank, payment processor, tax filing service, legal agreement, or substitute for a qualified accountant or lawyer.

## 2. Problem

People starting businesses in Pakistan often begin informally with friends or relatives, or start as a sole owner. They may record activity across notebooks, chat messages, personal bank accounts, and spreadsheets—or not record it at all. Later, they can disagree about what was paid, who contributed or borrowed money, who owns what, whether an amount was a loan or investment, and how much the business earned. Incomplete records make it difficult to understand cash position, settle obligations, and make decisions.

Existing bookkeeping tools can feel overly complex for small businesses, and a simple expense tracker does not capture the relationships and obligations behind business transactions.

## 3. Product vision

Make clear, dependable business records accessible to a single founder or a team, so everyone can understand what happened, why it happened, and what remains owed—without needing accounting expertise to get started.

## 4. Goals and success measures

### Goals
- Let a user create and maintain a business ledger with minimal setup.
- Support both single-owner and multi-owner businesses without forcing a partnership model.
- Capture the full lifecycle of common money movements and business obligations.
- Make every record understandable, attributable, reviewable, and correctable without silently losing history.
- Help owners see balances, cash flow, outstanding loans, and ownership information in one place.
- Give businesses a reliable record of stock on hand and employee salary obligations/payments, without implying automated payroll or inventory valuation advice.
- Work for Pakistan-based businesses, including local currency, dates, language, and low-friction mobile use.

### Initial success measures (validate with research)
- Percentage of newly created businesses that record at least one transaction in their first session.
- Weekly active businesses and transactions recorded per active business.
- Percentage of transactions with a category, date, and relevant person/counterparty recorded.
- Percentage of invited collaborators who accept and contribute a record.
- Time to record a routine transaction.
- User-reported confidence that records are complete and understandable.
- Correction/dispute rate and the number of records with unresolved review requests.
- Inventory-record completeness and frequency of unexplained stock adjustments.
- Percentage of salary periods with an amount, due date, and settlement status recorded.

Targets should be set after baseline discovery and usability testing; do not treat unvalidated target numbers as commitments.

## 5. Users and jobs to be done

### Primary users
1. **Solo owner / founder** — needs a clear record of business income, costs, cash, assets, debts, and owner withdrawals without collaboration features getting in the way.
2. **Co-founders / friends in an informal venture** — need shared, transparent records of contributions, spending, loans, income, and agreed ownership.
3. **Bookkeeping owner / administrator** — enters transactions, organizes records, and prepares summaries for owners or an accountant.
4. **Business participant / owner** — reviews records, sees their own contributions and obligations, and raises a question or correction request.
5. **Inventory manager / shop operator** — records stock received, sold, used, returned, or adjusted and checks reorder needs.
6. **Employer / payroll administrator** — maintains employee details and agreed pay rates, tracks each salary period, and records full or partial salary payments.

### Jobs to be done
- When money enters or leaves my business, I want to record what it was for and who was involved, so that I can explain the transaction later.
- When an owner puts money into the business, I want to label it correctly as capital, a loan, or another agreed type, so that it is not mistaken for sales or ownership.
- When business money is owed or lent, I want to track the original amount, repayments, due dates, and remaining balance.
- When we agree on ownership, I want the current shares and the effective date recorded, so that everyone can see the same agreement history.
- When I review the business, I want to know income, expenses, cash movement, receivables, payables, and outstanding loans without confusing these with profit or ownership.
- When a record is wrong, I want a transparent correction trail rather than an invisible edit.
- When stock arrives, is sold, or is used, I want quantities and movement history updated so I can see what is on hand and what needs replenishing.
- When an employee's pay is due, I want the agreed rate, salary period, amount due, and payments recorded separately so I can see what remains unpaid.

## 6. Product principles
- **Clarity over accounting jargon:** Use plain language first, with optional detail for experienced users.
- **One ledger, distinct meanings:** Income, expense, capital, loan, owner draw, and transfer must not be interchangeable labels.
- **Shared visibility with accountability:** Show who created, edited, approved, or disputed a record, subject to permissions.
- **History is preserved:** Corrections, reversals, and ownership changes retain an audit trail.
- **Useful for one or many:** Collaboration is optional; a sole proprietor should get a complete product.
- **Local by design:** Start with Pakistan-relevant defaults without making unsupported assumptions about legal, tax, or religious requirements.

## 7. Scope

### MVP
- Business workspace with single-owner and multi-owner setup.
- Member invitations and basic role/permission controls.
- Transaction ledger with create, view, search/filter, and transparent correction or reversal.
- Transaction categories for income, expenses, owner contributions/investments, owner withdrawals/drawings, loans received, loans given, loan repayments, transfers, and opening balances/adjustments.
- Amount, currency (PKR default), date, description, category, paid/received by, counterparty, payment account/method, optional attachment, and notes.
- Basic accounts/cash locations (cash, bank, wallet, or custom) and transfers between them.
- Loan tracking with lender/borrower, original amount, repayment history, due date, and outstanding amount.
- Owner register: owners, agreed ownership percentages or units, effective date, and change history. Ownership is recorded separately from transaction balances.
- Business overview and basic reports: income and expenses over a date range, cash movement/account balances, owner contributions and withdrawals, and loan balances.
- Export/shareable records (CSV and a readable statement/report) with access controls.
- Activity/audit history and a way to flag a record for review.
- Urdu/English-ready content and Pakistan-friendly date, number, and currency presentation; actual language coverage to be validated.

### Planned follow-on modules (P1 unless noted)
- **Inventory management:** item catalogue, units, stock receipts/issues/adjustments, movement history, and low-stock thresholds. Multi-location stock and valuation/COGS reporting are later (P2) pending accounting-model validation.
- **Employee and salary tracking:** employee directory, effective-dated salary/pay-rate history, salary periods, and paid/part-paid/unpaid balances. This is record keeping, not automated payroll.

### Not in the initial release / not promised by the product
- Automated salary calculation/disbursement, statutory deductions or tax withholding, tax return submission, or claims of payroll-law compliance.
- Bank integrations, automated payment collection, invoicing, or point of sale.
- Inventory valuation or cost-of-goods-sold calculations presented as formal accounts without a validated accounting method.
- Automated tax, legal, valuation, or Shariah-compliance advice.
- Binding digital partnership contracts or legal verification of ownership.
- Full enterprise accounting, consolidation, multi-entity accounting, or configurable double-entry controls unless later validated.
- Public social feed, investment marketplace, or credit scoring.

## 8. Key concepts and accounting semantics
- **Business:** A workspace and its records; can have one or more owners.
- **Transaction:** A dated, attributable business event. At minimum it records direction/type, amount, business account, category, and description.
- **Income:** Revenue earned/received by the business; not an owner contribution or loan.
- **Expense:** A cost incurred by the business; distinguish expense from a purchase of a longer-term asset where supported.
- **Owner contribution / investment:** Funds or assets an owner contributes. This is not revenue and does not automatically change ownership.
- **Owner withdrawal / drawing:** Value taken out by an owner. This is not automatically an expense and does not automatically change ownership.
- **Loan:** An obligation with a lender, borrower, and outstanding principal. A loan is not income or ownership. Track repayments separately; treatment of interest/fees must be explicit and user-entered, not inferred.
- **Ownership share:** An agreed stake in the business, represented as percentage or units and effective from a date. It is not the same as cash contributed, current account balance, or profit entitlement. The app must not infer one from another.
- **Transfer:** Movement between the business's own cash/bank accounts. It is not income or expense.
- **Profit:** A report calculation based on configured income and expense recognition; must be labeled as an estimate or bookkeeping summary unless the business has configured adequate accounting treatment. Cash balance is not profit.
- **Inventory item and movement:** A product/material with a unit of measure and a dated quantity movement (receipt, issue, return, or adjustment). Stock quantity is not itself cash or profit; valuation requires an explicit method.
- **Employee and salary period:** An employee record plus an agreed, effective-dated pay rate and a dated pay period. Amount due, amount paid, and remaining amount are distinct; salary data is sensitive and access-controlled.

## 9. Core user flows
1. **Set up a business:** Enter business name, currency, timezone/date format, and whether there is one owner or multiple owners. Add owners and optionally record agreed shares and effective date. Clearly explain that this is a record, not legal verification.
2. **Record a transaction:** Choose a transaction type; enter amount, date, account, category, description, and optional people/attachment; review a plain-language summary; save.
3. **Record a loan:** Identify lender and borrower, principal, date, due date and terms/notes; record each repayment or adjustment; review remaining balance.
4. **Review and resolve:** Open a record, inspect its author and history, flag it or request a correction, and keep the original record visible until resolved.
5. **Review business health:** Select a period and inspect income, expenses, cash balances and movements, loans, owner contributions/withdrawals, and ownership register as separate views.
6. **Export records:** Select business and date range, choose a report/export, and confirm who can access the generated file.
7. **Manage inventory (planned):** Create an item with a unit; record stock received, used/sold, returned, or adjusted; review on-hand quantity, movement history, and low-stock items.
8. **Track employee salary (planned):** Add an employee and effective-dated pay rate; create a salary period, record amount due and one or more payments, then review the remaining payable. Salary records are visible only to authorized roles.

## 10. Functional requirements overview
Detailed, testable requirements are in [REQUIREMENTS.md](REQUIREMENTS.md). Feature inventory and phasing are in [FEATURES.md](FEATURES.md).

## 11. UX and localization considerations
- Prioritize a responsive, mobile-first experience and rapid transaction entry.
- Support PKR by default, while storing currency explicitly per business/record where appropriate; do not silently mix currencies.
- Use local number/date formatting and clear sign/direction labels; avoid relying on color alone.
- Make English and Urdu language support a product requirement to investigate and plan, including right-to-left layout where Urdu is offered.
- Use plain examples relevant to small businesses, but do not assume a business type, formal registration, or a particular family/friend relationship.
- Make the distinction among cash, income, profit, loan, contribution, ownership, stock quantity/value, and salary due/paid explicit in onboarding and reports.
- Treat employee names, compensation, and salary history as sensitive data; do not expose these to all workspace members by default.

## 12. Trust, privacy, and safety
- A business's records are private to its authorized members by default.
- Provide clear roles, least-privilege access, invitation controls, and member removal.
- Record sensitive changes, exports, and access-relevant actions in an audit trail.
- Protect financial records and attachments in transit and at rest; define retention, backup, deletion, and incident response policies before launch.
- Do not expose personal financial information to other businesses or use it for public profiles.
- Make export and account/business deletion policies understandable. Consider that deleting records may conflict with recordkeeping needs; clarify consequences and legal obligations with local counsel.
- Do not claim that records constitute a legal partnership deed, audited accounts, tax advice, or proof of ownership.

## 13. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Users confuse ownership, contributed capital, and profit split | Separate screens and data concepts; explain that they do not automatically determine each other. |
| Collaborators dispute an entry | Attribute records, preserve changes, provide flags/correction requests, and consider optional review/approval. |
| Users treat summaries as formal accounts or tax advice | Label limitations, define calculations, support exports, and validate with accounting/legal professionals. |
| Incorrect account balance due to missing opening balance or cash movement | Guided setup, visible opening balances, reconciliation prompts, and clear transaction history. |
| Shared credentials or unwanted access | Per-person accounts, invitations, role controls, revocation, and security safeguards. |
| Incorrect stock counts or misleading stock value | Attribute every movement, support audited adjustments and counts, and validate any valuation method with accounting professionals. |
| Salary information exposed to the wrong people | Apply least-privilege payroll permissions, restrict employee-level visibility, and review retention/privacy rules before launch. |
| Low adoption due to bookkeeping complexity | Test language and entry flow with solo and group businesses; make advanced fields optional. |
| Local rules and practices vary | Conduct Pakistan-specific user and professional research; avoid legal/tax assumptions in product defaults. |

## 14. Open questions for discovery
- Which small-business types and regions should be served first, and what connectivity/device constraints are common?
- Should MVP support Urdu UI at launch, or first validate bilingual transaction labels and RTL requirements?
- What roles do users expect (owner, admin/bookkeeper, viewer), and which actions need approval?
- Should transaction entries be immediately posted or remain drafts pending review?
- What level of accounting model is needed for trustworthy balances and reports, including assets and accruals?
- How should multiple currencies, exchange rates, cash accounts, and personal/business mixed spending be handled?
- What exports do local accountants and business owners need?
- Which data retention, consent, and privacy obligations apply to the intended launch model?
- Is ownership share tracking purely informational, or do users expect profit-sharing/capital-account functionality? If supported, what explicit agreement and calculation rules are needed?
- Which businesses need inventory first (retail, wholesale, food, services), and what units, variants, returns, stock counts, and valuation rules do they use?
- Should salary tracking cover only fixed monthly salaries at first, or also hourly/daily wages, commissions, advances, and deductions? Which privacy roles are expected?
- What local payroll, employee-data privacy, retention, and record-export expectations must be reviewed by qualified Pakistan-based professionals?

## 15. Definition of MVP readiness
The MVP is ready for a pilot when a solo owner and a multi-owner business can independently create a workspace, enter representative transactions, distinguish loans/contributions/income/expenses/transfers, inspect useful summaries, correct a mistake without erasing history, manage collaborators, and export their records. Core flows must pass usability testing in the intended language/device context, and security, privacy, backup, and support policies must be reviewed before real financial records are accepted.
