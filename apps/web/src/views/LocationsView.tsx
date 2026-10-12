import { useMemo, useState } from 'react';
import { ChevronRight, DoorOpen, LayoutGrid, Warehouse } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { Badge, EmptyState, LoadingState, natureTone, StockBar } from '../components/common/ui';
import type { Location } from '../types';

export function LocationsView() {
  const { locations, items, loading } = useLab();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedCabinetId, setSelectedCabinetId] = useState<string | null>(null);

  const lab = useMemo(() => locations.find((l) => l.type === 'LAB'), [locations]);
  const rooms = useMemo(() => locations.filter((l) => l.type === 'ROOM'), [locations]);
  const cabinets = useMemo(
    () => locations.filter((l) => l.type === 'CABINET' && (!selectedRoomId || l.parentId === selectedRoomId)),
    [locations, selectedRoomId],
  );
  const drawers = useMemo(
    () => locations.filter((l) => l.parentId === selectedCabinetId && l.type !== 'CABINET'),
    [locations, selectedCabinetId],
  );

  const itemsAt = (locationId: string) =>
    items.filter(
      (i) =>
        i.defaultLocationId === locationId ||
        i.balances?.some((b) => b.locationId === locationId && b.availableQuantity > 0),
    );

  const itemsInRoom = (roomId: string) => {
    const cabIds = locations.filter((l) => l.parentId === roomId).map((l) => l.id);
    const drawerIds = locations.filter((l) => cabIds.includes(l.parentId ?? '')).map((l) => l.id);
    const allIds = new Set([roomId, ...cabIds, ...drawerIds]);
    return items.filter(
      (i) =>
        allIds.has(i.defaultLocationId ?? '') ||
        i.balances?.some((b) => allIds.has(b.locationId ?? '')),
    );
  };

  if (loading) return <LoadingState label="Loading lab layout…" />;

  const activeRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;
  const activeCabinet = cabinets.find((c) => c.id === selectedCabinetId) ?? null;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Lab Layout</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Explore the physical storage hierarchy — rooms, cabinets, drawers and what is inside each one.
        </p>
      </div>

      {!lab && rooms.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Warehouse size={22} />} title="No storage locations configured" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* ------------------------------------------------- Breadcrumb */}
          <div className="lg:col-span-12">
            <div className="card flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <button className="flex items-center gap-1.5 font-medium text-[var(--text-strong)]" onClick={() => { setSelectedRoomId(null); setSelectedCabinetId(null); }}>
                <Warehouse size={15} className="text-[var(--text-muted)]" />
                {lab?.name ?? 'Lab'}
              </button>
              {activeRoom && (
                <>
                  <ChevronRight size={14} className="text-[var(--text-muted)]" />
                  <button className="text-[var(--text-body)]" onClick={() => setSelectedCabinetId(null)}>
                    {activeRoom.name}
                  </button>
                </>
              )}
              {activeCabinet && (
                <>
                  <ChevronRight size={14} className="text-[var(--text-muted)]" />
                  <span className="text-[var(--text-body)]">{activeCabinet.name}</span>
                </>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------ Rooms */}
          <div className="lg:col-span-4">
            <div className="card overflow-hidden">
              <div className="border-b px-4 py-3">
                <h2 className="section-title flex items-center gap-2 text-sm">
                  <LayoutGrid size={15} /> Rooms
                </h2>
              </div>
              <div className="divide-y">
                {rooms.map((room: Location) => {
                  const roomItems = itemsInRoom(room.id);
                  const isActive = room.id === selectedRoomId;
                  return (
                    <button
                      key={room.id}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isActive ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--bg-subtle)]'
                      }`}
                      onClick={() => {
                        setSelectedRoomId(room.id);
                        setSelectedCabinetId(null);
                      }}
                    >
                      <DoorOpen size={16} className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-strong)]'}`}>
                          {room.name}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">{roomItems.length} item types stored</p>
                      </div>
                      <ChevronRight size={14} className="text-[var(--text-muted)]" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* --------------------------------------------------- Contents */}
          <div className="space-y-6 lg:col-span-8">
            {!activeRoom ? (
              <div className="card">
                <EmptyState
                  icon={<LayoutGrid size={22} />}
                  title="Select a room to explore"
                  description="Rooms on the 5th floor contain cabinets, and each cabinet holds drawers, shelves and bins."
                />
              </div>
            ) : (
              <>
                <div className="card">
                  <div className="border-b px-4 py-3">
                    <h2 className="section-title text-sm">Cabinets in {activeRoom.name}</h2>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    {cabinets.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)]">No cabinets recorded in this room yet.</p>
                    ) : (
                      cabinets.map((cab) => (
                        <button
                          key={cab.id}
                          className={`rounded-lg border p-3 text-left transition-all ${
                            cab.id === selectedCabinetId
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                              : 'hover:border-[var(--border-strong)] hover:shadow-sm'
                          }`}
                          onClick={() => setSelectedCabinetId(cab.id)}
                        >
                          <p className="text-sm font-semibold text-[var(--text-strong)]">{cab.name}</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {(() => {
                              const cabDrawers = locations.filter((l) => l.parentId === cab.id);
                              const itemCount = new Set(
                                cabDrawers.flatMap((d) => itemsAt(d.id).map((i) => i.id)),
                              ).size;
                              return `${cabDrawers.length} drawer(s) · ${itemCount} item type(s)`;
                            })()}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {activeCabinet && (
                  <div className="space-y-3">
                    {drawers.length === 0 ? (
                      <div className="card">
                        <EmptyState title="No drawers in this cabinet" description="Items are stored directly in the cabinet." />
                      </div>
                    ) : (
                      drawers.map((drawer) => {
                        const contents = itemsAt(drawer.id);
                        return (
                          <div key={drawer.id} className="card">
                            <div className="flex items-center justify-between border-b px-4 py-3">
                              <h3 className="text-sm font-semibold text-[var(--text-strong)]">{drawer.name}</h3>
                              <Badge tone="neutral">{drawer.type.toLowerCase()}</Badge>
                            </div>
                            {contents.length === 0 ? (
                              <p className="px-4 py-4 text-sm text-[var(--text-muted)]">Empty</p>
                            ) : (
                              <div className="divide-y">
                                {contents.map((item) => (
                                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-[var(--text-strong)]">{item.name}</p>
                                      <div className="mt-0.5 flex items-center gap-1.5">
                                        <Badge tone={natureTone(item.nature)}>
                                          {item.nature === 'CONSUMABLE' ? 'Consumable' : 'Returnable'}
                                        </Badge>
                                        {item.trackingMode === 'SERIALIZED' && item.units && (
                                          <span className="mono text-[11px] text-[var(--text-muted)]">
                                            {item.units.length} units on record
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <StockBar available={item.availableQuantity} total={item.totalQuantity} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
