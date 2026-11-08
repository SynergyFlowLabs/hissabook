import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace, getInventoryData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const movementTypes = new Set(['RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT']);

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.BOOKKEEPER]);
  if (access.response) return access.response;
  let body: {
    itemId?: number; type?: string; quantity?: number; adjustmentDirection?: string;
    unitCost?: number | null; accountId?: number | null; date?: string;
    counterparty?: string; note?: string;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const itemId = Number(body.itemId);
  const type = body.type?.toUpperCase();
  const quantity = Number(body.quantity);
  const date = body.date || new Date().toISOString().slice(0, 10);
  const unitCost = body.unitCost === null || body.unitCost === undefined ? null : Number(body.unitCost);
  const accountId = body.accountId ? Number(body.accountId) : null;
  if (!Number.isSafeInteger(itemId) || !movementTypes.has(type ?? '')) return NextResponse.json({ error: 'Choose a valid item and movement type.' }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000) return NextResponse.json({ error: 'Quantity must be a positive number.' }, { status: 400 });
  if (type === 'ADJUSTMENT' && !['INCREASE', 'DECREASE'].includes(body.adjustmentDirection ?? '')) return NextResponse.json({ error: 'Choose whether the adjustment increases or decreases stock.' }, { status: 400 });
  if (!validDate(date)) return NextResponse.json({ error: 'Enter a valid movement date.' }, { status: 400 });
  if (unitCost !== null && (!Number.isSafeInteger(unitCost) || unitCost < 0)) return NextResponse.json({ error: 'Unit cost must be a whole PKR amount.' }, { status: 400 });
  if (unitCost !== null && type !== 'RECEIPT') return NextResponse.json({ error: 'Unit cost can only be entered on a stock receipt.' }, { status: 400 });
  if (unitCost !== null && unitCost > 0 && !accountId) return NextResponse.json({ error: 'Choose the account used to pay for this stock receipt.' }, { status: 400 });

  try {
    const workspaceId = await ensureDemoWorkspace();
    const item = await db.prepare('SELECT id, name, unit FROM inventory_items WHERE id = ? AND workspace_id = ? AND active = 1').get(itemId, workspaceId) as { id: number; name: string; unit: string } | undefined;
    if (!item) return NextResponse.json({ error: 'This inventory item was not found or is inactive.' }, { status: 404 });
    const current = await db.prepare('SELECT COALESCE(SUM(quantity_delta), 0) AS stock FROM inventory_movements WHERE item_id = ?').get(itemId) as { stock: number };
    const delta = type === 'ISSUE' || (type === 'ADJUSTMENT' && body.adjustmentDirection === 'DECREASE') ? -quantity : quantity;
    if (current.stock + delta < -0.000001) return NextResponse.json({ error: `Only ${current.stock.toLocaleString()} ${item.unit} are currently recorded; this movement would make stock negative.` }, { status: 400 });
    if (accountId) {
      const account = await db.prepare('SELECT id FROM accounts WHERE id = ? AND workspace_id = ?').get(accountId, workspaceId);
      if (!account) return NextResponse.json({ error: 'Choose a valid business account.' }, { status: 400 });
    }
    if (unitCost !== null && unitCost > 0 && Math.round(quantity * unitCost) < 1) return NextResponse.json({ error: 'Receipt total must be at least ₨ 1.' }, { status: 400 });

    const createMovement = db.transaction(async () => {
      let transactionId: number | null = null;
      if (unitCost !== null && unitCost > 0 && accountId) {
        const totalCost = Math.round(quantity * unitCost);
        const transactionResult = await db.prepare(`INSERT INTO transactions
          (workspace_id, account_id, type, amount, description, category, counterparty, note, transaction_date, status, created_by)
          VALUES (?, ?, 'EXPENSE', ?, ?, 'Inventory purchases', ?, ?, ?, 'CLEARED', ?)`)
          .run(workspaceId, accountId, totalCost, `Inventory purchase · ${item.name}`, body.counterparty?.trim().slice(0, 120) || '', body.note?.trim().slice(0, 1000) || '', `${date}T12:00:00.000Z`, access.member.name);
        transactionId = Number(transactionResult.lastInsertRowid);
        await db.prepare('INSERT INTO audit_events (workspace_id, transaction_id, action, details, actor) VALUES (?, ?, ?, ?, ?)')
          .run(workspaceId, transactionId, 'INVENTORY_PURCHASE_RECORDED', JSON.stringify({ itemId, quantity, unitCost, totalCost }), access.member.name);
      }
      await db.prepare(`INSERT INTO inventory_movements
        (workspace_id, item_id, transaction_id, type, quantity_delta, unit_cost, counterparty, note, movement_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(workspaceId, itemId, transactionId, type, delta, unitCost, body.counterparty?.trim().slice(0, 120) || '', body.note?.trim().slice(0, 1000) || '', `${date}T12:00:00.000Z`);
    });
    await createMovement();
    return NextResponse.json(await getInventoryData(), { status: 201 });
  } catch (error) {
    console.error('Failed to record inventory movement', error);
    return NextResponse.json({ error: 'Could not save this stock movement.' }, { status: 500 });
  }
}
