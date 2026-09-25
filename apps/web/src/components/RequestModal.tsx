import { useState } from 'react';
import { InventoryItem } from '../types';
import { api } from '../lib/api';
import { Layers, Send, CheckCircle2, AlertCircle, ShoppingBag, X } from 'lucide-react';

interface RequestModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RequestModal({ item, isOpen, onClose, onSuccess }: RequestModalProps) {
  const [quantity, setQuantity] = useState(1);
  const targetType: 'PERSONAL' = 'PERSONAL';
  const [purpose, setPurpose] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await api('/requests', {
        method: 'POST',
        body: JSON.stringify({
          targetType,
          purpose,
          expectedReturnDate: expectedReturnDate ? new Date(`${expectedReturnDate}T12:00:00`).toISOString() : undefined,
          lines: [{ itemId: item.id, quantity }],
        }),
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Equipment Request</h3>
              <p className="text-xs text-slate-400">Deep-Tech Innovation Centre</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-xl font-bold text-white">Request Submitted!</h4>
            <p className="text-sm text-slate-400">Your request has been routed to the Lab Admin for review.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Selected Item Summary */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold mb-0.5">
                  {item.categoryName}
                </div>
                <div className="font-bold text-white text-base">{item.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{item.model || 'Standard Edition'}</div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  item.nature === 'RETURNABLE'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {item.nature}
                </span>
                <div className="text-xs text-slate-400 mt-1">
                  In stock: <strong className="text-white">{item.availableQuantity}</strong> {item.unitOfMeasure}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Request Context
              </label>
              <div className="py-2.5 px-4 rounded-xl border border-slate-800 bg-slate-950/40 text-xs text-slate-300">
                Personal request
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Quantity Needed ({item.unitOfMeasure})
              </label>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={item.availableQuantity || 100}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 text-center py-2 rounded-xl bg-slate-950 border border-slate-800 font-bold text-base text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {/* Expected Return Date if Returnable */}
            {item.nature === 'RETURNABLE' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Expected Return Date <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Purpose */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Project Purpose / Experiment Goal
              </label>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={2}
                placeholder="e.g. Prototyping obstacle detection with ultrasonic sensor on mobile rover chassis..."
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Request to Admin'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
