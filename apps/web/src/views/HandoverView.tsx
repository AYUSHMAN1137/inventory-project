import { useMemo, useState } from 'react';
import { ArrowLeftRight, BadgeCheck, Loader2, PackageCheck, UserCheck } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { issuesApi, newCommandId } from '../lib/api';
import {
  Badge,
  Callout,
  EmptyState,
  LoadingState,
  Modal,
  decisionLabel,
  decisionTone,
} from '../components/common/ui';
import type { LabRequest } from '../types';

function IssueModal({ request, onClose }: { request: LabRequest | null; onClose: () => void }) {
  const { items, refresh, refreshRequests } = useLab();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [unitSelection, setUnitSelection] = useState<Record<string, string[]>>({});
  const [collector, setCollector] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!request) return null;

  const approvedLines = request.lines.filter((l) => l.approvedQty - l.issuedQty > 0);
  const remainingFor = (lineId: string, max: number) => Math.min(quantities[lineId] ?? max, max);

  // Available serialized units for each line's item
  const unitsFor = (itemId: string) => items.find((i) => i.id === itemId)?.units?.filter((u) => u.status === 'AVAILABLE') ?? [];

  async function submit() {
    if (!request) return;
    setError(null);
    if (!collector.trim()) {
      setError('Enter the college ID of the student collecting the items.');
      return;
    }
    const lines = approvedLines.map((l) => {
      const qty = remainingFor(l.id, l.approvedQty - l.issuedQty);
      const isSerialized = l.item.trackingMode === 'SERIALIZED';
      return {
        requestLineId: l.id,
        quantity: qty,
        ...(isSerialized ? { unitIds: (unitSelection[l.id] ?? []).slice(0, qty) } : {}),
      };
    }).filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      setError('Select at least one quantity to issue.');
      return;
    }
    for (const line of approvedLines) {
      const qty = remainingFor(line.id, line.approvedQty - line.issuedQty);
      if (line.item.trackingMode === 'SERIALIZED' && (unitSelection[line.id]?.length ?? 0) !== qty && qty > 0) {
        setError(`Select exactly ${qty} unit(s) for ${line.item.name}.`);
        return;
      }
    }

    setBusy(true);
    try {
      await issuesApi.issue({
        requestId: request.id,
        collectorCollegeId: collector.trim(),
        note: note.trim() || undefined,
        clientCommandId: newCommandId(),
        lines,
      });
      await Promise.all([refresh(), refreshRequests()]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Issue failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      width="max-w-3xl"
      title="Issue Items at Counter"
      subtitle={`${request.requester.name} · ${request.targetType === 'PROJECT' ? request.project?.name : 'Personal'}`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <PackageCheck size={15} />}
            Confirm handover
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <Callout tone="info" title="Stock is reduced only at this step">
          Approval does not reserve stock. Recording the physical handover is what deducts inventory and marks
          serialized units as allocated.
        </Callout>

        <div>
          <label className="label">Student collecting the items</label>
          <div className="relative">
            <UserCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder={request.requester.collegeId}
              value={collector}
              onChange={(e) => setCollector(e.target.value.toUpperCase())}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Personal requests must be collected by the requester; project requests by any team member.
          </p>
        </div>

        <div className="space-y-4">
          {approvedLines.map((line) => {
            const remaining = line.approvedQty - line.issuedQty;
            const isSerialized = line.item.trackingMode === 'SERIALIZED';
            const available = unitsFor(line.itemId);
            const qty = remainingFor(line.id, remaining);
            const chosen = unitSelection[line.id] ?? [];

            return (
              <div key={line.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-strong)]">{line.item.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Approved {line.approvedQty} · already issued {line.issuedQty} · remaining {remaining}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={isSerialized ? 'accent' : 'warn'}>
                      {isSerialized ? 'Serialized' : 'Bulk'}
                    </Badge>
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
                </div>

                {isSerialized && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">
                      Select {qty} physical unit(s) — {available.length} available
                    </p>
                    {available.length === 0 ? (
                      <Callout tone="warn">No serialized units are currently available for this item.</Callout>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {available.map((u) => {
                          const isChosen = chosen.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              className={`mono rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                isChosen
                                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                  : 'border-[var(--border-strong)] bg-white text-[var(--text-body)] hover:border-[var(--accent)]'
                              }`}
                              onClick={() =>
                                setUnitSelection((prev) => {
                                  const cur = prev[line.id] ?? [];
                                  return {
                                    ...prev,
                                    [line.id]: isChosen
                                      ? cur.filter((id) => id !== u.id)
                                      : cur.length < qty
                                        ? [...cur, u.id]
                                        : cur,
                                  };
                                })
                              }
                            >
                              {u.assetCode}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <label className="label">Handover note (optional)</label>
          <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Modal>
  );
}

export function HandoverView() {
  const { requests, loading } = useLab();
  const [selected, setSelected] = useState<LabRequest | null>(null);

  const ready = useMemo(
    () =>
      requests.filter(
        (r) =>
          (r.decisionStatus === 'APPROVED' || r.decisionStatus === 'PARTIALLY_APPROVED') &&
          r.fulfilmentStatus !== 'FULFILLED',
      ),
    [requests],
  );

  if (loading) return <LoadingState label="Loading issue desk…" />;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Issue Desk</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Hand over approved items to students. This is the point where stock is deducted.
        </p>
      </div>

      {ready.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ArrowLeftRight size={22} />}
            title="Nothing waiting to be issued"
            description="Requests that have been approved will appear here so you can record the physical handover."
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {ready.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-strong)]">{r.requester.name}</p>
                  <p className="mono text-xs text-[var(--text-muted)]">{r.requester.collegeId}</p>
                </div>
                <div className="flex gap-1.5">
                  <Badge tone={decisionTone(r.decisionStatus)}>{decisionLabel(r.decisionStatus)}</Badge>
                  {r.fulfilmentStatus === 'PARTIALLY_ISSUED' && <Badge tone="warn">Partly issued</Badge>}
                </div>
              </div>

              <p className="mt-2 line-clamp-2 text-xs text-[var(--text-muted)]">{r.purpose}</p>

              <div className="mt-3 space-y-1.5">
                {r.lines
                  .filter((l) => l.approvedQty > 0)
                  .map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-md bg-[var(--bg-subtle)] px-3 py-2">
                      <span className="truncate text-xs text-[var(--text-body)]">{l.item.name}</span>
                      <span className="mono shrink-0 text-xs text-[var(--text-muted)]">
                        {l.issuedQty}/{l.approvedQty}
                      </span>
                    </div>
                  ))}
              </div>

              <button className="btn btn-primary mt-3 w-full" onClick={() => setSelected(r)}>
                <PackageCheck size={15} /> Issue at counter
              </button>
            </div>
          ))}
        </div>
      )}

      <IssueModal request={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export { BadgeCheck };
