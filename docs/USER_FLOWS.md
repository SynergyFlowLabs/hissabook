# Core User Flows — HisaabBook

These are product-level flows for design and validation, not implementation instructions. Inventory management and employee salary tracking are planned follow-on modules, not part of the current app implementation.

## 1. Create a business
1. User chooses **Create business**.
2. Enters a business name and optionally its type.
3. Selects a base currency (PKR by default) and date preferences.
4. Selects **Just me** or **More than one owner**. Both options lead to a complete ledger.
5. Adds owner/member details. If the group has agreed ownership, records percentages or units and an effective date; otherwise skips this step.
6. Reviews a clear note: ownership records are informational and do not verify or create a legal agreement.
7. Sets up one or more cash/bank/wallet accounts and, if known, an opening balance and date.
8. Confirms the workspace and lands on its overview.

## 2. Record a routine business transaction
1. User selects **Add transaction**.
2. Chooses a clear type: income, expense, owner contribution, owner withdrawal, loan received, loan given, repayment, transfer, or adjustment.
3. Enters amount/currency, date, source or destination account, category, and description.
4. Optionally adds a counterparty, relevant owner, payment method, note, and receipt/photo.
5. Sees a summary that makes clear whether the record increases/decreases an account and whether it affects income/expense summaries.
6. Saves and sees a confirmation plus the updated ledger/account balance.

## 3. Record an owner contribution
1. Selects **Owner contribution** rather than income or loan.
2. Chooses the owner, amount, date, receiving business account, and optional purpose/evidence.
3. Reviews that the contribution changes recorded business funds but does not automatically change ownership or count as sales.
4. Saves. The record appears in account activity and the contribution report, not sales revenue.

## 4. Track a loan and repayment
1. Selects **Loan received** or **Loan given**.
2. Enters lender/borrower, principal, date, currency, due date if known, and notes/terms.
3. Saves and sees the outstanding principal in the loan register, separate from income/expense totals.
4. Later selects **Record repayment** on that loan, enters date, amount, account, and any explicitly identified fee/interest.
5. Reviews the updated outstanding balance and repayment history.

## 5. Record an ownership change
1. An authorized owner opens the ownership register and chooses **Record change**.
2. Enters the new owners/shares or units and effective date, with an optional explanation or supporting reference.
3. Reviews the new total and sees a warning if the percentages/units do not reconcile.
4. Confirms. The previous arrangement remains available with its effective dates and audit history.
5. The change does not rewrite prior contributions, transactions, or loan balances.

## 6. Question or correct a record
1. A member opens a transaction and selects **Flag for review** or **Request correction**.
2. Adds a reason. The original record remains visible and the request is attributed to the member.
3. An authorized member reviews the request, adds a response, and either makes an audited correction/reversal or resolves it without a change.
4. The request status and resolution are visible to permitted members.

## 7. Review and export
1. User selects a reporting period and chooses a view: income/expenses, account cash movement, owner contributions/withdrawals, loans, or ownership.
2. The report states the business, currency, period, and calculation basis.
3. User selects export and confirms the scope and format.
4. The export is produced only for a user with permission and includes enough context to interpret types and dates.

## 8. Receive and track inventory
1. An authorized member creates an item with a name, unit of measure, and optional SKU/category and low-stock threshold.
2. On receiving stock, the member selects the item and records quantity, date, source/vendor, and optional unit cost/evidence.
3. If the purchase is paid or payable, the member links the stock receipt to the corresponding business transaction so the same purchase is not counted twice.
4. When stock is sold, used, issued, returned, or counted, the member records a dated movement and reason.
5. The app shows the updated on-hand amount, movement history, and a low-stock warning where applicable. Negative quantities are blocked by default; any permitted override requires a reason.

## 9. Track an employee salary period
1. An owner or payroll-authorized user creates an employee profile with only the details needed to administer pay.
2. The authorized user records an agreed monthly pay rate and its effective date; a new rate does not rewrite old salary periods.
3. At the relevant pay period, the user creates a salary record with period dates, amount due, currency, and due date.
4. The user records a full or partial payment with date, amount, account/method, and optional reference. If paid in parts, each payment remains visible and the outstanding amount is calculated.
5. The salary summary shows amount due, amount paid, and remaining payable separately, without double-counting a salary obligation and its cash payment.
6. Only owner/payroll-authorized roles can view employee-level salary details. The app does not claim to calculate statutory deductions or provide compliant payroll/tax advice.

## Questions to test in usability sessions
- Do users distinguish “money invested by an owner” from a loan and from revenue?
- Do the terms “owner withdrawal” and “drawing” make sense, or is another local-language term needed?
- Which details are essential at first entry, and which should be optional or added later?
- Do owners expect all members to see all transactions, and which records need restricted visibility?
- What evidence do users commonly keep, and do they need comments, approval, or just an audit trail?
- Which reports are most useful for regular owner discussions and accountant handoff?
- Which products, units, returns, stock-count routines, and reorder signals matter most for the intended businesses?
- Who should be able to view an individual employee's salary, and how do businesses handle partial pay, advances, and salary changes?
