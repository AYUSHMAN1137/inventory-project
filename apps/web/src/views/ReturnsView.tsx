import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, PackageCheck, RotateCcw } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { newCommandId, returnsApi } from '../lib/api';
import { Badge, Callout, EmptyState, LoadingState, Modal } from '../components/common/ui';
import type { Allocation, ReturnCondition } from '../types';

const CONDITIONS: { value: ReturnCondition; label: string; tone: string }[] = [
  { value: 'WORKING', label: 'Working — restock', tone: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { value: 'NEEDS_CHECKING', label: 'Needs checking', tone: 'border-amber-500 bg-amber-50 text-amber-700' },
  { value: 'NOT_WORKING', label: 'Not working — quarantine', tone: 'border-rose-500 bg-rose-50 text-rose-700' },
];

function ReturnModal({ allocation, onClose }: { allocation: Allocation | null; onClose: () => void }) {
  const { refresh, refreshAllocations, refreshDashboard } = useLab();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [conditions, setConditions] = useState<Record<string, ReturnCondition>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!allocation) return null;

  const outstanding = allocation.outstandingLines;
  const qtyFor = (lineId: string, max: number) => Math.min(quantities[lineId] ?? max, max);
  const condFor = (lineId: string) => conditions[lineId] ?? 'WORKING';

  async function submit() {
    if (!allocation) return;
    setError(null);
    const lines = outstanding
      .map((l) => {
        const remaining = l.quantity - l.returnedQty;
        const qty = qtyFor(l.id, remaining);
        const isSerialized = l.requestLine?.item.trackingMode === 'SERIALIZED';
        const issuedUnitIds = l.units.map((u) => u.unitId);
        return {
          issueLineId: l.id,
          quantity: qty,
          condition: condFor(l.id),
          ...(isSerialized ? { unitIds: issuedUnitIds.slice(0, qty) } : {}),
        };
      })
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      setError('Enter at least one quantity to return.');
      return;
    }

    setBusy(true);
    try {
      await returnsApi.process({
        issueId: allocation.id,
        clientCommandId: newCommandId(),
        note: note.trim() || undefined,
        lines,
      });
      await Promise.all([refresh(), refreshAllocations(), refreshDashboard()]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Return failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!allocation}
      onClose={onClose}
      width="max-w-3xl"
      title="Check In Returned Items"
      subtitle={`${allocation.student.name} (${allocation.student.collegeId}) · ${allocation.project?.name ?? 'Personal'}`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            Process return
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {outstanding.map((line) => {
          const item = line.requestLine?.item;
          const remaining = line.quantity - line.returnedQty;
          const qty = qtyFor(line.id, remaining);
          return (
            <div key={line.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-strong)]">{item?.name ?? 'Item'}</p>
                  {line.units.length > 0 && (
                    <p className="mono mt-0.5 text-[11px] text-[var(--text-muted)]">
                      Issued units: {line.units.map((u) => u.unit.assetCode).join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-[var(--text-muted)]">Outstanding: {remaining}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={remaining}
                  className="input mono w-20 text-center"
                  value={qty}
                  onChange={(e) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [line.id]: Math.max(0, Math.min(remaining, Number(e.target.value))),
                    }))
                  }
                />
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">Condition on return</p>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c.value}
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${
                        condFor(line.id) === c.value ? c.tone : 'border-[var(--border-strong)] bg-white text-[var(--text-muted)]'
                      }`}
                      onClick={() => setConditions((prev) => ({ ...prev, [line.id]: c.value }))}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        <div>
          <label className="label">Check-in note (optional)</label>
          <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Modal>
  );
}

export function ReturnsView() {
  const { allocations, loading } = useLab();
  const [selected, setSelected] = useState<Allocation | null>(null);

  const active = useMemo(() => allocations.filter((a) => !a.isFullyReturned), [allocations]);

  if (loading) return <LoadingState label="Loading returns desk…" />;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Returns Desk</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Check returned equipment back into the lab and record its condition.
        </p>
      </div>

      {active.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<PackageCheck size={22} />}
            title="No outstanding loans"
            description="Every issued item has been returned. New loans will appear here once items are issued."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Allocated to</th>
                  <th>Outstanding items</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {active.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <p className="font-medium text-[var(--text-strong)]">{a.student.name}</p>
                      <p className="mono text-xs text-[var(--text-muted)]">{a.student.collegeId}</p>
                    </td>
                    <td className="text-xs">{a.project?.name ?? 'Personal'}</td>
                    <td className="text-xs">
                      {a.outstandingLines.map((l) => (
                        <div key={l.id} className="flex items-center gap-2">
                          <span className="truncate">{l.requestLine?.item.name ?? 'Item'}</span>
                          <Badge tone="neutral">×{l.quantity - l.returnedQty}</Badge>
                        </div>
                      ))}
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {a.expectedReturnDate
                        ? new Date(a.expectedReturnDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        : '—'}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <button className="btn btn-primary btn-sm" onClick={() => setSelected(a)}>
                          <CheckCircle2 size={13} /> Check in
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ReturnModal allocation={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
