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
| Ownership/profit-sharing rules | P2 | Only after discovery; keep separate from ownership and contributions. |
| Roles and permissions | P0 | Owner/admin, bookkeeper/editor, viewer (final roles to validate). |
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
| Business overview | P0 | Cash/account balances, recent activity, loans, period totals. |
| Income and expense summary | P0 | Date range, category breakdown, clear calculation definitions. |
| Cash movement report | P0 | Inflows/outflows by account and period; not labeled profit. |
| Owner contributions and withdrawals | P0 | Per owner and date range. |
| Loan/receivable balances | P0 | Original, repayments, remaining, due date. |
| Ownership register and effective history | P0 | Distinct from cash and contribution reports. |
| Search, filters, and date ranges | P0 | Type, account, category, owner, counterparty, status. |
| CSV export | P0 | Respect access permissions and selected date range. |
| Human-readable statement/report | P1 | Useful for sharing with owners or an accountant. |
| Profit and loss summary | P1 | Only with explicit treatment/limitations and clear labels. |
| Custom reports and scheduled exports | P2 | Validate demand and privacy controls. |

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
| PKR default and local number formatting | P0 | Currency explicit; no silent mixing. |
| Pakistan-friendly date display | P0 | Consistent timezone and unambiguous stored date. |
| English-first content with Urdu/RTL readiness | P0 | Validate actual language and RTL launch scope with users. |
| Responsive, low-friction mobile experience | P0 | Core entry and review flows usable on small screens. |
| Accessible labels, contrast, and non-color status cues | P0 | Include assistive technology and keyboard considerations. |
| Secure sign-in and session controls | P0 | Final authentication design requires security review. |
| Least-privilege data access | P0 | Business-level membership boundaries. |
| Data export, retention, and deletion controls | P0 | Define policies before pilot. |
| Backup and recovery | P0 | Operational requirement before relying on records. |
| Offline transaction capture | P2 | Conflict and sync behavior require careful design. |

## 9. Potential later modules (not assumed in scope)
- Invoicing and customer statements.
- Inventory, purchasing, and cost of goods.
- Payroll and employee advances.
- Tax preparation integrations or accountant collaboration.
- Budgeting, forecasts, and cash runway.
- Branches, multiple legal entities, and consolidation.
- Payment initiation or bank feeds.

Any financial, legal, tax, or compliance-related module requires targeted discovery and qualified review before being represented as authoritative.
