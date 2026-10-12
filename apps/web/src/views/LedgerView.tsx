import { useEffect, useMemo, useState } from 'react';
import { Download, FileClock, Search } from 'lucide-react';
import { inventoryApi } from '../lib/api';
import { useLab } from '../context/LabContext';
import { Badge, EmptyState, ErrorState, LoadingState } from '../components/common/ui';
import type { MovementType, StockMovement } from '../types';

const typeTone: Record<MovementType, 'ok' | 'info' | 'accent' | 'warn' | 'danger' | 'neutral'> = {
  RECEIPT: 'accent',
  ISSUE: 'info',
  RETURN: 'ok',
  ADJUSTMENT_IN: 'neutral',
  ADJUSTMENT_OUT: 'warn',
  LOCATION_TRANSFER: 'neutral',
};

export function LedgerView() {
  const { categories } = useLab();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await inventoryApi.listMovements(200);
      setMovements(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (query) {
        const hay = `${m.item?.name ?? ''} ${m.actor?.name ?? ''} ${m.unit?.assetCode ?? ''} ${m.reason ?? ''}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [movements, typeFilter, query]);

  function exportCsv() {
    const header = ['Date', 'Type', 'Item', 'Unit', 'Quantity', 'Actor', 'From', 'To', 'Reason'];
    const rows = filtered.map((m) => [
      new Date(m.createdAt).toISOString(),
      m.type,
      m.item?.name ?? '',
      m.unit?.assetCode ?? '',
      String(m.quantity),
      m.actor?.name ?? '',
      m.sourceLocation?.name ?? '',
      m.destLocation?.name ?? '',
      m.reason ?? '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lab-audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Ledger</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Immutable record of every receipt, issue, return and adjustment. {movements.length} entries.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search item, actor, asset code or reason…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="select w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All movement types ({categories.length ? movements.length : movements.length})</option>
            {(['RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOCATION_TRANSFER'] as MovementType[]).map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <LoadingState label="Loading ledger…" />
        </div>
      ) : error ? (
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FileClock size={22} />}
            title="No movements recorded"
            description="Stock receipts, issues and returns will be logged here as they happen."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Unit</th>
                  <th className="text-right">Qty</th>
                  <th>Actor</th>
                  <th>Movement</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td className="mono whitespace-nowrap text-xs text-[var(--text-muted)]">
                      {new Date(m.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <Badge tone={typeTone[m.type]}>{m.type.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="text-sm">{m.item?.name ?? '—'}</td>
                    <td className="mono text-xs">{m.unit?.assetCode ?? '—'}</td>
                    <td className="mono text-right text-sm">{m.quantity}</td>
                    <td className="text-xs">
                      <p className="text-[var(--text-body)]">{m.actor?.name ?? 'System'}</p>
                      <p className="mono text-[11px] text-[var(--text-muted)]">{m.actor?.collegeId}</p>
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {m.sourceLocation?.name ? `from ${m.sourceLocation.name}` : ''}
                      {m.destLocation?.name ? ` → ${m.destLocation.name}` : ''}
                      {!m.sourceLocation && !m.destLocation ? (m.reason ?? '—') : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
