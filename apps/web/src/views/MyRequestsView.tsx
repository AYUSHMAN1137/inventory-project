import { useState } from 'react';
import { Clock, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLab } from '../context/LabContext';
import { requestsApi } from '../lib/api';
import {
  Badge,
  Callout,
  EmptyState,
  LoadingState,
  decisionLabel,
  decisionTone,
  fulfilmentTone,
} from '../components/common/ui';
import type { LabRequest } from '../types';

export function RequestCard({ request, showRequester = false }: { request: LabRequest; showRequester?: boolean }) {
  const { refreshRequests } = useLab();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await requestsApi.cancel(request.id);
      await refreshRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }

  const canCancel = request.decisionStatus === 'PENDING';

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={decisionTone(request.decisionStatus)}>{decisionLabel(request.decisionStatus)}</Badge>
            <Badge tone={fulfilmentTone(request.fulfilmentStatus)}>
              {request.fulfilmentStatus.replace(/_/g, ' ').toLowerCase()}
            </Badge>
            <Badge tone="neutral">{request.targetType === 'PROJECT' ? 'Project' : 'Personal'}</Badge>
          </div>
          <p className="mt-2 text-sm font-semibold text-[var(--text-strong)]">{request.purpose}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {showRequester && (
              <>
                <span className="font-medium text-[var(--text-body)]">{request.requester.name}</span> (
                <span className="mono">{request.requester.collegeId}</span>) ·{' '}
              </>
            )}
            {request.project ? `${request.project.name} · ` : ''}
            Submitted {new Date(request.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
          {request.expectedReturnDate && (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Expected return: {new Date(request.expectedReturnDate).toLocaleDateString('en-IN')}
            </p>
          )}
        </div>

        {canCancel && (
          <button className="btn btn-ghost btn-sm text-[var(--danger)]" onClick={cancel} disabled={busy}>
            <XCircle size={13} /> {busy ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Requested</th>
              <th className="text-right">Approved</th>
              <th className="text-right">Issued</th>
              <th className="text-right">Pending</th>
            </tr>
          </thead>
          <tbody>
            {request.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <p className="text-sm font-medium text-[var(--text-strong)]">{line.item.name}</p>
                  {line.rejectionReason && (
                    <p className="mt-0.5 text-[11px] text-[var(--danger)]">Rejected: {line.rejectionReason}</p>
                  )}
                </td>
                <td className="mono text-right text-xs">{line.requestedQty}</td>
                <td className="mono text-right text-xs">{line.approvedQty}</td>
                <td className="mono text-right text-xs">{line.issuedQty}</td>
                <td className="mono text-right text-xs">
                  {Math.max(0, line.approvedQty - line.issuedQty) || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {request.decisionReason && (
        <div className="mt-3">
          <Callout tone="info" title="Admin note">
            {request.decisionReason}
          </Callout>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <Callout tone="danger">{error}</Callout>
        </div>
      )}
    </div>
  );
}

export function MyRequestsView() {
  const { user } = useAuth();
  const { requests, loading } = useLab();

  if (loading) return <LoadingState label="Loading your requests…" />;

  const mine = requests.filter((r) => r.requesterId === user?.id);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My Requests</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Track the status of everything you have requested from the lab.
        </p>
      </div>

      {mine.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Clock size={22} />}
            title="No requests yet"
            description="Once you submit a request from the inventory catalogue, it will appear here with its live status."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {mine.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
    </div>
  );
}
