import { useState } from 'react';
import { AllocationIssue } from '../types';
import { RotateCcw, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

interface ReturnModalProps {
  allocation: AllocationIssue | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReturnModal({ allocation, isOpen, onClose, onSuccess }: ReturnModalProps) {
  const [condition, setCondition] = useState<'WORKING' | 'NEEDS_CHECKING' | 'NOT_WORKING'>('WORKING');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !allocation) return null;

  const handleReturn = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payloadLines = allocation.lines.map((line) => {
        const remaining = line.quantity - line.returnedQty;
        return {
          issueLineId: line.id,
          quantity: remaining,
          condition,
          note,
          unitId: line.units?.[0]?.unit?.id || undefined,
        };
      });

      await api('/returns', {
        method: 'POST',
        body: JSON.stringify({
          issueId: allocation.id,
          note,
          clientCommandId: crypto.randomUUID(),
          lines: payloadLines,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process return');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Process Equipment Return</h3>
              <p className="text-xs text-slate-400">Deep-Tech Innovation Centre Check-in</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Holding Student:</span>
              <span className="font-semibold text-white">{allocation.student.name} ({allocation.student.collegeId})</span>
            </div>
            {allocation.project && (
              <div className="flex justify-between">
                <span className="text-slate-400">Team:</span>
                <span className="font-semibold text-indigo-300">{allocation.project.name}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Returned Items
            </label>
            <div className="space-y-2">
              {allocation.lines.map((line) => {
                const remaining = line.quantity - line.returnedQty;
                if (remaining <= 0) return null;

                return (
                  <div key={line.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-white text-sm">{line.requestLine?.item.name}</div>
                      {line.units?.map((u) => (
                        <span key={u.id} className="inline-block font-mono text-[10px] px-2 py-0.5 mt-1 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20">
                          {u.unit.assetCode}
                        </span>
                      ))}
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-sky-400">{remaining} pcs</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Return Condition Check
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCondition('WORKING')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  condition === 'WORKING'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Working
              </button>
              <button
                type="button"
                onClick={() => setCondition('NEEDS_CHECKING')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  condition === 'NEEDS_CHECKING'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Needs Checking
              </button>
              <button
                type="button"
                onClick={() => setCondition('NOT_WORKING')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  condition === 'NOT_WORKING'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Damaged / Defect
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Check-in Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Returned in original anti-static box, fully tested"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <button
            onClick={handleReturn}
            disabled={isSubmitting}
            className="w-full py-3.5 mt-2 rounded-xl bg-sky-600 hover:bg-sky-500 font-semibold text-sm text-white shadow-lg shadow-sky-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isSubmitting ? 'Restoring Stock...' : 'Confirm Return & Restore Stock Balance'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
