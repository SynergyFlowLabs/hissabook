import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDemoWorkspace, getInventoryData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.BOOKKEEPER]);
  if (access.response) return access.response;
  let body: { name?: string; sku?: string; category?: string; unit?: string; reorderLevel?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const name = body.name?.trim();
  const unit = body.unit?.trim() || 'pcs';
  const reorderLevel = Number(body.reorderLevel ?? 0);
  if (!name || name.length > 100) return NextResponse.json({ error: 'Enter an item name (up to 100 characters).' }, { status: 400 });
  if (!unit || unit.length > 24) return NextResponse.json({ error: 'Enter a unit of measure (up to 24 characters).' }, { status: 400 });
  if (!Number.isFinite(reorderLevel) || reorderLevel < 0 || reorderLevel > 1_000_000_000) return NextResponse.json({ error: 'Reorder level must be zero or greater.' }, { status: 400 });

  try {
    const workspaceId = ensureDemoWorkspace();
    db.prepare(`INSERT INTO inventory_items (workspace_id, name, sku, category, unit, reorder_level)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(workspaceId, name, body.sku?.trim().slice(0, 40) || '', body.category?.trim().slice(0, 60) || 'General', unit, reorderLevel);
    return NextResponse.json(getInventoryData(), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'An item with that name already exists.' }, { status: 409 });
    }
    console.error('Failed to create inventory item', error);
    return NextResponse.json({ error: 'Could not save this item.' }, { status: 500 });
  }
}
