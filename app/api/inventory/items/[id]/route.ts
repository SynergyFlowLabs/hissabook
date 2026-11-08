import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace, getInventoryData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.BOOKKEEPER]);
  if (access.response) return access.response;
  let body: { name?: string; sku?: string; category?: string; unit?: string; reorderLevel?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const { id: rawId } = await params;
  const id = Number(rawId);
  const name = body.name?.trim();
  const unit = body.unit?.trim();
  const reorderLevel = Number(body.reorderLevel);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid inventory item.' }, { status: 400 });
  if (!name || name.length > 100) return NextResponse.json({ error: 'Enter an item name (up to 100 characters).' }, { status: 400 });
  if (!unit || unit.length > 24) return NextResponse.json({ error: 'Enter a unit of measure (up to 24 characters).' }, { status: 400 });
  if (!Number.isFinite(reorderLevel) || reorderLevel < 0 || reorderLevel > 1_000_000_000) return NextResponse.json({ error: 'Reorder level must be zero or greater.' }, { status: 400 });
  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    const item = await db.prepare('SELECT id FROM inventory_items WHERE id = ? AND workspace_id = ?').get(id, workspaceId);
    if (!item) return NextResponse.json({ error: 'Inventory item not found.' }, { status: 404 });
    const currentUnit = await db.prepare('SELECT unit FROM inventory_items WHERE id = ?').get(id) as { unit: string };
    if (currentUnit.unit !== unit) {
      const movementCount = (await db.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE item_id = ?').get(id) as { count: number }).count;
      if (movementCount > 0) return NextResponse.json({ error: 'This item has movement history. Create a new item to use a different unit so past quantities remain clear.' }, { status: 409 });
    }
    await db.prepare(`UPDATE inventory_items SET name = ?, sku = ?, category = ?, unit = ?, reorder_level = ?
      WHERE id = ? AND workspace_id = ?`)
      .run(name, body.sku?.trim().slice(0, 40) || '', body.category?.trim().slice(0, 60) || 'General', unit, reorderLevel, id, workspaceId);
    await db.prepare('INSERT INTO audit_events (workspace_id, action, details) VALUES (?, ?, ?)')
      .run(workspaceId, 'INVENTORY_ITEM_UPDATED', JSON.stringify({ itemId: id, name, reorderLevel }));
    return NextResponse.json(await getInventoryData(access.member.workspaceId));
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) return NextResponse.json({ error: 'Another item already uses that name.' }, { status: 409 });
    console.error('Failed to update inventory item', error);
    return NextResponse.json({ error: 'Could not update this item.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.BOOKKEEPER]);
  if (access.response) return access.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid inventory item.' }, { status: 400 });
  try {
    const workspaceId = await ensureDemoWorkspace(access.member.workspaceId);
    const result = await db.prepare('UPDATE inventory_items SET active = 0 WHERE id = ? AND workspace_id = ? AND active = 1').run(id, workspaceId);
    if (!result.changes) return NextResponse.json({ error: 'Active inventory item not found.' }, { status: 404 });
    await db.prepare('INSERT INTO audit_events (workspace_id, action, details) VALUES (?, ?, ?)')
      .run(workspaceId, 'INVENTORY_ITEM_ARCHIVED', JSON.stringify({ itemId: id }));
    return NextResponse.json(await getInventoryData(access.member.workspaceId));
  } catch (error) {
    console.error('Failed to archive inventory item', error);
    return NextResponse.json({ error: 'Could not archive this item.' }, { status: 500 });
  }
}
