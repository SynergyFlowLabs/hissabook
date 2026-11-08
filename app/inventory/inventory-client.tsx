'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDownLeft, ArrowUpRight, Archive, Boxes, Check, Pencil, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import AppSidebar from '@/components/app-sidebar';

type InventoryData = {
  workspace: { id: number; name: string; currency: string };
  accounts: Array<{ id: number; name: string; currency: string }>;
  items: Array<{ id: number; name: string; sku: string; category: string; unit: string; reorderLevel: number; active: number; stockOnHand: number; lowStock: number }>;
  movements: Array<{ id: number; itemId: number; itemName: string; unit: string; type: string; quantityDelta: number; unitCost: number | null; counterparty: string; note: string; date: string; transactionId: number | null }>;
  summary: { totalItems: number; activeItems: number; lowStock: number };
};

type FormMode = 'item' | 'itemEdit' | 'movement';
type MovementType = 'RECEIPT' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT';

const money = (amount: number) => `₨ ${Math.abs(amount).toLocaleString('en-PK')}`;
const shortDate = (date: string) => new Date(date).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' });

export default function InventoryClient({ userName, role }: { userName: string; role: string }) {
  const canManageInventory = ['OWNER', 'ADMIN', 'BOOKKEEPER'].includes(role);
  const [data, setData] = useState<InventoryData | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<FormMode>('item');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState('');
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
    setData(result as InventoryData);
    if (result.items[0]) setItemId((current: string) => current || String(result.items[0].id));
    if (result.accounts[0]) setAccountId((current: string) => current || String(result.accounts[0].id));
  };

  useEffect(() => { refresh().catch((reason: Error) => setError(reason.message)); }, []);

  const filteredItems = useMemo(() => (data?.items ?? []).filter((item) => `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const selectedItem = data?.items.find((item) => String(item.id) === itemId);
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000); };

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
      setData(result as InventoryData); showToast('Item archived. Its movement history was kept.');
    } catch (reason) { showToast(reason instanceof Error ? reason.message : 'Could not archive this item.'); }
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
      setData(result as InventoryData);
      if (result.items[0]) setItemId(String(result.items[0].id));
      if (result.accounts[0]) setAccountId(String(result.accounts[0].id));
      setDialogOpen(false);
      if (isItemForm) { setItemName(''); setSku(''); setCategory('General'); setUnit('pcs'); setReorderLevel('0'); setEditingItemId(null); }
      showToast(mode === 'itemEdit' ? 'Inventory item updated.' : mode === 'item' ? 'Inventory item created.' : 'Stock movement recorded.' );
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Could not save this record.'); }
    finally { setSaving(false); }
  };

  if (!data) return <div className="loading-screen"><div className="brand-mark"><Boxes size={20} /></div><strong>{error || 'Loading inventory…'}</strong><span>{error ? 'Refresh the page to try again.' : 'Preparing your stock records'}</span></div>;

  return <div className="app-shell" id="overview">
    <AppSidebar workspaceName={data.workspace.name} businessType="Inventory" userName={userName} userRole={role} current="inventory" />
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><a href="/#overview">Workspace</a><span>/</span><strong>Inventory</strong></div><div className="top-actions"><span className="currency-badge">PKR workspace</span></div></header>
      <div className="content">
        <section className="page-heading"><div><div className="eyebrow">STOCK CONTROL</div><h1 className="page-title">Inventory</h1><div className="page-subtitle">Know what you have, what’s moving, and what needs a restock.</div></div>{canManageInventory && <div className="inventory-heading-actions"><button className="subtle-button" onClick={() => openMovementForm()}><ArrowDownLeft size={13} /> Record stock</button><button className="primary-button" onClick={openItemForm}><Plus size={15} /> Add item</button></div>}</section>
        <section className="stats-grid inventory-stats">
          <div className="stat-card"><div className="stat-top"><span className="stat-label">Active items</span><span className="stat-icon inventory-stat-icon"><Boxes size={15} /></span></div><div className="stat-value">{data.summary.activeItems}</div><div className="stat-foot">Across your item catalogue</div></div>
          <div className="stat-card"><div className="stat-top"><span className="stat-label">Needs restocking</span><span className="stat-icon inventory-stat-warn"><ArrowDownLeft size={15} /></span></div><div className="stat-value">{data.summary.lowStock}</div><div className="stat-foot">At or below reorder level</div></div>
          <div className="stat-card"><div className="stat-top"><span className="stat-label">Stock movements</span><span className="stat-icon inventory-stat-blue"><ArrowLeftRightIcon /></span></div><div className="stat-value">{data.movements.length}</div><div className="stat-foot">Latest recorded movements</div></div>
          <div className="stat-card"><div className="stat-top"><span className="stat-label">Stock value</span><span className="stat-icon inventory-stat-gold"><SlidersHorizontal size={15} /></span></div><div className="stat-value inventory-na">Not calculated</div><div className="stat-foot">No valuation method configured</div></div>
        </section>

        <section className="panel inventory-panel">
          <div className="panel-header"><div><div className="panel-title">Item catalogue</div><div className="panel-subtitle">On-hand quantity is based on the movement history.</div></div><label className="inventory-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items or SKU" aria-label="Search inventory" /></label></div>
          <div className="inventory-table-wrap"><table className="transaction-table inventory-table"><thead><tr><th>Item</th><th>Category</th><th>On hand</th><th>Reorder at</th><th>Status</th><th></th></tr></thead><tbody>{filteredItems.length ? filteredItems.map((item) => <tr key={item.id}><td><div className="inventory-item-name">{item.name}<small>{item.sku || 'No SKU'} · {item.unit}</small></div></td><td className="table-muted">{item.category}</td><td className="inventory-quantity">{Number(item.stockOnHand).toLocaleString('en-PK')} <small>{item.unit}</small></td><td className="table-muted">{Number(item.reorderLevel).toLocaleString('en-PK')} {item.unit}</td><td><span className={`stock-pill ${item.lowStock ? 'low' : 'healthy'}`}><i />{item.lowStock ? 'Restock soon' : 'In stock'}</span></td><td>{canManageInventory && <div className="inventory-row-actions"><button className="link-button" onClick={() => openMovementForm(item.id)}>Stock</button><button className="row-icon-button" aria-label={`Edit ${item.name}`} onClick={() => openEditItem(item)}><Pencil size={12} /></button><button className="row-icon-button archive" aria-label={`Archive ${item.name}`} onClick={() => archiveItem(item)}><Archive size={12} /></button></div>}</td></tr>) : <tr><td colSpan={6} className="inventory-empty">No inventory items match that search.</td></tr>}</tbody></table></div>
          {!data.items.length && <div className="empty-state">Add your first stock item to start tracking inventory.</div>}
        </section>

        <section className="panel inventory-panel movement-panel">
          <div className="panel-header"><div><div className="panel-title">Recent stock movements</div><div className="panel-subtitle">Every receipt, issue, return, and correction stays in the history.</div></div>{canManageInventory && <button className="link-button" onClick={() => openMovementForm()}>Record movement <ArrowUpRight size={12} style={{ verticalAlign: 'middle', marginLeft: 3 }} /></button>}</div>
          <div className="movement-list">{data.movements.slice(0, 8).map((movement) => <div className="movement-row" key={movement.id}><span className={`movement-icon ${movement.quantityDelta < 0 ? 'out' : 'in'}`}>{movement.quantityDelta < 0 ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}</span><div className="movement-description"><strong>{movement.itemName}</strong><small>{movement.type.toLowerCase().replace('_', ' ')}{movement.counterparty ? ` · ${movement.counterparty}` : movement.note ? ` · ${movement.note}` : ''}</small></div><div className={`movement-quantity ${movement.quantityDelta < 0 ? 'negative' : 'positive'}`}>{movement.quantityDelta > 0 ? '+' : '−'}{Math.abs(movement.quantityDelta).toLocaleString('en-PK')} <small>{movement.unit}</small></div><time>{shortDate(movement.date)}</time>{movement.transactionId && <span className="movement-linked">Purchase linked</span>}</div>)}</div>
          {!data.movements.length && <div className="empty-state">Stock movement history will appear here.</div>}
        </section>
        <div className="footer-note">Stock quantities are based on recorded movements. Stock value and cost-of-goods-sold are not calculated in this release.</div>
      </div>
    </main>

    <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-card"><div className="dialog-header"><div><Dialog.Title className="dialog-title">{mode === 'item' ? 'Add inventory item' : mode === 'itemEdit' ? 'Edit inventory item' : 'Record stock movement'}</Dialog.Title><Dialog.Description className="dialog-description">{mode === 'item' || mode === 'itemEdit' ? 'Set up item details and a low-stock threshold. Existing stock history is preserved.' : 'Stock changes are kept in a dated movement history.'}</Dialog.Description></div><Dialog.Close asChild><button className="close-button" aria-label="Close"><X size={15} /></button></Dialog.Close></div>
      <form onSubmit={submit}><div className="form-grid">{mode === 'item' || mode === 'itemEdit' ? <>
        <label className="form-field full"><span className="form-label">Item name</span><input className="form-control" required maxLength={100} value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="e.g. A4 paper packs" /></label>
        <label className="form-field"><span className="form-label">SKU (optional)</span><input className="form-control" maxLength={40} value={sku} onChange={(event) => setSku(event.target.value)} placeholder="e.g. PAP-A4" /></label>
        <label className="form-field"><span className="form-label">Category</span><input className="form-control" maxLength={60} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. Supplies" /></label>
        <label className="form-field"><span className="form-label">Unit of measure</span><input className="form-control" required maxLength={24} value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="pcs, kg, metres…" /></label>
        <label className="form-field"><span className="form-label">Low-stock alert at</span><input className="form-control" type="number" min="0" step="0.01" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} /></label>
      </> : <>
        <label className="form-field full"><span className="form-label">Movement type</span><select className="form-control" value={movementType} onChange={(event) => setMovementType(event.target.value as MovementType)}><option value="RECEIPT">Stock received</option><option value="ISSUE">Stock issued / used</option><option value="RETURN">Stock returned</option><option value="ADJUSTMENT">Stock-count adjustment</option></select></label>
        <label className="form-field full"><span className="form-label">Inventory item</span><select className="form-control" required value={itemId} onChange={(event) => setItemId(event.target.value)}>{data.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.stockOnHand} {item.unit} on hand</option>)}</select></label>
        {movementType === 'ADJUSTMENT' && <label className="form-field full"><span className="form-label">Adjustment direction</span><select className="form-control" value={adjustmentDirection} onChange={(event) => setAdjustmentDirection(event.target.value as 'INCREASE' | 'DECREASE')}><option value="INCREASE">Increase recorded quantity</option><option value="DECREASE">Decrease recorded quantity</option></select></label>}
        <label className="form-field"><span className="form-label">Quantity ({selectedItem?.unit ?? 'units'})</span><input className="form-control" type="number" min="0.01" step="0.01" required value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="e.g. 24" /></label>
        <label className="form-field"><span className="form-label">Date</span><input className="form-control" type="date" required value={movementDate} onChange={(event) => setMovementDate(event.target.value)} /></label>
        {movementType === 'RECEIPT' && <><label className="form-field"><span className="form-label">Unit cost in PKR (optional)</span><input className="form-control" type="number" min="0" step="1" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder="Leave blank if not paid" /></label><label className="form-field"><span className="form-label">Vendor / source (optional)</span><input className="form-control" maxLength={120} value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder="Supplier name" /></label>{unitCost !== '' && Number(unitCost) > 0 && <label className="form-field full"><span className="form-label">Paid from</span><select className="form-control" required value={accountId} onChange={(event) => setAccountId(event.target.value)}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><span className="field-hint">Saving a unit cost creates a matching expense in your transaction ledger.</span></label>}</>}
        {movementType !== 'RECEIPT' && <label className="form-field full"><span className="form-label">Reason / reference</span><input className="form-control" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder={movementType === 'ADJUSTMENT' ? 'Required context for the stock count correction' : 'e.g. Used for client project'} required={movementType === 'ADJUSTMENT'} /></label>}
      </>}</div>{formError && <div className="form-error" role="alert">{formError}</div>}<div className="dialog-footer"><Dialog.Close asChild><button type="button" className="cancel-button" disabled={saving}>Cancel</button></Dialog.Close><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : <><Check size={14} /> {mode === 'itemEdit' ? 'Save changes' : mode === 'item' ? 'Create item' : 'Save movement'}</>}</button></div></form>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    {toast && <div role="status" className="toast">{toast}</div>}
  </div>;
}

function ArrowLeftRightIcon() {
  return <span aria-hidden="true">↔</span>;
}
