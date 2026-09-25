import { useState } from 'react';
import { InventoryItem, LocationHierarchy } from '../types';
import { PackagePlus, X, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

interface StockReceiptModalProps {
  items: InventoryItem[];
  locations: LocationHierarchy[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StockReceiptModal({ items, locations, isOpen, onClose, onSuccess }: StockReceiptModalProps) {
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [assetCodesText, setAssetCodesText] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentItem = items.find((i) => i.id === selectedItemId) || items[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const assetCodes = currentItem?.trackingMode === 'SERIALIZED'
        ? assetCodesText
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      if (currentItem?.trackingMode === 'SERIALIZED' && assetCodes.length === 0) {
        throw new Error('Please provide at least one asset code (e.g. ARD-003) for serialized tracking.');
      }

      await api('/stock-receipts', {
        method: 'POST',
        body: JSON.stringify({
          itemId: selectedItemId || currentItem?.id,
          locationId: selectedLocationId || locations[0]?.id,
          quantity: currentItem?.trackingMode === 'SERIALIZED' ? assetCodes.length : quantity,
          assetCodes,
          note,
          clientCommandId: crypto.randomUUID(),
        }),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Stock receipt failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Stock Receiving Intake</h3>
              <p className="text-xs text-slate-400">Add received inventory to laboratory custody</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Item
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.nature} &bull; {i.trackingMode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Storage Location
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.type})
                </option>
              ))}
            </select>
          </div>

          {currentItem?.trackingMode === 'SERIALIZED' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Asset Codes / Barcodes (One per line or comma separated)
              </label>
              <textarea
                value={assetCodesText}
                onChange={(e) => setAssetCodesText(e.target.value)}
                placeholder="e.g. ARD-003&#10;ARD-004&#10;ARD-005"
                rows={3}
                required
                className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 resize-none"
              />
              <div className="text-[10px] text-slate-400 mt-1">
                Total serialized units to register: {assetCodesText.split(/[\n,]/).filter((s) => s.trim()).length}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Received Quantity ({currentItem?.unitOfMeasure || 'pcs'})
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Receiving Note / Batch Reference (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Received from college procurement batch 2026-A"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            <PackagePlus className="w-5 h-5" />
            <span>{isSubmitting ? 'Recording Intake...' : 'Add Received Stock to Inventory'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
