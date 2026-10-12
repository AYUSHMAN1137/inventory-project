import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  PackageCheck,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLab } from '../context/LabContext';
import { Badge, KpiCard, LoadingState, StockBar, decisionTone, decisionLabel, natureTone, type BadgeTone } from '../components/common/ui';
import type { StockMovement } from '../types';

function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function MovementRow({ m }: { m: StockMovement }) {
  const tone: BadgeTone =
    m.type === 'ISSUE' ? 'info' : m.type === 'RETURN' ? 'ok' : m.type === 'RECEIPT' ? 'accent' : 'neutral';
  return (
    <div className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
      <Badge tone={tone}>{m.type.replace('_', ' ')}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-strong)]">{m.item?.name ?? 'Unknown item'}</p>
        <p className="truncate text-xs text-[var(--text-muted)]">
          {m.unit?.assetCode ? <span className="mono">{m.unit.assetCode} · </span> : null}
          {m.actor?.name ?? 'System'}
        </p>
      </div>
      <span className="mono shrink-0 text-xs text-[var(--text-muted)]">
        {m.quantity > 0 ? `×${m.quantity}` : ''}
      </span>
      <span className="shrink-0 text-xs text-[var(--text-muted)]">
        {new Date(m.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
      </span>
    </div>
  );
}

export function DashboardView() {
  const { user, isAdmin } = useAuth();
  const { dashboard, items, requests, allocations, loading } = useLab();

  if (loading) return <LoadingState label="Loading dashboard…" />;

  const metrics = dashboard?.metrics;
  const lowStock = dashboard?.lowStockItems ?? [];
  const movements = dashboard?.recentMovements ?? [];

  const myRequests = requests.filter((r) => r.requesterId === user?.id);
  const myPending = myRequests.filter((r) => r.decisionStatus === 'PENDING').length;
  const myLoans = allocations.filter((a) => !a.isFullyReturned);

  const totalStockUnits = items.reduce((sum, i) => sum + i.totalQuantity, 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={isAdmin ? 'Lab Operations Dashboard' : `Welcome back, ${user?.name.split(' ')[0]}`}
        subtitle={
          isAdmin
            ? 'Live status of inventory, requests and outstanding loans across the 5th floor lab.'
            : 'Browse equipment, track your requests and see what you currently have borrowed.'
        }
        action={
          <Link to={isAdmin ? '/requests' : '/catalog'} className="btn btn-primary">
            {isAdmin ? 'Review Requests' : 'Browse Inventory'} <ArrowRight size={15} />
          </Link>
        }
      />

      {/* ------------------------------------------------------------- KPIs */}
      {isAdmin ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Catalogue Items"
            value={metrics?.totalItemsCount ?? items.length}
            hint={`${totalStockUnits} total units on record`}
            tone="accent"
            icon={<Boxes size={16} />}
          />
          <KpiCard
            label="Pending Requests"
            value={metrics?.pendingRequestsCount ?? 0}
            hint="Awaiting a decision"
            tone={metrics?.pendingRequestsCount ? 'warn' : 'neutral'}
            icon={<ClipboardList size={16} />}
          />
          <KpiCard
            label="Items On Loan"
            value={metrics?.allocatedUnits ?? 0}
            hint="Serialized units allocated"
            tone="neutral"
            icon={<PackageCheck size={16} />}
          />
          <KpiCard
            label="Low Stock Alerts"
            value={metrics?.lowStockCount ?? 0}
            hint="Bulk items at threshold"
            tone={metrics?.lowStockCount ? 'danger' : 'ok'}
            icon={<AlertTriangle size={16} />}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Available Catalogue" value={items.length} hint="Distinct items in the lab" tone="accent" icon={<Boxes size={16} />} />
          <KpiCard label="My Pending Requests" value={myPending} hint="Awaiting admin approval" tone={myPending ? 'warn' : 'neutral'} icon={<ClipboardList size={16} />} />
          <KpiCard label="Items I Have" value={myLoans.length} hint="Currently borrowed" tone="neutral" icon={<PackageCheck size={16} />} />
          <KpiCard label="Ready to Collect" value={myRequests.filter((r) => r.decisionStatus === 'APPROVED' && r.fulfilmentStatus === 'NOT_ISSUED').length} hint="Approved, not yet issued" tone="ok" icon={<TrendingUp size={16} />} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* ------------------------------------------- Left / main column */}
        <div className="space-y-6 lg:col-span-2">
          {isAdmin && lowStock.length > 0 && (
            <section className="card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-[var(--warn)]" />
                  <h2 className="section-title text-base">Low Stock Warnings</h2>
                </div>
                <Link to="/intake" className="btn btn-secondary btn-sm">
                  Receive Stock
                </Link>
              </div>
              <div className="divide-y">
                {lowStock.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-strong)]">{item.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">Minimum threshold: {item.threshold}</p>
                    </div>
                    <Badge tone="danger">Only {item.current} left</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="section-title text-base">{isAdmin ? 'Recent Stock Activity' : 'My Recent Requests'}</h2>
              <Link to={isAdmin ? '/ledger' : '/my-requests'} className="text-xs font-semibold text-[var(--accent)] hover:underline">
                View all
              </Link>
            </div>

            {isAdmin ? (
              movements.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  No stock movements recorded yet.
                </p>
              ) : (
                <div>{movements.slice(0, 7).map((m) => <MovementRow key={m.id} m={m} />)}</div>
              )
            ) : myRequests.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                You have not submitted any requests yet.
              </p>
            ) : (
              <div className="divide-y">
                {myRequests.slice(0, 5).map((r) => (
                  <Link key={r.id} to="/my-requests" className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-subtle)]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-strong)]">{r.purpose}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {r.lines.length} item(s) · {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                    <Badge tone={decisionTone(r.decisionStatus)}>{decisionLabel(r.decisionStatus)}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ------------------------------------------------ Right sidebar */}
        <div className="space-y-6">
          {isAdmin ? (
            <section className="card card-pad">
              <h2 className="section-title mb-3 text-base">Inventory Health</h2>
              <div className="space-y-3">
                {[
                  { label: 'Available units', value: metrics?.availableUnits ?? 0, tone: 'text-emerald-600' },
                  { label: 'On loan', value: metrics?.allocatedUnits ?? 0, tone: 'text-blue-600' },
                  { label: 'Unavailable / service', value: metrics?.unavailableUnits ?? 0, tone: 'text-amber-600' },
                  { label: 'Active projects', value: metrics?.activeProjectsCount ?? 0, tone: 'text-slate-700' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-muted)]">{row.label}</span>
                    <span className={`mono text-sm font-bold ${row.tone}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="card">
              <div className="border-b px-4 py-3">
                <h2 className="section-title text-base">Currently Borrowed</h2>
              </div>
              {myLoans.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">Nothing borrowed right now.</p>
              ) : (
                <div className="divide-y">
                  {myLoans.slice(0, 5).map((loan) =>
                    loan.outstandingLines.map((line) => (
                      <div key={line.id} className="px-4 py-3">
                        <p className="truncate text-sm font-medium text-[var(--text-strong)]">
                          {line.requestLine?.item.name ?? 'Item'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          Qty {line.quantity - line.returnedQty}
                          {loan.expectedReturnDate
                            ? ` · due ${new Date(loan.expectedReturnDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                            : ''}
                        </p>
                      </div>
                    )),
                  )}
                </div>
              )}
            </section>
          )}

          <section className="card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="section-title text-base">Quick Look · Top Available</h2>
            </div>
            <div className="divide-y">
              {[...items]
                .filter((i) => i.availableQuantity > 0)
                .sort((a, b) => b.availableQuantity - a.availableQuantity)
                .slice(0, 6)
                .map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-strong)]">{item.name}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Badge tone={natureTone(item.nature)}>{item.nature === 'CONSUMABLE' ? 'Consumable' : 'Returnable'}</Badge>
                      </div>
                    </div>
                    <StockBar available={item.availableQuantity} total={item.totalQuantity} />
                  </div>
                ))}
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="section-title mb-3 flex items-center gap-2 text-base">
              <Wrench size={15} /> How the lab works
            </h2>
            <ol className="space-y-2.5 text-sm text-[var(--text-body)]">
              {[
                'Browse the catalogue and add items to your request cart.',
                'Submit the request for yourself or your project team.',
                'Admin approves, partially approves or rejects it.',
                'Collect approved items at the counter — stock is deducted on handover.',
                'Returnables come back to the lab; consumables are used up.',
              ].map((step, idx) => (
                <li key={idx} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent)]">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
