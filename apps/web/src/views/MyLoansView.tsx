import { useNavigate } from 'react-router-dom';
import { PackageCheck } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { Badge, EmptyState, LoadingState } from '../components/common/ui';

export function MyLoansView() {
  const { allocations, loading } = useLab();
  const navigate = useNavigate();

  if (loading) return <LoadingState label="Loading your borrowed items…" />;

  const active = allocations.filter((a) => !a.isFullyReturned);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My Borrowed Items</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Equipment currently in your possession. Return it to the lab counter when you are finished.
        </p>
      </div>

      {active.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<PackageCheck size={22} />}
            title="Nothing borrowed right now"
            description="When the lab issues approved items to you, they will be listed here with their return status."
            action={
              <button className="btn btn-primary" onClick={() => navigate('/catalog')}>
                Browse Inventory
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((loan) => (
            <div key={loan.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-strong)]">
                    {loan.project?.name ?? 'Personal allocation'}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Issued{' '}
                    {new Date(loan.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {loan.expectedReturnDate
                      ? ` · due ${new Date(loan.expectedReturnDate).toLocaleDateString('en-IN')}`
                      : ' · no fixed return date'}
                  </p>
                </div>
                <Badge tone="info">{loan.outstandingLines.length} item(s) outstanding</Badge>
              </div>

              <div className="mt-3 space-y-2">
                {loan.outstandingLines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-strong)]">
                        {line.requestLine?.item.name ?? 'Item'}
                      </p>
                      {(line.units?.length ?? 0) > 0 && (
                        <p className="mono mt-0.5 text-[11px] text-[var(--text-muted)]">
                          {line.units.map((u) => u.unit.assetCode).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="mono text-xs text-[var(--text-muted)]">
                      Qty {line.quantity - line.returnedQty}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
