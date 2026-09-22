import { useState } from 'react';
import { EquipmentRequest } from '../types';
import { Check, X, AlertCircle, ArrowRight, PackageCheck, User, Calendar } from 'lucide-react';

interface AdminHandoverModalProps {
  request: EquipmentRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminHandoverModal({ request, isOpen, onClose, onSuccess }: AdminHandoverModalProps) {
  const [collectorCollegeId, setCollectorCollegeId] = useState(request?.requester.collegeId || '');
  const [note, setNote] = useState('');
  const [selectedUnits, setSelectedUnits] = useState<{ [lineId: string]: string[] }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !request) return null;

  const handleIssue = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payloadLines = request.lines
        .filter((l) => l.approvedQty > l.issuedQty)
        .map((l) => ({
          requestLineId: l.id,
          quantity: l.approvedQty - l.issuedQty,
          unitIds: selectedUnits[l.id] || [],
        }));

      const res = await fetch('/api/v1/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          collectorCollegeId: collectorCollegeId || request.requester.collegeId,
          note,
          lines: payloadLines,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Handover failed');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Physical Handover / Issue</h3>
              <p className="text-xs text-slate-400">Lab Equipment Checkout Desk</p>
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
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Requester:</span>
              <span className="font-semibold text-white">{request.requester.name} ({request.requester.collegeId})</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Context:</span>
              <span className="font-semibold text-indigo-300">
                {request.targetType === 'PROJECT' ? `Team: ${request.project?.name}` : 'Individual'}
              </span>
            </div>
            <div className="text-xs text-slate-300 italic border-t border-slate-800 pt-2 mt-2">
              "{request.purpose}"
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Collector College ID Verification
            </label>
            <input
              type="text"
              value={collectorCollegeId}
              onChange={(e) => setCollectorCollegeId(e.target.value)}
              placeholder="e.g. 2024BCSE042"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Lines to Issue */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Approved Items for Handover
            </label>
            <div className="space-y-2">
              {request.lines.map((line) => {
                const remainingToIssue = line.approvedQty - line.issuedQty;
                if (remainingToIssue <= 0) return null;

                return (
                  <div key={line.id} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">{line.item.name}</div>
                      <div className="text-xs text-slate-400">
                        {line.item.nature} &bull; {line.item.trackingMode}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Quantity to Issue:</div>
                      <div className="font-bold text-emerald-400 text-base">
                        {remainingToIssue} {line.item.unitOfMeasure}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Issue Handover Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Handed over with USB cable and breadboard"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={handleIssue}
            disabled={isSubmitting}
            className="w-full py-3.5 mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            <PackageCheck className="w-5 h-5" />
            <span>{isSubmitting ? 'Recording Handover...' : 'Confirm Physical Handover & Deduct Stock'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
