import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace, getDashboardData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedTypes = new Set(['INCOME', 'EXPENSE', 'CONTRIBUTION', 'WITHDRAWAL', 'LOAN_RECEIVED', 'LOAN_GIVEN', 'TRANSFER']);
type NewTransaction = {
  type?: string;
  amount?: number;
  description?: string;
  category?: string;
  accountId?: number;
  destinationAccountId?: number | null;
  transactionDate?: string;
  counterparty?: string;
  dueDate?: string;
  note?: string;
};

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.BOOKKEEPER]);
  if (access.response) return access.response;
  let body: NewTransaction;
  try {
    body = await request.json() as NewTransaction;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const type = body.type?.toUpperCase();
  const amount = Number(body.amount);
  const description = body.description?.trim();
  const category = body.category?.trim() || 'General';
  const accountId = Number(body.accountId);
  const date = body.transactionDate || new Date().toISOString().slice(0, 10);
  const destinationAccountId = body.destinationAccountId ? Number(body.destinationAccountId) : null;

  if (!type || !allowedTypes.has(type)) return NextResponse.json({ error: 'Choose a supported transaction type.' }, { status: 400 });
  if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: 'Amount must be a positive whole number of PKR.' }, { status: 400 });
  if (!description || description.length > 160) return NextResponse.json({ error: 'Add a description of 1–160 characters.' }, { status: 400 });
  if (!Number.isSafeInteger(accountId)) return NextResponse.json({ error: 'Choose a valid business account.' }, { status: 400 });
  if (!isValidDate(date)) return NextResponse.json({ error: 'Enter a valid transaction date.' }, { status: 400 });
  if (type === 'TRANSFER' && (!destinationAccountId || destinationAccountId === accountId)) {
    return NextResponse.json({ error: 'Choose a different destination account for this transfer.' }, { status: 400 });
  }
  if (body.dueDate && !isValidDate(body.dueDate)) return NextResponse.json({ error: 'Enter a valid due date.' }, { status: 400 });

  try {
    const workspaceId = ensureDemoWorkspace();
    const source = db.prepare('SELECT id FROM accounts WHERE id = ? AND workspace_id = ?').get(accountId, workspaceId);
    if (!source) return NextResponse.json({ error: 'The selected account was not found in this business.' }, { status: 400 });
    if (destinationAccountId) {
      const destination = db.prepare('SELECT id FROM accounts WHERE id = ? AND workspace_id = ?').get(destinationAccountId, workspaceId);
      if (!destination) return NextResponse.json({ error: 'The destination account was not found in this business.' }, { status: 400 });
    }

    const createTransaction = db.transaction(() => {
      let loanId: number | null = null;
      const counterparty = body.counterparty?.trim().slice(0, 120) || '';
      if (type === 'LOAN_RECEIVED' || type === 'LOAN_GIVEN') {
        const direction = type === 'LOAN_RECEIVED' ? 'PAYABLE' : 'RECEIVABLE';
        const loanResult = db.prepare(`INSERT INTO loans
          (workspace_id, direction, name, counterparty, principal, outstanding, due_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(workspaceId, direction, description, counterparty, amount, amount, body.dueDate || null);
        loanId = Number(loanResult.lastInsertRowid);
      }

      const transactionResult = db.prepare(`INSERT INTO transactions
        (workspace_id, account_id, destination_account_id, loan_id, type, amount, description, category, counterparty, note, transaction_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CLEARED')`)
        .run(workspaceId, accountId, destinationAccountId, loanId, type, amount, description, category.slice(0, 80), counterparty, body.note?.trim().slice(0, 1000) || '', `${date}T12:00:00.000Z`);
      const transactionId = Number(transactionResult.lastInsertRowid);
      db.prepare('INSERT INTO audit_events (workspace_id, transaction_id, action, details) VALUES (?, ?, ?, ?)')
        .run(workspaceId, transactionId, 'TRANSACTION_CREATED', JSON.stringify({ type, amount, description }));
      return transactionId;
    });

    const id = createTransaction();
    const result = getDashboardData();
    return NextResponse.json({ ...result, createdTransactionId: id }, { status: 201 });
  } catch (error) {
    console.error('Failed to create transaction', error);
    return NextResponse.json({ error: 'Could not save this transaction. Please try again.' }, { status: 500 });
  }
}
