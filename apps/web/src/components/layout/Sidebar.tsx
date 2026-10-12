import { NavLink } from 'react-router-dom';
import {
  Boxes,
  CircuitBoard,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  PackagePlus,
  PackageCheck,
  Warehouse,
  Wrench,
  Users,
  BookOpen,
  ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLab } from '../../context/LabContext';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-2 mt-6 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">{children}</p>
  );
}

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-teal-600/15 text-white'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-slate-200'}>
            {item.icon}
          </span>
          <span className="flex-1">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, isStudent } = useAuth();
  const { requests } = useLab();
  const { count } = useCart();

  const pendingCount = requests.filter((r) => r.decisionStatus === 'PENDING').length;
  const issuableCount = requests.filter(
    (r) => (r.decisionStatus === 'APPROVED' || r.decisionStatus === 'PARTIALLY_APPROVED') && r.fulfilmentStatus !== 'FULFILLED',
  ).length;

  const studentNav: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { to: '/catalog', label: 'Browse Inventory', icon: <Boxes size={17} /> },
    { to: '/kits', label: 'Kits & Bundles', icon: <CircuitBoard size={17} /> },
    { to: '/locations', label: 'Lab Layout', icon: <Warehouse size={17} /> },
    { to: '/my-requests', label: 'My Requests', icon: <ClipboardList size={17} /> },
    { to: '/my-loans', label: 'My Borrowed Items', icon: <PackageCheck size={17} /> },
  ];

  const adminNav: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { to: '/catalog', label: 'Inventory', icon: <Boxes size={17} /> },
    { to: '/requests', label: 'Request Queue', icon: <ClipboardList size={17} />, badge: pendingCount },
    { to: '/handover', label: 'Issue Desk', icon: <ArrowLeftRight size={17} />, badge: issuableCount },
    { to: '/returns', label: 'Returns Desk', icon: <PackageCheck size={17} /> },
    { to: '/intake', label: 'Stock Intake', icon: <PackagePlus size={17} /> },
    { to: '/kits', label: 'Kits & Bundles', icon: <CircuitBoard size={17} /> },
    { to: '/locations', label: 'Lab Layout', icon: <Warehouse size={17} /> },
    { to: '/ledger', label: 'Audit Ledger', icon: <FileClock size={17} /> },
  ];

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto bg-[var(--bg-navy)]">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
          <Wrench size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">Deep-Tech Lab</p>
          <p className="truncate text-[11px] text-slate-400">Inventory System</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <SectionLabel>{isAdmin ? 'Operations' : 'My Lab'}</SectionLabel>
        {(isAdmin ? adminNav : studentNav).map((item) => (
          <NavRow key={item.to} item={item} onNavigate={onNavigate} />
        ))}

        {isStudent && (
          <>
            <SectionLabel>Borrowing</SectionLabel>
            <NavLink
              to="/cart"
              onClick={onNavigate}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-teal-600/15 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <BookOpen size={17} />
              <span className="flex-1">Request Cart</span>
              {count > 0 && (
                <span className="rounded-full bg-teal-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </NavLink>
          </>
        )}

        {isAdmin && (
          <>
            <SectionLabel>Administration</SectionLabel>
            <NavLink
              to="/people"
              onClick={onNavigate}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-teal-600/15 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Users size={17} />
              Users & Projects
            </NavLink>
          </>
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-[10px] leading-relaxed text-slate-500">
          5th Floor Deep-Tech Innovation Centre
          <br />
          Room 501–504 · 7 categories
        </p>
      </div>
    </aside>
  );
}
