import { useMemo, useState } from 'react';
import { Loader2, PackagePlus, Plus } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { inventoryApi, newCommandId } from '../lib/api';
import { Badge, Callout, Modal, natureTone } from '../components/common/ui';
import type { CreateItemPayload, ItemNature, TrackingMode } from '../types';

function NewItemModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { categories, locations, refresh } = useLab();
  const [form, setForm] = useState<CreateItemPayload>({
    name: '',
    model: '',
    description: '',
    categoryId: '',
    nature: 'RETURNABLE',
    trackingMode: 'SERIALIZED',
    unitOfMeasure: 'pcs',
    lowStockThreshold: null,
    defaultLocationId: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leafLocations = useMemo(() => locations.filter((l) => l.type !== 'LAB' && l.type !== 'ROOM'), [locations]);

  async function submit() {
    setError(null);
    if (form.name.trim().length < 2 || !form.categoryId) {
      setError('Enter an item name and choose a category.');
      return;
    }
    setBusy(true);
    try {
      await inventoryApi.createItem({
        ...form,
        name: form.name.trim(),
        lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : null,
      });
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create item');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New Catalogue Item"
      subtitle="Create the item definition first; stock is received separately."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create item
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="new-item-name">Item name</label>
          <input id="new-item-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="new-item-model">Model / part number</label>
            <input id="new-item-model" className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="new-item-category">Category</label>
            <select id="new-item-category" className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="new-item-description">Description</label>
          <textarea id="new-item-description" className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="new-item-nature">
              Type
            </label>
            <select
              id="new-item-nature"
              className="select"
              value={form.nature}
              onChange={(e) => setForm({ ...form, nature: e.target.value as ItemNature })}
            >
              <option value="RETURNABLE">Returnable</option>
              <option value="CONSUMABLE">Consumable</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="new-item-tracking">
              Tracking
            </label>
            <select
              id="new-item-tracking"
              className="select"
              value={form.trackingMode}
              onChange={(e) => setForm({ ...form, trackingMode: e.target.value as TrackingMode })}
            >
              <option value="SERIALIZED">Individually tracked</option>
              <option value="BULK">Quantity tracked</option>
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Minimum stock level (optional)</label>
            <input
              type="number"
              className="input"
              value={form.lowStockThreshold ?? ''}
              onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div>
            <label className="label">Default storage location</label>
            <select className="select" value={form.defaultLocationId ?? ''} onChange={(e) => setForm({ ...form, defaultLocationId: e.target.value || null })}>
              <option value="">Not assigned</option>
              {leafLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Modal>
  );
}

export function IntakeView() {
  const { items, locations, refresh, refreshDashboard } = useLab();
  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [assetCodes, setAssetCodes] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);

  const selectedItem = items.find((i) => i.id === itemId);
  const leafLocations = locations.filter((l) => l.type !== 'LAB' && l.type !== 'ROOM');

  const codeList = assetCodes
    .split(/[\n,]/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  async function submit() {
    setError(null);
    setSuccess(null);
    if (!itemId || !locationId) {
      setError('Select an item and a storage location.');
      return;
    }
    if (selectedItem?.trackingMode === 'SERIALIZED' && codeList.length === 0) {
      setError('Enter at least one asset code for serialized stock.');
      return;
    }
    if (selectedItem?.trackingMode === 'BULK' && !(Number(quantity) > 0)) {
      setError('Enter a positive quantity for bulk stock.');
      return;
    }

    setBusy(true);
    try {
      await inventoryApi.receiveStock({
        itemId,
        locationId,
        clientCommandId: newCommandId(),
        ...(selectedItem?.trackingMode === 'BULK' ? { quantity: Number(quantity) } : { assetCodes: codeList }),
        referenceNumber: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      await Promise.all([refresh(), refreshDashboard()]);
      setSuccess(`Recorded receipt of ${selectedItem?.trackingMode === 'BULK' ? quantity : codeList.length} ${selectedItem?.unitOfMeasure}.`);
      setQuantity('');
      setAssetCodes('');
      setNote('');
      setReference('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receipt failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Intake</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Record newly received components into a storage location.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowNewItem(true)}>
          <Plus size={15} /> New catalogue item
        </button>
      </div>

      <div className="card card-pad space-y-5">
        <div>
          <label className="label">Item</label>
          <select className="select" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Select an item…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {i.categoryName}
              </option>
            ))}
          </select>
          {selectedItem && (
            <div className="mt-2 flex gap-2">
              <Badge tone={natureTone(selectedItem.nature)}>
                {selectedItem.nature === 'CONSUMABLE' ? 'Consumable' : 'Returnable'}
              </Badge>
              <Badge tone="neutral">
                {selectedItem.trackingMode === 'SERIALIZED' ? 'Individually tracked' : 'Quantity tracked'}
              </Badge>
              <Badge tone="info">Currently {selectedItem.availableQuantity} available</Badge>
            </div>
          )}
        </div>

        <div>
          <label className="label">Storage location</label>
          <select className="select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Select a drawer / shelf / bin…</option>
            {leafLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.parent?.name ? `${l.parent.name} → ` : ''}
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {selectedItem?.trackingMode === 'SERIALIZED' ? (
          <div>
            <label className="label">Asset codes (one per unit, comma or newline separated)</label>
            <textarea
              className="textarea mono"
              rows={4}
              placeholder={'ARD-007\nARD-008\nARD-009'}
              value={assetCodes}
              onChange={(e) => setAssetCodes(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {codeList.length} unit(s) will be created and labelled with these codes.
            </p>
          </div>
        ) : (
          <div>
            <label className="label">Quantity received</label>
            <input
              type="number"
              min={1}
              className="input"
              placeholder="e.g. 25"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={!selectedItem}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Reference / invoice no. (optional)</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        {error && <Callout tone="danger">{error}</Callout>}
        {success && <Callout tone="ok">{success}</Callout>}

        <button className="btn btn-primary w-full" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <PackagePlus size={15} />}
          Record receipt
        </button>
      </div>

      <NewItemModal open={showNewItem} onClose={() => setShowNewItem(false)} />
    </div>
  );
}
