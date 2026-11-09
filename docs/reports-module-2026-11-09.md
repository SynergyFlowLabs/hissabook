# Reports: income, expenses, stock and salary (2026-11-09)

Third usable module after the partner ledger. It exists because the numbers a
business already had were only readable one screen at a time: the dashboard showed
this month's income against last month's, and nothing else. There was no way to ask
"what did I spend on rent between these two dates", and no way to hand an
accountant a file that states what it counts.

## What was built

`/reports` with four report types over one shared range control (this month, last
month, last 30 days, this quarter, this year, or a custom pair of dates):

| Report | What it shows |
|---|---|
| Income and expenses | Category totals with record counts and shares, cash in and out per account, what was deliberately excluded, owner money and transfers apart, pending and voided counts |
| Profit summary | Cleared income minus cleared expenses, monthly split, the fee treatment, and partner profit shares listed as an appropriation rather than a cost |
| Stock movement | Opening, received, issued and closing quantity per item, reorder flags, and the cash actually paid for linked stock purchases |
| Salary | Salary due, paid and outstanding per employee period, restricted to owner, admin and payroll roles |

Each report has a CSV that is built from the same payload the screen renders, with
the workspace, range, currency and counting rules in the file header. Reports print
on A4: report cards and tables stay visible, the app chrome does not, and table
headers repeat across pages. The dashboard gained a "This month, explained" card
that repeats the same three figures using the same code path.

## The counting rules, and why they are central

The requirement that mattered most here was not the tables, it was not double
counting or mislabelling money (TXN-08, TXN-09, EMP-05, RPT-01, RPT-07):

- Only `CLEARED` rows count. `PENDING` is shown as a count and an amount with a note
  that it will count once cleared, and `VOID` never counts.
- Income is `INCOME` only. Expenses are `EXPENSE` only. Transfers, contributions,
  withdrawals, loan principal received and loan principal paid are classified as
  neutral *and listed with a plain-language reason*, so an omission is visible rather
  than silent.
- Loan repayment fees are a real cost and are counted as one. The principal is not.
- Salary payments and stock purchases are already stored as `EXPENSE` rows, so the
  reports recognise them by tag (via `salary_payments.transaction_id` and
  `inventory_movements.transaction_id`) purely to label them. They are never added a
  second time. The salary report reports the obligation beside the payment.
- Partner profit shares are an appropriation of profit. They are listed under the
  profit summary with an explicit statement that they are not subtracted.
- Every report prints its basis and says it is informational: not audited accounts,
  not accounting advice, not a tax filing.

`lib/reports/kind.ts` holds the single classification function, so the summary,
profit, stock and dashboard paths cannot drift apart.

## Verification actually run

- `npm run build` green. `./node_modules/.bin/tsc --noEmit` clean. `npm test` 63/63:
  24 new report tests plus the 39 existing ledger and UI-rule tests.
- Fresh SQLite database, real server on port 3100, demo login. October:
  income 60,000, expenses 14,000, difference 46,000, which is exactly the posted
  October distribution residual. Seven of the September to November rows were
  correctly left out (one contribution 50,000, two withdrawals totalling 35,000,
  one pending 12,500, and three partner movements that are not transactions).
- Double-counting probe on the running app: paid 40,000 against Noor Ahmed's salary
  period and recorded a stock receipt of 20 units at 500 (10,000) linked to the bank
  account. Row counts in `transactions` went from 9 to 11, not 13, and the profit
  report's expenses went from 50,500 to 100,500 by exactly 50,000. The salary report
  moved to due 140,000, paid 40,000, outstanding 100,000 with the period showing
  "Partly paid". The stock report showed opening 180, received 20, closing 165 for
  sketchbooks and spend 10,000 for the range.
- Stock arithmetic closes: A3 paper opening 50, issued 18, closing 32, flagged at the
  reorder point; tote bags 80 to 72; sketchbooks 180 to 165.
- CSV downloads: all four returned 200 with the expected headers and meta lines.
  Invalid dates return 400 with a readable message, an unknown report returns 400,
  and an unauthenticated request returns 401.
- Not done: a real browser pass. The sandbox cannot run Chromium (no `libnss3`, Debian
  mirrors blocked), so the reports screen was verified through its API, its built
  HTML, and source-level assertions. A device check of the tables at 375px and of the
  printed page is still worth doing by hand.

## Deliberate limits

- No stock valuation or cost of goods sold. A valuation method has to be chosen and
  reviewed before the app can put a number on stock, so the report prints quantities
  and the cash actually spent, and says so.
- No report builder, saved report definitions, or scheduled exports. A report URL
  carries its type and range, which is enough of a foundation if demand appears.
- Salary periods are grouped by the month they start in, stated in the report. A
  period that spans two months is not split.

## Files

- `lib/reports/period.ts` range arithmetic, presets, labels
- `lib/reports/kind.ts` the one classification function
- `lib/reports/pl.ts` profit arithmetic, category helpers, basis copy
- `lib/reports/summary.ts` tagged activity and cash/loan/owner queries
- `lib/reports/build.ts` report assembly shared by API and dashboard
- `lib/reports/dashboard.ts` the dashboard card payload
- `lib/reports/reports.test.ts` 24 tests
- `app/api/reports/route.ts` JSON and CSV for all four reports
- `app/reports/page.tsx`, `app/reports/reports-client.tsx` the screen
- `app/globals.css` report range layout, 375px tables, A4 print rules
- `components/app-sidebar.tsx` Reports now links to the page
- `app/dashboard.tsx`, `lib/database.ts` the "This month, explained" card
