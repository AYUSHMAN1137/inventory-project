import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLab } from '../../context/LabContext';

function initials(name: string) {
  return name
    .split(' ')
    .filter((p) => /[A-Za-z]/.test(p[0] ?? ''))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function Topbar({
  onSearch,
  onToggleSidebar,
}: {
  onSearch?: (value: string) => void;
  onToggleSidebar?: () => void;
}) {
  const { user, logout, isAdmin } = useAuth();
  const { refresh, loading, requests } = useLab();
  const { count } = useCart();
  const navigate = useNavigate();

  const pendingCount = requests.filter((r) => r.decisionStatus === 'PENDING').length;

  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-white px-3 py-2 sm:px-5 sm:py-0">
      <button
        className="btn btn-ghost btn-sm lg:hidden"
        aria-label="Open navigation"
        onClick={onToggleSidebar}
      >
        <Menu size={18} />
      </button>

      <div className="relative order-last w-full min-w-0 sm:order-none sm:w-auto sm:max-w-md sm:flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search inventory, requests, kits…"
          aria-label="Search"
          onChange={(e) => onSearch?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSearch) navigate('/catalog');
          }}
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => void refresh()}
          title="Refresh data"
          aria-label="Refresh data"
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>

        <div className="relative">
          <button
            className="btn btn-ghost btn-sm"
            title="Notifications"
            aria-label="Notifications"
            onClick={() => navigate(isAdmin ? '/requests' : '/my-requests')}
          >
            <Bell size={16} />
          </button>
          {isAdmin && pendingCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-900">
              {pendingCount}
            </span>
          )}
          {!isAdmin && count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </div>

        <div className="mx-1 hidden h-8 w-px bg-[var(--border)] sm:block" />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold leading-tight text-[var(--text-strong)]">{user?.name}</p>
            <p className="mono text-[11px] leading-tight text-[var(--text-muted)]">
              {user?.collegeId} · {isAdmin ? 'Admin' : 'Student'}
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-navy)] text-xs font-bold text-white">
            {initials(user?.name ?? 'U')}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            title="Sign out"
            aria-label="Sign out"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
