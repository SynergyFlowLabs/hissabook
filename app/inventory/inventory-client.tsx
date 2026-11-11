'use client';

import Link from 'next/link';
import { readCache, writeCache } from '@/lib/route-cache';
import { SkPageBody, SkStatus } from '@/components/skeletons';
import Topbar from '@/components/topbar';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Archive, Boxes, Check, PackageCheck, Pencil, Plus, Search, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { sounds } from '@/lib/sounds';

type InventoryData = {
  workspace: { id: number; name: string; currency: string };
  accounts: Array<{ id: number; name: string; currency: string }>;
  items: Array<{ id: number; name: string; sku: string; category: string; unit: string; reorderLevel: number; active: number; stockOnHand: number; lowStock: number }>;
  movements: Array<{ id: number; itemId: number; itemName: string; unit: string; type: string; quantityDelta: number; unitCost: number | null; counterparty: string; note: string; date: string; transactionId: number | null }>;
  summary: { totalItems: number; activeItems: number; lowStock: number };
};

type FormMode = 'item' | 'itemEdit' | 'movement';
type MovementType = 'RECEIPT' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT';

const money = (amount: number) => `PKR ${Math.abs(amount).toLocaleString('en-PK')}`;
const shortDate = (date: string) => new Date(date).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' });

/** Cached across navigation so returning to Inventory paints instantly. */
const INVENTORY_CACHE = 'inventory';

export default function InventoryClient({ userName, role }: { userName: string; role: string }) {
  const canManageInventory = ['OWNER', 'ADMIN', 'BOOKKEEPER'].includes(role);
  // Seeded from the cache so returning to this screen does not re-show the
  // full-screen "Loading inventory" state for data the browser already has.
  const [data, setData] = useState<InventoryData | null>(() => readCache<InventoryData>(INVENTORY_CACHE));
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<FormMode>('item');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [itemName, setItemName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('General');
  const [unit, setUnit] = useState('pcs');
  const [reorderLevel, setReorderLevel] = useState('0');
  const [itemId, setItemId] = useState('');
  const [movementType, setMovementType] = useState<MovementType>('RECEIPT');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [accountId, setAccountId] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const refresh = async () => {
    const response = await fetch('/api/inventory', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load inventory.');
    setData(result as InventoryData); writeCache(INVENTORY_CACHE, result as InventoryData);
    if (result.items[0]) setItemId((current: string) => current || String(result.items[0].id));
    if (result.accounts[0]) setAccountId((current: string) => current || String(result.accounts[0].id));
  };

  useEffect(() => { refresh().catch((reason: Error) => setError(reason.message)); }, []);

  const filteredItems = useMemo(() => (data?.items ?? []).filter((item) => `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const selectedItem = data?.items.find((item) => String(item.id) === itemId);

  const openItemForm = () => { setMode('item'); setFormError(''); setDialogOpen(true); };
  const openEditItem = (item: InventoryData['items'][number]) => {
    setMode('itemEdit'); setEditingItemId(item.id); setFormError('');
    setItemName(item.name); setSku(item.sku); setCategory(item.category); setUnit(item.unit);
    setReorderLevel(String(item.reorderLevel)); setDialogOpen(true);
  };
  const archiveItem = async (item: InventoryData['items'][number]) => {
    if (!window.confirm(`Archive ${item.name}? Stock history will be kept.`)) return;
    try {
      const response = await fetch(`/api/inventory/items/${item.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not archive this item.');
      setData(result as InventoryData); writeCache(INVENTORY_CACHE, result as InventoryData); toast.success('Item archived', 'Its movement history was kept.');
    } catch (reason) { toast.error('Could not archive this item.', reason instanceof Error ? reason.message : undefined); }
  };
  const openMovementForm = (selectedId?: number) => {
    setMode('movement'); setFormError(''); setMovementType('RECEIPT'); setQuantity(''); setUnitCost(''); setCounterparty(''); setNote('');
    setItemId(selectedId ? String(selectedId) : data?.items[0] ? String(data.items[0].id) : '');
    setMovementDate(new Date().toISOString().slice(0, 10)); setDialogOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setFormError('');
    try {
      const isItemForm = mode === 'item' || mode === 'itemEdit';
      const endpoint = isItemForm ? mode === 'itemEdit' ? `/api/inventory/items/${editingItemId}` : '/api/inventory/items' : '/api/inventory/movements';
      const body = isItemForm
        ? { name: itemName, sku, category, unit, reorderLevel: Number(reorderLevel) }
        : { itemId: Number(itemId), type: movementType, quantity: Number(quantity), adjustmentDirection, unitCost: movementType === 'RECEIPT' && unitCost !== '' ? Number(unitCost) : null, accountId: unitCost !== '' && movementType === 'RECEIPT' ? Number(accountId) : null, date: movementDate, counterparty, note };
      const response = await fetch(endpoint, { method: mode === 'itemEdit' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this record.');
      setData(result as InventoryData); writeCache(INVENTORY_CACHE, result as InventoryData);
      if (result.items[0]) setItemId(String(result.items[0].id));
      if (result.accounts[0]) setAccountId(String(result.accounts[0].id));
      setDialogOpen(false);
      if (isItemForm) { setItemName(''); setSku(''); setCategory('General'); setUnit('pcs'); setReorderLevel('0'); setEditingItemId(null); }
      if (isItemForm) { toast.success(mode === 'itemEdit' ? 'Item updated' : 'Item created'); } else { toast.ledger('Stock movement recorded', 'Quantities and valuation were updated.'); }
    } catch (reason) { sounds.error(); setFormError(reason instanceof Error ? reason.message : 'Could not save this record.'); }
    finally { setSaving(false); }
  };

  if (!data) {
    if (error) return <div className="loading-screen"><div className="icon-badge"><Boxes size={20} /></div><strong>Your stock records could not be loaded</strong><span>{error}</span></div>;
    return (
      <div className="app-shell" id="overview">
        <main className="main-area">
          <Topbar crumb="Inventory" />
          <div className="content">
            <SkStatus label="Loading inventory" />
            <section className="page-heading">
              <div>
                <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />Stock control</span>
                <h1 className="page-title">Inventory</h1>
                <p className="page-subtitle">Know what you have, what’s moving, and what needs a restock.</p>
              </div>
            </section>
            <SkPageBody stats={4} tableColumns={7} tableRows={6} extra="two-cards" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell" id="overview">
      <main className="main-area">
        <Topbar />
        <div className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-strong)]" aria-hidden="true" />Stock control</span>
              <h1 className="page-title">Inventory</h1>
              <p className="page-subtitle">Know what you have, what’s moving, and what needs a restock.</p>
            </div>
            {canManageInventory && <div className="inventory-heading-actions"><Button variant="outline" className="h-11 rounded-full bg-white" onClick={() => openMovementForm()}><ArrowDownLeft size={14} /> Record stock</Button><button className="lime-button" onClick={openItemForm}><Plus size={15} strokeWidth={2.6} /> Add item</button></div>}
          </section>

          <section className="stat-grid" aria-label="Inventory summary">
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Active items</span><span className="stat-icon lime"><Boxes size={16} /></span></div><div className="stat-value">{data.summary.activeItems}</div><div className="stat-foot">Across your item catalogue</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Needs restocking</span><span className="stat-icon terra"><TriangleAlert size={16} /></span></div><div className="stat-value">{data.summary.lowStock}</div><div className="stat-foot">At or below reorder level</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Stock movements</span><span className="stat-icon slate"><ArrowLeftRight size={16} /></span></div><div className="stat-value">{data.movements.length}</div><div className="stat-foot">Latest recorded movements</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-label">Stock value</span><span className="stat-icon green"><SlidersHorizontal size={16} /></span></div><div className="stat-value" style={{ fontSize: 17, color: 'var(--muted)' }}>Not calculated</div><div className="stat-foot">No valuation method configured</div></div>
          </section>

          <section className="soft-card" style={{ marginTop: 14 }}>
            <div className="card-header-row">
              <div><div className="card-title">Item catalogue</div><div className="card-subtitle">On-hand quantity is based on the movement history.</div></div>
              <label className="inventory-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items or SKU" aria-label="Search inventory" /></label>
            </div>
            <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Category</th><th>On hand</th><th>Reorder at</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredItems.length ? filteredItems.map((item) => <tr key={item.id}><td><div className="cell-title">{item.name}</div><div className="cell-sub">{item.sku || 'No SKU'} · {item.unit}</div></td><td className="table-muted">{item.category}</td><td className="cell-num">{Number(item.stockOnHand).toLocaleString('en-PK')} <small style={{ color: 'var(--faint)', fontWeight: 700 }}>{item.unit}</small></td><td className="table-muted">{Number(item.reorderLevel).toLocaleString('en-PK')} {item.unit}</td><td><span className={`pill ${item.lowStock ? 'warn' : 'good'}`}>{item.lowStock ? 'Restock soon' : 'In stock'}</span></td><td>{canManageInventory && <div className="row-actions"><button className="text-link" onClick={() => openMovementForm(item.id)}>Stock</button><button className="icon-row-button" aria-label={`Edit ${item.name}`} onClick={() => openEditItem(item)}><Pencil size={13} /></button><button className="icon-row-button archive" aria-label={`Archive ${item.name}`} onClick={() => archiveItem(item)}><Archive size={13} /></button></div>}</td></tr>) : <tr><td colSpan={6} className="inventory-empty">No inventory items match that search.</td></tr>}</tbody></table></div>
            {!data.items.length && <div className="empty-state"><PackageCheck size={22} style={{ margin: '0 auto 8px', color: 'var(--lime-strong)' }} />Add your first stock item to start tracking inventory.</div>}
          </section>

          <section className="soft-card" style={{ marginTop: 14 }}>
            <div className="card-header-row">
              <div><div className="card-title">Recent stock movements</div><div className="card-subtitle">Every receipt, issue, return, and correction stays in the history.</div></div>
              {canManageInventory && <button className="text-link" onClick={() => openMovementForm()}>Record movement <ArrowUpRight size={12} /></button>}
            </div>
            <div className="movement-list">{data.movements.slice(0, 8).map((movement) => <div className="movement-row" key={movement.id}><span className={`movement-icon ${movement.quantityDelta < 0 ? 'out' : 'in'}`}>{movement.quantityDelta < 0 ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}</span><div className="movement-description"><strong>{movement.itemName}</strong><small>{movement.type.toLowerCase().replace('_', ' ')}{movement.counterparty ? ` · ${movement.counterparty}` : movement.note ? ` · ${movement.note}` : ''}</small></div><div className={`movement-quantity ${movement.quantityDelta < 0 ? 'negative' : 'positive'}`}>{movement.quantityDelta > 0 ? '+' : '−'}{Math.abs(movement.quantityDelta).toLocaleString('en-PK')} <small>{movement.unit}</small></div><time>{shortDate(movement.date)}</time>{movement.transactionId && <span className="movement-linked">Purchase linked</span>}</div>)}</div>
            {!data.movements.length && <div className="empty-state">Stock movement history will appear here.</div>}
          </section>
          <p className="footer-note">Stock quantities are based on recorded movements. Stock value and cost-of-goods-sold are not calculated in this release.</p>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-[560px] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">{mode === 'item' ? 'Add inventory item' : mode === 'itemEdit' ? 'Edit inventory item' : 'Record stock movement'}</DialogTitle>
            <DialogDescription>{mode === 'item' || mode === 'itemEdit' ? 'Set up item details and a low-stock threshold. Existing stock history is preserved.' : 'Stock changes are kept in a dated movement history.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <div className="form-grid">
              {mode === 'item' || mode === 'itemEdit' ? <>
                <div className="form-field full"><Label htmlFor="item-name">Item name</Label><Input id="item-name" required maxLength={100} value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="e.g. A4 paper packs" className="h-11 rounded-xl" /></div>
                <div className="form-field"><Label htmlFor="item-sku">SKU (optional)</Label><Input id="item-sku" maxLength={40} value={sku} onChange={(event) => setSku(event.target.value)} placeholder="e.g. PAP-A4" className="h-11 rounded-xl" /></div>
                <div className="form-field"><Label htmlFor="item-category">Category</Label><Input id="item-category" maxLength={60} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. Supplies" className="h-11 rounded-xl" /></div>
                <div className="form-field"><Label htmlFor="item-unit">Unit of measure</Label><Input id="item-unit" required maxLength={24} value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="pcs, kg, metres…" className="h-11 rounded-xl" /></div>
                <div className="form-field"><Label htmlFor="item-reorder">Low-stock alert at</Label><Input id="item-reorder" type="number" min="0" step="0.01" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} className="h-11 rounded-xl" /></div>
              </> : <>
                <div className="form-field full"><Label htmlFor="move-type">Movement type</Label>
                  <Select value={movementType} onValueChange={(value) => setMovementType(value as MovementType)}>
                    <SelectTrigger id="move-type" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="RECEIPT">Stock received</SelectItem><SelectItem value="ISSUE">Stock issued / used</SelectItem><SelectItem value="RETURN">Stock returned</SelectItem><SelectItem value="ADJUSTMENT">Stock-count adjustment</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="form-field full"><Label htmlFor="move-item">Inventory item</Label>
                  <Select value={itemId} onValueChange={setItemId}>
                    <SelectTrigger id="move-item" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{data.items.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name} · {item.stockOnHand} {item.unit} on hand</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {movementType === 'ADJUSTMENT' && <div className="form-field full"><Label htmlFor="move-direction">Adjustment direction</Label>
                  <Select value={adjustmentDirection} onValueChange={(value) => setAdjustmentDirection(value as 'INCREASE' | 'DECREASE')}>
                    <SelectTrigger id="move-direction" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="INCREASE">Increase recorded quantity</SelectItem><SelectItem value="DECREASE">Decrease recorded quantity</SelectItem></SelectContent>
                  </Select>
                </div>}
                <div className="form-field"><Label htmlFor="move-qty">Quantity ({selectedItem?.unit ?? 'units'})</Label><Input id="move-qty" type="number" min="0.01" step="0.01" required value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="e.g. 24" className="h-11 rounded-xl" /></div>
                <div className="form-field"><Label htmlFor="move-date">Date</Label><Input id="move-date" type="date" required value={movementDate} onChange={(event) => setMovementDate(event.target.value)} className="h-11 rounded-xl" /></div>
                {movementType === 'RECEIPT' && <>
                  <div className="form-field"><Label htmlFor="move-cost">Unit cost in PKR (optional)</Label><Input id="move-cost" type="number" min="0" step="1" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder="Leave blank if not paid" className="h-11 rounded-xl" /></div>
                  <div className="form-field"><Label htmlFor="move-vendor">Vendor / source (optional)</Label><Input id="move-vendor" maxLength={120} value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder="Supplier name" className="h-11 rounded-xl" /></div>
                  {unitCost !== '' && Number(unitCost) > 0 && <div className="form-field full"><Label htmlFor="move-account">Paid from</Label>
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger id="move-account" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{data.accounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="field-hint">Saving a unit cost creates a matching expense in your transaction ledger.</span>
                  </div>}
                </>}
                {movementType !== 'RECEIPT' && <div className="form-field full"><Label htmlFor="move-note">Reason / reference</Label><Input id="move-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder={movementType === 'ADJUSTMENT' ? 'Required context for the stock count correction' : 'e.g. Used for client project'} required={movementType === 'ADJUSTMENT'} className="h-11 rounded-xl" /></div>}
              </>}
            </div>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <DialogFooter className="mt-5 gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-full px-5" disabled={saving} onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="h-11 rounded-full px-6" disabled={saving}>{saving ? 'Saving…' : <><Check size={15} /> {mode === 'itemEdit' ? 'Save changes' : mode === 'item' ? 'Create item' : 'Save movement'}</>}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
