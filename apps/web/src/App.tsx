import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import {
  InventoryItem,
  EquipmentRequest,
  AllocationIssue,
  Kit,
  DashboardMetrics,
} from './types';
import { LoginModal } from './components/LoginModal';
import { RequestModal } from './components/RequestModal';
import { AdminHandoverModal } from './components/AdminHandoverModal';
import { ReturnModal } from './components/ReturnModal';
import { StockReceiptModal } from './components/StockReceiptModal';
import {
  LocationHierarchy,
  StockMovement,
} from './types';
import {
  Layers,
  Search,
  Box,
  Cpu,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  User,
  LogOut,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Plus,
  PackageCheck,
  Tag,
  MapPin,
  ClipboardList,
  PackagePlus,
  History,
} from 'lucide-react';

export default function App() {
  const { user, logout } = useAuth();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'KITS' | 'REQUESTS' | 'ALLOCATIONS' | 'ADMIN_DASH'>('CATALOG');

  // Modal states
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isStockReceiptOpen, setIsStockReceiptOpen] = useState(false);
  const [selectedItemForRequest, setSelectedItemForRequest] = useState<InventoryItem | null>(null);
  const [selectedRequestForHandover, setSelectedRequestForHandover] = useState<EquipmentRequest | null>(null);
  const [selectedAllocationForReturn, setSelectedAllocationForReturn] = useState<AllocationIssue | null>(null);

  // Data states
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [locations, setLocations] = useState<LocationHierarchy[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [allocations, setAllocations] = useState<AllocationIssue[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [natureFilter, setNatureFilter] = useState<'ALL' | 'RETURNABLE' | 'CONSUMABLE'>('ALL');

  // Load Inventory Items
  const loadItems = async () => {
    try {
      const res = await fetch('/api/v1/items');
      if (res.ok) {
        const data = await res.json();
        setItems(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load items', err);
    }
  };

  // Load Kits
  const loadKits = async () => {
    try {
      const res = await fetch('/api/v1/kits');
      if (res.ok) {
        const data = await res.json();
        setKits(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load kits', err);
    }
  };

  // Load Requests
  const loadRequests = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/v1/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load requests', err);
    }
  };

  // Load Allocations
  const loadAllocations = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/v1/allocations');
      if (res.ok) {
        const data = await res.json();
        setAllocations(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load allocations', err);
    }
  };

  // Load Dashboard Stats
  const loadDashboard = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/v1/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
        setLowStockItems(data.lowStockItems || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard', err);
    }
  };

  // Load Locations
  const loadLocations = async () => {
    try {
      const res = await fetch('/api/v1/locations');
      if (res.ok) {
        const data = await res.json();
        setLocations(data || []);
      }
    } catch (err) {
      console.error('Failed to load locations', err);
    }
  };

  // Load Stock Movements Ledger
  const loadMovements = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/v1/stock-movements');
      if (res.ok) {
        const data = await res.json();
        setMovements(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load movements', err);
    }
  };

  useEffect(() => {
    loadItems();
    loadKits();
    loadLocations();
  }, []);

  useEffect(() => {
    if (user) {
      loadRequests();
      loadAllocations();
      loadDashboard();
      loadMovements();
    }
  }, [user]);

  // Admin Request Decision (Approve / Reject)
  const handleAdminDecision = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    const target = requests.find((r) => r.id === requestId);
    if (!target) return;

    const payloadLines = target.lines.map((l) => ({
      lineId: l.id,
      approvedQuantity: status === 'APPROVED' ? l.requestedQty : 0,
      rejectionReason: status === 'REJECTED' ? 'Unavailable or scope limit' : undefined,
    }));

    await fetch(`/api/v1/requests/${requestId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        decisionReason: status === 'APPROVED' ? 'Approved by Lab In-Charge' : 'Rejected',
        lines: payloadLines,
      }),
    });

    loadRequests();
    loadDashboard();
  };

  // Filtered Items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.model && item.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'ALL' || item.categoryName === categoryFilter;
    const matchesNature = natureFilter === 'ALL' || item.nature === natureFilter;

    return matchesSearch && matchesCategory && matchesNature;
  });

  const categories = Array.from(new Set(items.map((i) => i.categoryName)));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('CATALOG')}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-base text-white flex items-center gap-2">
                Deep-Tech Innovation Centre
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Lab Hub
                </span>
              </div>
              <div className="text-xs text-slate-400">5th Floor Robotics & Embedded Hardware</div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center space-x-2">
            <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('CATALOG')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'CATALOG' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Inventory Catalog
              </button>
              <button
                onClick={() => setActiveTab('KITS')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'KITS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Robotics Kits
              </button>
              {user && (
                <>
                  <button
                    onClick={() => setActiveTab('REQUESTS')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'REQUESTS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Requests Queue
                  </button>
                  <button
                    onClick={() => setActiveTab('ALLOCATIONS')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'ALLOCATIONS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Active Allocations
                  </button>
                  {user.role === 'ADMIN' && (
                    <button
                      onClick={() => setActiveTab('ADMIN_DASH')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === 'ADMIN_DASH' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Admin Command
                    </button>
                  )}
                </>
              )}
            </nav>

            {/* Auth Profile / Login Button */}
            {user ? (
              <div className="flex items-center space-x-3 pl-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-white">{user.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {user.collegeId} &bull; <span className="text-indigo-400 font-semibold">{user.role}</span>
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white shadow-lg shadow-indigo-600/25 flex items-center space-x-2 transition-all"
              >
                <User className="w-4 h-4" />
                <span>Student / Admin Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 1. INVENTORY CATALOG TAB */}
        {activeTab === 'CATALOG' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search microcontrollers, motors, sensors, wires..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200 font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <div className="flex items-center bg-slate-950/60 border border-slate-800 rounded-xl p-1">
                  <button
                    onClick={() => setNatureFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      natureFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setNatureFilter('RETURNABLE')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      natureFilter === 'RETURNABLE' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Returnable
                  </button>
                  <button
                    onClick={() => setNatureFilter('CONSUMABLE')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      natureFilter === 'CONSUMABLE' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Consumables
                  </button>
                </div>

                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => setIsStockReceiptOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center space-x-1.5"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>Receive Stock</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inventory Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/50 transition-all duration-300 backdrop-blur-md shadow-xl hover:shadow-2xl hover:shadow-indigo-950/30"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {item.categoryName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            item.nature === 'RETURNABLE'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {item.nature}
                        </span>
                        {item.trackingMode === 'SERIALIZED' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            Serialized
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors">
                      {item.name}
                    </h3>
                    {item.model && (
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{item.model}</p>
                    )}
                    <p className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                      {item.description || 'Prototyping equipment for Deep-Tech Lab innovation projects.'}
                    </p>

                    {/* Hierarchical Location Breadcrumb */}
                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center text-[11px] text-slate-400 gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{item.defaultLocation}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">Available Stock:</div>
                      <div className="text-lg font-extrabold text-white flex items-center gap-2">
                        <span>{item.availableQuantity}</span>
                        <span className="text-xs font-normal text-slate-400">{item.unitOfMeasure}</span>
                        {item.isLowStock && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Low
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!user) {
                          setIsLoginOpen(true);
                        } else {
                          setSelectedItemForRequest(item);
                        }
                      }}
                      disabled={item.availableQuantity <= 0}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Request</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. ROBOTICS KITS TAB */}
        {activeTab === 'KITS' && (
          <div className="space-y-6">
            <div className="max-w-2xl space-y-1">
              <h2 className="text-2xl font-bold text-white">Pre-Assembled Robotics & IoT Kits</h2>
              <p className="text-sm text-slate-400">
                Ready-to-deploy hardware bundles designed for fast-track prototyping. Requesting a kit automatically unbundles into individual auditable item lines.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {kits.map((kit) => (
                <div key={kit.id} className="p-7 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-md space-y-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                        Bundle Template
                      </span>
                      <h3 className="text-xl font-bold text-white mt-1">{kit.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">{kit.description}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Box className="w-6 h-6" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
                      Included Components
                    </h4>
                    <div className="space-y-2">
                      {kit.items.map((kItem) => (
                        <div key={kItem.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-semibold text-white">{kItem.item.name}</div>
                            <div className="text-[10px] text-slate-400">{kItem.item.nature} &bull; {kItem.item.trackingMode}</div>
                          </div>
                          <span className="font-bold text-indigo-400">
                            {kItem.quantity} {kItem.item.unitOfMeasure}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!user) {
                        setIsLoginOpen(true);
                      } else {
                        // Request first component or show notice
                        const primaryItem = items.find((i) => i.id === kit.items[0]?.item.id);
                        if (primaryItem) setSelectedItemForRequest(primaryItem);
                      }
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2"
                  >
                    <span>Request Kit Components</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. REQUESTS QUEUE TAB */}
        {activeTab === 'REQUESTS' && user && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Equipment Requests</h2>
                <p className="text-xs text-slate-400">
                  {user.role === 'ADMIN' ? 'Review, approve, and issue submitted requests' : 'Track the status of your equipment requests'}
                </p>
              </div>
              <button
                onClick={loadRequests}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {requests.length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <ClipboardList className="w-12 h-12 mx-auto text-slate-600" />
                  <p>No active requests found.</p>
                </div>
              ) : (
                requests.map((req) => (
                  <div key={req.id} className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-400">
                            #{req.id.substring(0, 8)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            req.decisionStatus === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : req.decisionStatus === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {req.decisionStatus}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {req.fulfilmentStatus}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 font-semibold mt-1">
                          By {req.requester.name} ({req.requester.collegeId}) &bull; {new Date(req.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 italic">"{req.purpose}"</div>
                      </div>

                      {/* Admin Actions */}
                      {user.role === 'ADMIN' && req.decisionStatus === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAdminDecision(req.id, 'APPROVED')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleAdminDecision(req.id, 'REJECTED')}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}

                      {/* Admin Physical Handover Trigger */}
                      {user.role === 'ADMIN' && req.decisionStatus === 'APPROVED' && req.fulfilmentStatus !== 'FULFILLED' && (
                        <button
                          onClick={() => setSelectedRequestForHandover(req)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/25"
                        >
                          <PackageCheck className="w-4 h-4" />
                          <span>Handover / Physical Issue</span>
                        </button>
                      )}
                    </div>

                    {/* Lines */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800/60">
                      {req.lines.map((line) => (
                        <div key={line.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                          <div className="font-semibold text-white">{line.item.name}</div>
                          <div className="flex justify-between text-slate-400 mt-1">
                            <span>Requested: {line.requestedQty} {line.item.unitOfMeasure}</span>
                            <span className="font-semibold text-indigo-400">
                              Approved: {line.approvedQty}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. ACTIVE ALLOCATIONS TAB */}
        {activeTab === 'ALLOCATIONS' && user && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Active Equipment Allocations</h2>
                <p className="text-xs text-slate-400">
                  Track equipment physically issued to students and capstone teams.
                </p>
              </div>
              <button
                onClick={loadAllocations}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {allocations.length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <Box className="w-12 h-12 mx-auto text-slate-600" />
                  <p>No active allocations found.</p>
                </div>
              ) : (
                allocations.map((alloc) => (
                  <div key={alloc.id} className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-mono text-indigo-400 font-bold">
                          HANDOVER #{alloc.id.substring(0, 8)} &bull; {new Date(alloc.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-base font-bold text-white mt-0.5">
                          Issued to: {alloc.student.name} ({alloc.student.collegeId})
                        </div>
                        {alloc.project && (
                          <div className="text-xs text-slate-400">Team: {alloc.project.name}</div>
                        )}
                      </div>

                      {user.role === 'ADMIN' && (
                        <button
                          onClick={() => setSelectedAllocationForReturn(alloc)}
                          className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-sky-600/20"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Process Return / Check-in</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800/60">
                      {alloc.lines.map((line) => (
                        <div key={line.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                          <div className="font-semibold text-white">{line.requestLine?.item.name}</div>
                          <div className="text-slate-400 mt-1 flex justify-between">
                            <span>Issued: {line.quantity} pcs</span>
                            <span className="text-sky-400">Returned: {line.returnedQty} pcs</span>
                          </div>
                          {line.units?.map((u) => (
                            <span key={u.id} className="inline-block font-mono text-[10px] px-2 py-0.5 mt-1.5 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20">
                              Unit: {u.unit.assetCode} ({u.unit.status})
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 5. ADMIN COMMAND TAB */}
        {activeTab === 'ADMIN_DASH' && user?.role === 'ADMIN' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-white">Laboratory Operations Command</h2>
              <p className="text-xs text-slate-400">
                System telemetry, low-stock threshold triggers, and real-time inventory counts.
              </p>
            </div>

            {/* Metrics Cards */}
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400 font-medium">Total Catalog Items</div>
                  <div className="text-3xl font-extrabold text-white">{metrics.totalItemsCount}</div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400 font-medium">Pending Requests</div>
                  <div className="text-3xl font-extrabold text-amber-400">{metrics.pendingRequestsCount}</div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400 font-medium">Allocated Units</div>
                  <div className="text-3xl font-extrabold text-sky-400">{metrics.allocatedUnits}</div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400 font-medium">Low Stock Warnings</div>
                  <div className="text-3xl font-extrabold text-rose-400">{metrics.lowStockCount}</div>
                </div>
              </div>
            )}

            {/* Low Stock Warning Box */}
            {lowStockItems.length > 0 && (
              <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 space-y-3">
                <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Restock Action Required</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {lowStockItems.map((item) => (
                    <div key={item.id} className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/30 text-xs">
                      <div className="font-bold text-white">{item.name}</div>
                      <div className="text-rose-300 mt-1">
                        Current: <strong>{item.current}</strong> (Threshold: {item.threshold})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Movement History Ledger (Phase 10) */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-white font-bold text-lg">
                <History className="w-5 h-5 text-indigo-400" />
                <span>Immutable Operational Ledger (Recent Stock Movements)</span>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden backdrop-blur-md">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 uppercase tracking-wider text-[10px] font-semibold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action Type</th>
                      <th className="py-3 px-4">Item & Mode</th>
                      <th className="py-3 px-4">Qty / Unit</th>
                      <th className="py-3 px-4">Operator / Actor</th>
                      <th className="py-3 px-4">Reason / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                          No stock movements recorded yet.
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 text-slate-400">
                            {new Date(m.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              m.type === 'RECEIPT'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : m.type === 'ISSUE'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            }`}>
                              {m.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-sans font-semibold text-white">
                            {m.item.name}
                          </td>
                          <td className="py-3 px-4 text-indigo-300 font-bold">
                            {m.unit ? m.unit.assetCode : `${m.quantity} pcs`}
                          </td>
                          <td className="py-3 px-4 font-sans text-slate-300">
                            {m.actor.name} ({m.actor.collegeId})
                          </td>
                          <td className="py-3 px-4 font-sans text-slate-400 italic">
                            {m.reason || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <StockReceiptModal
        items={items}
        locations={locations}
        isOpen={isStockReceiptOpen}
        onClose={() => setIsStockReceiptOpen(false)}
        onSuccess={() => {
          loadItems();
          loadMovements();
          loadDashboard();
        }}
      />
      <RequestModal
        item={selectedItemForRequest}
        isOpen={!!selectedItemForRequest}
        onClose={() => setSelectedItemForRequest(null)}
        onSuccess={() => {
          loadRequests();
          setActiveTab('REQUESTS');
        }}
      />
      <AdminHandoverModal
        request={selectedRequestForHandover}
        isOpen={!!selectedRequestForHandover}
        onClose={() => setSelectedRequestForHandover(null)}
        onSuccess={() => {
          loadRequests();
          loadAllocations();
          loadItems();
          loadMovements();
          loadDashboard();
          setActiveTab('ALLOCATIONS');
        }}
      />
      <ReturnModal
        allocation={selectedAllocationForReturn}
        isOpen={!!selectedAllocationForReturn}
        onClose={() => setSelectedAllocationForReturn(null)}
        onSuccess={() => {
          loadAllocations();
          loadItems();
          loadMovements();
          loadDashboard();
        }}
      />
    </div>
  );
}
