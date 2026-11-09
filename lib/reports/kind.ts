/**
 * Classifies a ledger row for the reports, once, so the income and expense
 * summary, the stock report and the profit summary cannot disagree.
 *
 * The rule is deliberately narrow: only `transactions` rows count as money in or
 * out of the P&L. Loan repayments carry a separate fee component and are handled
 * beside this, not through it.
 */
export type LedgerKind =
  | 'INCOME' | 'EXPENSE' | 'CONTRIBUTION' | 'WITHDRAWAL'
  | 'LOAN_RECEIVED' | 'LOAN_GIVEN' | 'TRANSFER'
  | 'SALARY_PAYMENT' | 'INVENTORY_PURCHASE';

export type MoneyClass = 'income' | 'expense' | 'neutral';

/**
 * Salary payments and stock purchases are stored as EXPENSE rows, so they are
 * already inside the expense total. They are recognised here only so a report can
 * label them, never so they can be added a second time.
 */
const TAG_CLASS: Record<string, MoneyClass> = {
  SALARY_PAYMENT: 'expense',
  INVENTORY_PURCHASE: 'expense',
};

const KIND_CLASS: Record<string, MoneyClass> = {
  INCOME: 'income',
  EXPENSE: 'expense',
  CONTRIBUTION: 'neutral',
  WITHDRAWAL: 'neutral',
  LOAN_RECEIVED: 'neutral',
  LOAN_GIVEN: 'neutral',
  TRANSFER: 'neutral',
};

/** Why a neutral row is neutral. Shown to the user instead of an unexplained omission. */
export function neutralReason(kind: string): string {
  switch (kind.toUpperCase()) {
    case 'TRANSFER': return 'Money moved between accounts';
    case 'CONTRIBUTION': return 'Owner put money in';
    case 'WITHDRAWAL': return 'Owner took money out';
    case 'LOAN_RECEIVED': return 'Loan received, cash not income';
    case 'LOAN_GIVEN': return 'Loan given, cash not an expense';
    default: return 'Not income or expense';
  }
}

export function moneyClass(kind: string, tag: string | null = null): MoneyClass {
  if (tag && TAG_CLASS[tag]) return TAG_CLASS[tag];
  return KIND_CLASS[kind.toUpperCase()] ?? 'neutral';
}

export function isSalaryTag(tag: string | null): boolean {
  return tag === 'SALARY_PAYMENT';
}

export function isInventoryTag(tag: string | null): boolean {
  return tag === 'INVENTORY_PURCHASE';
}
