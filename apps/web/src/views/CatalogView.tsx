import { useMemo, useState } from 'react';
import { Grid3x3, List, MapPin, PackagePlus, Search, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLab } from '../context/LabContext';
import {
  Badge,
  Drawer,
  EmptyState,
  LoadingState,
  StockBar,
  conditionTone,
  natureTone,
  unitTone,
} from '../components/common/ui';
import type { Item } from '../types';

function ItemDrawer({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const { isStudent } = useAuth();
  const { add, has } = useCart();
  if (!item) return null;

  return (
    <Drawer
      open={!!item}
      onClose={onClose}
      title={item.name}
      subtitle={item.model ?? undefined}
      footer={
        isStudent && item.availableQuantity > 0 ? (
          <button
            className="btn btn-primary"
            disabled={has(item.id)}
            onClick={() => {
              add(item, 1);
              onClose();
            }}
          >
            <PackagePlus size={15} /> {has(item.id) ? 'Already in cart' : 'Add to request cart'}
          </button>
        ) : null
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge tone={natureTone(item.nature)}>{item.nature === 'CONSUMABLE' ? 'Consumable' : 'Returnable'}</Badge>
          <Badge tone="neutral">{item.trackingMode === 'SERIALIZED' ? 'Individually tracked' : 'Quantity tracked'}</Badge>
          {item.isLowStock && <Badge tone="danger">Low stock</Badge>}
        </div>

        <p className="text-sm leading-relaxed text-[var(--text-body)]">
          {item.description ?? 'No description recorded for this item.'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-[var(--bg-subtle)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Available</p>
            <p className="mono mt-1 text-xl font-bold text-[var(--text-strong)]">
              {item.availableQuantity}
              <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">{item.unitOfMeasure}</span>
            </p>
          </div>
          <div className="rounded-lg border bg-[var(--bg-subtle)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Total on record</p>
            <p className="mono mt-1 text-xl font-bold text-[var(--text-strong)]">
              {item.totalQuantity}
              <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">{item.unitOfMeasure}</span>
            </p>
          </div>
        </div>

        <div>
          <p className="label">Storage location</p>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <MapPin size={14} className="text-[var(--text-muted)]" />
            {item.defaultLocation ?? 'Not assigned'}
          </div>
        </div>

        <div>
          <p className="label">Category</p>
          <p className="text-sm">{item.categoryName}</p>
        </div>

        {item.trackingMode === 'SERIALIZED' && item.units && item.units.length > 0 && (
          <div>
            <p className="label">Physical units ({item.units.length})</p>
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border p-2">
              {item.units.map((unit) => (
                <div key={unit.id} className="flex items-center justify-between rounded-md bg-[var(--bg-subtle)] px-3 py-2">
                  <div>
                    <p className="mono text-xs font-semibold text-[var(--text-strong)]">{unit.assetCode}</p>
                    {unit.conditionNote && (
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{unit.conditionNote}</p>
                    )}
                  </div>
                  <Badge tone={unitTone(unit.status)}>{unit.status.toLowerCase()}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {item.trackingMode === 'BULK' && item.balances && item.balances.length > 0 && (
          <div>
            <p className="label">Stock by location</p>
            <div className="space-y-1.5">
              {item.balances.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="text-[var(--text-body)]">{b.location?.name ?? 'Unknown'}</span>
                  <span className="mono text-xs text-[var(--text-muted)]">
                    {b.availableQuantity} avail · {b.allocatedQuantity} out
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {item.lowStockThreshold != null && (
          <p className="text-xs text-[var(--text-muted)]">
            Minimum stock level: <span className="mono">{item.lowStockThreshold}</span> {item.unitOfMeasure}
          </p>
        )}
      </div>
    </Drawer>
  );
}

export function CatalogView({ search }: { search: string }) {
  const { items, categories, loading } = useLab();
  const { isStudent } = useAuth();
  const { add, has } = useCart();

  const [localQuery, setLocalQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [nature, setNature] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [selected, setSelected] = useState<Item | null>(null);

  const query = (search || localQuery).toLowerCase().trim();

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (category !== 'all' && item.categoryId !== category) return false;
      if (nature !== 'all' && item.nature !== nature) return false;
      if (availability === 'available' && item.availableQuantity <= 0) return false;
      if (availability === 'low' && !item.isLowStock) return false;
      if (query) {
        const haystack = `${item.name} ${item.model ?? ''} ${item.description ?? ''} ${item.categoryName}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [items, category, nature, availability, query]);

  if (loading) return <LoadingState label="Loading inventory…" />;

  const activeFilters = [category !== 'all', nature !== 'all', availability !== 'all'].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lab Inventory</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {filtered.length} of {items.length} catalogue items · {categories.length} categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-white p-0.5">
            <button
              className={`btn btn-sm ${view === 'grid' ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setView('grid')}
              title="Card view"
            >
              <Grid3x3 size={14} />
            </button>
            <button
              className={`btn btn-sm ${view === 'table' ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setView('table')}
              title="Table view"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- Filters */}
      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by name, model or description…"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
            />
          </div>
          <select className="select w-auto min-w-[170px]" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c._count ? `(${c._count.items})` : ''}
              </option>
            ))}
          </select>
          <select className="select w-auto" value={nature} onChange={(e) => setNature(e.target.value)}>
            <option value="all">All types</option>
            <option value="RETURNABLE">Returnable</option>
            <option value="CONSUMABLE">Consumable</option>
          </select>
          <select className="select w-auto" value={availability} onChange={(e) => setAvailability(e.target.value)}>
            <option value="all">Any availability</option>
            <option value="available">In stock only</option>
            <option value="low">Low stock only</option>
          </select>
          {activeFilters > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setCategory('all');
                setNature('all');
                setAvailability('all');
              }}
            >
              <SlidersHorizontal size={13} /> Clear ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------- Body */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No items match your filters"
            description="Try clearing a filter or searching for a different component."
          />
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <div key={item.id} className="card card-hover flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-strong)]">{item.name}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">{item.model ?? item.categoryName}</p>
                </div>
                {item.isLowStock && <Badge tone="danger">Low</Badge>}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={natureTone(item.nature)}>{item.nature === 'CONSUMABLE' ? 'Consumable' : 'Returnable'}</Badge>
                <Badge tone="neutral">{item.trackingMode === 'SERIALIZED' ? 'Unit-tracked' : 'Bulk'}</Badge>
              </div>

              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
                {item.description ?? '—'}
              </p>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <MapPin size={12} />
                <span className="truncate">{item.defaultLocation ?? 'Unknown'}</span>
              </div>

              <div className="mt-3">
                <StockBar available={item.availableQuantity} total={item.totalQuantity} />
              </div>

              <div className="mt-4 flex gap-2">
                <button className="btn btn-secondary btn-sm flex-1" onClick={() => setSelected(item)}>
                  Details
                </button>
                {isStudent && (
                  <button
                    className="btn btn-primary btn-sm flex-1"
                    disabled={item.availableQuantity <= 0 || has(item.id)}
                    onClick={() => add(item, 1)}
                  >
                    {has(item.id) ? 'In cart' : item.availableQuantity <= 0 ? 'Unavailable' : 'Add'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Tracking</th>
                  <th>Available</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium text-[var(--text-strong)]">{item.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.model ?? '—'}</p>
                    </td>
                    <td className="text-xs">{item.categoryName}</td>
                    <td>
                      <Badge tone={natureTone(item.nature)}>{item.nature === 'CONSUMABLE' ? 'Consumable' : 'Returnable'}</Badge>
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {item.trackingMode === 'SERIALIZED' ? 'Individually tracked' : 'Quantity tracked'}
                    </td>
                    <td>
                      <StockBar available={item.availableQuantity} total={item.totalQuantity} />
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">{item.defaultLocation ?? '—'}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(item)}>
                          View
                        </button>
                        {isStudent && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={item.availableQuantity <= 0 || has(item.id)}
                            onClick={() => add(item, 1)}
                          >
                            {has(item.id) ? 'In cart' : 'Add'}
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

      <ItemDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
