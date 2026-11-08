import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace, getDashboardData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedTypes = new Set(['INCOME', 'EXPENSE', 'CONTRIBUTION', 'WITHDRAWAL', 'LOAN_RECEIVED', 'LOAN_GIVEN', 'TRANSFER']);
const filterableKinds = new Set([...allowedTypes, 'LOAN_REPAYMENT_OUT', 'LOAN_REPAYMENT_IN']);
const allowedStatuses = new Set(['CLEARED', 'PENDING', 'VOID']);
const activitySource = `
  SELECT t.id, t.description AS title, t.category, t.transaction_date AS date,
    t.amount, t.type AS kind, a.name AS account, t.account_id AS accountId,
    destination.name AS destinationAccount, t.destination_account_id AS destinationAccountId,
    t.status, t.counterparty, t.note
  FROM transactions t JOIN accounts a ON a.id = t.account_id
  LEFT JOIN accounts destination ON destination.id = t.destination_account_id AND destination.workspace_id = t.workspace_id
  WHERE t.workspace_id = ?
  UNION ALL
  SELECT -lr.id AS id,
    CASE WHEN l.direction = 'PAYABLE' THEN 'Loan repayment · ' || l.name ELSE 'Loan collection · ' || l.name END AS title,
    CASE WHEN l.direction = 'PAYABLE' THEN 'Loan repayment' ELSE 'Loan collection' END AS category,
    lr.transaction_date AS date, lr.principal_amount AS amount,
    CASE WHEN l.direction = 'PAYABLE' THEN 'LOAN_REPAYMENT_OUT' ELSE 'LOAN_REPAYMENT_IN' END AS kind,
    a.name AS account, lr.account_id AS accountId, NULL AS destinationAccount, NULL AS destinationAccountId,
    'CLEARED' AS status, l.counterparty, lr.note
  FROM loan_repayments lr JOIN loans l ON l.id = lr.loan_id JOIN accounts a ON a.id = lr.account_id
  WHERE lr.workspace_id = ?`;

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

type ActivityRow = {
  id: number;
  title: string;
  category: string;
  date: string;
  amount: number;
  kind: string;
  account: string;
  accountId: number;
  destinationAccount: string | null;
  destinationAccountId: number | null;
  status: string;
  counterparty: string;
  note: string;
};

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;

  const params = request.nextUrl.searchParams;
  const search = (params.get('q') ?? '').trim().slice(0, 120);
  const kind = (params.get('kind') ?? '').toUpperCase();
  const category = (params.get('category') ?? '').trim().slice(0, 80);
  const status = (params.get('status') ?? '').toUpperCase();
  const accountId = params.get('accountId');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const csv = params.get('format') === 'csv';

  if (kind && !filterableKinds.has(kind)) return NextResponse.json({ error: 'Choose a valid activity type.' }, { status: 400 });
  if (status && !allowedStatuses.has(status)) return NextResponse.json({ error: 'Choose a valid status.' }, { status: 400 });
  if (from && !isValidDate(from)) return NextResponse.json({ error: 'Enter a valid start date.' }, { status: 400 });
  if (to && !isValidDate(to)) return NextResponse.json({ error: 'Enter a valid end date.' }, { status: 400 });
  if (from && to && from > to) return NextResponse.json({ error: 'The start date must be on or before the end date.' }, { status: 400 });
  if (accountId && (!/^\d+$/.test(accountId) || !Number.isSafeInteger(Number(accountId)))) {
    return NextResponse.json({ error: 'Choose a valid business account.' }, { status: 400 });
  }

  const conditions: string[] = [];
  const filterValues: unknown[] = [];
  if (search) {
    const pattern = `%${search.toLocaleLowerCase()}%`;
    conditions.push("LOWER(title || ' ' || category || ' ' || account || ' ' || COALESCE(\"destinationAccount\", '') || ' ' || counterparty || ' ' || note) LIKE ?");
    filterValues.push(pattern);
  }
  if (kind) { conditions.push('kind = ?'); filterValues.push(kind); }
  if (category) { conditions.push('category = ?'); filterValues.push(category); }
  if (status) { conditions.push('status = ?'); filterValues.push(status); }
  if (accountId) {
    conditions.push('(\"accountId\" = ? OR \"destinationAccountId\" = ?)');
    filterValues.push(Number(accountId), Number(accountId));
  }
  if (from) { conditions.push('substr(date, 1, 10) >= ?'); filterValues.push(from); }
  if (to) { conditions.push('substr(date, 1, 10) <= ?'); filterValues.push(to); }
  const whereSql = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const workspaceId = access.member.workspaceId;

  try {
    const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM (${activitySource}) activity${whereSql}`)
      .get(workspaceId, workspaceId, ...filterValues) as { total: number };
    const total = Number(totalRow?.total ?? 0);

    if (csv) {
      const maxExportRows = 10_000;
      if (total > maxExportRows) return NextResponse.json({ error: `This export has ${total.toLocaleString()} rows. Narrow the filters to ${maxExportRows.toLocaleString()} rows or fewer.` }, { status: 413 });
      const rows = await db.prepare(`SELECT * FROM (${activitySource}) activity${whereSql}
        ORDER BY substr(date, 1, 10) DESC, id DESC LIMIT ?`)
        .all(workspaceId, workspaceId, ...filterValues, maxExportRows + 1) as ActivityRow[];
      const headers = ['ID', 'Date', 'Type', 'Description', 'Category', 'Amount (PKR)', 'Account', 'Destination account', 'Status', 'Counterparty', 'Note'];
      const body = rows.map((row) => [row.id, row.date, row.kind, row.title, row.category, row.amount, row.account, row.destinationAccount, row.status, row.counterparty, row.note]
        .map(csvCell).join(','));
      const file = `\uFEFF${[headers.map(csvCell).join(','), ...body].join('\r\n')}`;
      return new NextResponse(file, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="hisaabook-activity.csv"',
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const limitValue = Number(params.get('limit') ?? 50);
    const offsetValue = Number(params.get('offset') ?? 0);
    const limit = Number.isSafeInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 50;
    const offset = Number.isSafeInteger(offsetValue) ? Math.min(Math.max(offsetValue, 0), 1_000_000) : 0;
    const transactions = await db.prepare(`SELECT * FROM (${activitySource}) activity${whereSql}
      ORDER BY substr(date, 1, 10) DESC, id DESC LIMIT ? OFFSET ?`)
      .all(workspaceId, workspaceId, ...filterValues, limit + 1, offset) as ActivityRow[];
    const hasMore = transactions.length > limit;
    transactions.length = Math.min(transactions.length, limit);
    const accounts = await db.prepare('SELECT id, name FROM accounts WHERE workspace_id = ? ORDER BY name').all(workspaceId);
    const categories = await db.prepare(`SELECT category FROM (
      SELECT DISTINCT category FROM transactions WHERE workspace_id = ?
      UNION SELECT DISTINCT CASE WHEN l.direction = 'PAYABLE' THEN 'Loan repayment' ELSE 'Loan collection' END AS category
      FROM loan_repayments lr JOIN loans l ON l.id = lr.loan_id WHERE lr.workspace_id = ?
    ) activity_categories WHERE category <> '' ORDER BY category`).all(workspaceId, workspaceId);
    return NextResponse.json({ transactions, accounts, categories: categories.map((row) => (row as { category: string }).category), total, limit, offset, hasMore }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Failed to load transaction ledger', error);
    return NextResponse.json({ error: 'Could not load the business activity. Please try again.' }, { status: 500 });
  }
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
    const workspaceId = await ensureDemoWorkspace();
    const source = await db.prepare('SELECT id FROM accounts WHERE id = ? AND workspace_id = ?').get(accountId, workspaceId);
    if (!source) return NextResponse.json({ error: 'The selected account was not found in this business.' }, { status: 400 });
    if (destinationAccountId) {
      const destination = await db.prepare('SELECT id FROM accounts WHERE id = ? AND workspace_id = ?').get(destinationAccountId, workspaceId);
      if (!destination) return NextResponse.json({ error: 'The destination account was not found in this business.' }, { status: 400 });
    }

    const createTransaction = db.transaction(async () => {
      let loanId: number | null = null;
      const counterparty = body.counterparty?.trim().slice(0, 120) || '';
      if (type === 'LOAN_RECEIVED' || type === 'LOAN_GIVEN') {
        const direction = type === 'LOAN_RECEIVED' ? 'PAYABLE' : 'RECEIVABLE';
        const loanResult = await db.prepare(`INSERT INTO loans
          (workspace_id, direction, name, counterparty, principal, outstanding, due_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(workspaceId, direction, description, counterparty, amount, amount, body.dueDate || null);
        loanId = Number(loanResult.lastInsertRowid);
      }

      const transactionResult = await db.prepare(`INSERT INTO transactions
        (workspace_id, account_id, destination_account_id, loan_id, type, amount, description, category, counterparty, note, transaction_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CLEARED')`)
        .run(workspaceId, accountId, destinationAccountId, loanId, type, amount, description, category.slice(0, 80), counterparty, body.note?.trim().slice(0, 1000) || '', `${date}T12:00:00.000Z`);
      const transactionId = Number(transactionResult.lastInsertRowid);
      await db.prepare('INSERT INTO audit_events (workspace_id, transaction_id, action, details) VALUES (?, ?, ?, ?)')
        .run(workspaceId, transactionId, 'TRANSACTION_CREATED', JSON.stringify({ type, amount, description }));
      return transactionId;
    });

    const id = await createTransaction();
    const result = await getDashboardData();
    return NextResponse.json({ ...result, createdTransactionId: id }, { status: 201 });
  } catch (error) {
    console.error('Failed to create transaction', error);
    return NextResponse.json({ error: 'Could not save this transaction. Please try again.' }, { status: 500 });
  }
}
