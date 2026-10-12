import { useNavigate } from 'react-router-dom';
import { CircuitBoard, Layers, PackagePlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLab } from '../context/LabContext';
import { Badge, EmptyState, LoadingState, natureTone } from '../components/common/ui';

export function KitsView() {
  const { kits, items, loading } = useLab();
  const { isStudent } = useAuth();
  const { add, has } = useCart();
  const navigate = useNavigate();

  if (loading) return <LoadingState label="Loading kits…" />;

  function addKitToCart(kitId: string) {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;
    kit.items.forEach((ki) => {
      const item = items.find((i) => i.id === ki.itemId);
      if (item && item.availableQuantity > 0) add(item, ki.quantity);
    });
    navigate('/cart');
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Kits & Bundles</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Predefined component bundles for common lab projects. Requesting a kit adds its individual parts to your cart.
        </p>
      </div>

      {kits.length === 0 ? (
        <div className="card">
          <EmptyState icon={<CircuitBoard size={22} />} title="No kits created yet" />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {kits.map((kit) => {
            const totalParts = kit.items.reduce((s, i) => s + i.quantity, 0);
            const allAvailable = kit.items.every((ki) => {
              const item = items.find((i) => i.id === ki.itemId);
              return (item?.availableQuantity ?? 0) >= ki.quantity;
            });
            const anyInCart = kit.items.some((ki) => has(ki.itemId));

            return (
              <div key={kit.id} className="card card-hover flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Layers size={19} />
                  </div>
                  <Badge tone={allAvailable ? 'ok' : 'warn'}>
                    {allAvailable ? 'All parts in stock' : 'Partly unavailable'}
                  </Badge>
                </div>

                <h3 className="mt-3 text-base font-semibold text-[var(--text-strong)]">{kit.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{kit.description}</p>

                <div className="mt-4 flex-1 rounded-lg border bg-[var(--bg-subtle)] p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Bill of materials · {totalParts} parts
                  </p>
                  <ul className="space-y-1.5">
                    {kit.items.map((ki) => {
                      const item = items.find((i) => i.id === ki.itemId);
                      const ok = (item?.availableQuantity ?? 0) >= ki.quantity;
                      return (
                        <li key={ki.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span className="truncate text-[var(--text-body)]">{ki.item.name}</span>
                          </span>
                          <span className="mono shrink-0 text-[var(--text-muted)]">×{ki.quantity}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {isStudent && (
                  <button
                    className="btn btn-primary mt-4 w-full"
                    onClick={() => addKitToCart(kit.id)}
                    disabled={!allAvailable}
                  >
                    <PackagePlus size={15} />
                    {anyInCart ? 'Add remaining parts' : allAvailable ? 'Add all parts to cart' : 'Parts unavailable'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
