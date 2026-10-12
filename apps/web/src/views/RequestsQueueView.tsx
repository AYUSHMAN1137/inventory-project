import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, ThumbsDown, ThumbsUp, Inbox } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { requestsApi } from '../lib/api';
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

type Filter = 'PENDING' | 'DECIDED' | 'ALL';

function DecisionModal({
  request,
  onClose,
}: {
  request: LabRequest | null;
  onClose: () => void;
}) {
  const { refreshRequests, refreshItems, refreshDashboard, items } = useLab();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qtyFor = (lineId: string, requested: number) => quantities[lineId] ?? requested;

type DecisionStatusValue = 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';

  const derived = useMemo(() => {
    if (!request) return { status: 'REJECTED' as DecisionStatusValue, approvedTotal: 0, requestedTotal: 0 };
    const requestedTotal = request.lines.reduce((s, l) => s + l.requestedQty, 0);
    const approvedTotal = request.lines.reduce((s, l) => s + qtyFor(l.id, l.requestedQty), 0);
    const status: DecisionStatusValue =
      approvedTotal === 0 ? 'REJECTED' : approvedTotal === requestedTotal ? 'APPROVED' : 'PARTIALLY_APPROVED';
    return { status, approvedTotal, requestedTotal };
  }, [request, quantities]);

  if (!request) return null;

  async function submit() {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      await requestsApi.decide(request.id, {
        status: derived.status,
        decisionReason: reason.trim() || undefined,
        lines: request.lines.map((l) => ({
          lineId: l.id,
          approvedQuantity: qtyFor(l.id, l.requestedQty),
        })),
      });
      await Promise.all([refreshRequests(), refreshItems(), refreshDashboard()]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      width="max-w-3xl"
      title="Review Request"
      subtitle={`${request.requester.name} (${request.requester.collegeId}) · ${request.targetType === 'PROJECT' ? request.project?.name : 'Personal'}`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn ${derived.status === 'REJECTED' ? 'btn-danger' : 'btn-primary'}`}
            onClick={submit}
            disabled={busy}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {derived.status === 'REJECTED'
              ? 'Reject request'
              : derived.status === 'APPROVED'
                ? 'Approve all'
                : 'Partially approve'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border bg-[var(--bg-subtle)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Purpose</p>
          <p className="mt-1 text-sm text-[var(--text-strong)]">{request.purpose}</p>
          {request.expectedReturnDate && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Expected return: {new Date(request.expectedReturnDate).toLocaleDateString('en-IN')}
            </p>
          )}
        </div>

        <div>
          <p className="label">Approve quantities</p>
          <div className="overflow-hidden rounded-lg border">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Requested</th>
                  <th className="text-right">In stock</th>
                  <th className="text-right">Approve</th>
                </tr>
              </thead>
              <tbody>
                {request.lines.map((line) => {
                  const stock = items.find((i) => i.id === line.itemId)?.availableQuantity ?? 0;
                  const value = qtyFor(line.id, line.requestedQty);
                  return (
                    <tr key={line.id}>
                      <td>
                        <p className="text-sm font-medium text-[var(--text-strong)]">{line.item.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {line.item.nature === 'CONSUMABLE' ? 'Consumable' : 'Returnable'}
                        </p>
                      </td>
                      <td className="mono text-right text-sm">{line.requestedQty}</td>
                      <td className="text-right">
                        <span className={`mono text-sm ${stock < line.requestedQty ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}`}>
                          {stock}
                        </span>
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          min={0}
                          max={line.requestedQty}
                          className="input mono w-20 text-center"
                          value={value}
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [line.id]: Math.max(0, Math.min(line.requestedQty, Number(e.target.value))),
                            }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              Approving <span className="mono font-semibold text-[var(--text-strong)]">{derived.approvedTotal}</span> of{' '}
              <span className="mono">{derived.requestedTotal}</span> units
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setQuantities(Object.fromEntries(request.lines.map((l) => [l.id, l.requestedQty])))
                }
              >
                <ThumbsUp size={12} /> Approve all
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setQuantities(Object.fromEntries(request.lines.map((l) => [l.id, 0])))}
              >
                <ThumbsDown size={12} /> Reject all
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="label">Decision note (optional)</label>
          <textarea
            className="textarea"
            rows={2}
            placeholder="e.g. Only 1 LiDAR available this week; remaining approved next cycle."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {derived.status === 'REJECTED' && (
          <Callout tone="warn" title="This will reject the entire request">
            Setting all quantities to zero marks the request as Rejected. The student will be notified via their request list.
          </Callout>
        )}

        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Modal>
  );
}

export function RequestsQueueView() {
  const { requests, loading } = useLab();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [selected, setSelected] = useState<LabRequest | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return requests;
    if (filter === 'PENDING') return requests.filter((r) => r.decisionStatus === 'PENDING');
    return requests.filter((r) => r.decisionStatus !== 'PENDING');
  }, [requests, filter]);

  const pendingCount = requests.filter((r) => r.decisionStatus === 'PENDING').length;

  if (loading) return <LoadingState label="Loading request queue…" />;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Request Queue</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {pendingCount} request{pendingCount === 1 ? '' : 's'} awaiting your decision.
          </p>
        </div>
        <div className="flex rounded-lg border bg-white p-0.5">
          {(['PENDING', 'DECIDED', 'ALL'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'PENDING' ? `Pending (${pendingCount})` : f === 'DECIDED' ? 'Decided' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Inbox size={22} />}
            title={filter === 'PENDING' ? 'No pending requests' : 'Nothing to show'}
            description={
              filter === 'PENDING'
                ? 'Every request has been reviewed. New student requests will appear here.'
                : 'Try a different filter to see past decisions.'
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Requester</th>
                  <th>Purpose</th>
                  <th>For</th>
                  <th className="text-right">Items</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <p className="font-medium text-[var(--text-strong)]">{r.requester.name}</p>
                      <p className="mono text-xs text-[var(--text-muted)]">{r.requester.collegeId}</p>
                    </td>
                    <td className="max-w-xs">
                      <p className="truncate text-sm">{r.purpose}</p>
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {r.targetType === 'PROJECT' ? r.project?.name ?? 'Project' : 'Personal'}
                    </td>
                    <td className="mono text-right text-sm">{r.lines.length}</td>
                    <td>
                      <Badge tone={decisionTone(r.decisionStatus)}>{decisionLabel(r.decisionStatus)}</Badge>
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        {r.decisionStatus === 'PENDING' ? (
                          <button className="btn btn-primary btn-sm" onClick={() => setSelected(r)}>
                            Review <ArrowRight size={13} />
                          </button>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(r)}>
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DecisionModal request={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
