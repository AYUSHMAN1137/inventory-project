import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { ChangePasswordScreen } from './components/auth/ChangePasswordScreen';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { LoadingState } from './components/common/ui';

import { DashboardView } from './views/DashboardView';
import { CatalogView } from './views/CatalogView';
import { KitsView } from './views/KitsView';
import { LocationsView } from './views/LocationsView';
import { CartView } from './views/CartView';
import { RequestsQueueView } from './views/RequestsQueueView';
import { MyRequestsView } from './views/MyRequestsView';
import { MyLoansView } from './views/MyLoansView';
import { HandoverView } from './views/HandoverView';
import { ReturnsView } from './views/ReturnsView';
import { IntakeView } from './views/IntakeView';
import { LedgerView } from './views/LedgerView';
import { PeopleView } from './views/PeopleView';

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function Shell() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState('');
  const [navOpen, setNavOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Restoring session…" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  // Admin-provisioned accounts start on a temporary password. Nothing else is
  // reachable until it is replaced (the API enforces the same rule).
  if (user.mustChangePassword) return <ChangePasswordScreen />;

  return (
    <div className="flex h-full">
      {/* Sidebar: fixed on desktop, slide-over drawer on mobile. */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" data-testid="mobile-nav">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setNavOpen(false)} aria-hidden />
          <div className="relative z-10 h-full">
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onSearch={setSearch} onToggleSidebar={() => setNavOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <Routes>
            <Route path="/" element={<DashboardView />} />
            <Route path="/catalog" element={<CatalogView search={search} />} />
            <Route path="/kits" element={<KitsView />} />
            <Route path="/locations" element={<LocationsView />} />
            <Route path="/cart" element={<CartView />} />
            <Route path="/my-requests" element={<MyRequestsView />} />
            <Route path="/my-loans" element={<MyLoansView />} />
            <Route
              path="/requests"
              element={
                <AdminOnly>
                  <RequestsQueueView />
                </AdminOnly>
              }
            />
            <Route
              path="/handover"
              element={
                <AdminOnly>
                  <HandoverView />
                </AdminOnly>
              }
            />
            <Route
              path="/returns"
              element={
                <AdminOnly>
                  <ReturnsView />
                </AdminOnly>
              }
            />
            <Route
              path="/intake"
              element={
                <AdminOnly>
                  <IntakeView />
                </AdminOnly>
              }
            />
            <Route
              path="/ledger"
              element={
                <AdminOnly>
                  <LedgerView />
                </AdminOnly>
              }
            />
            <Route
              path="/people"
              element={
                <AdminOnly>
                  <PeopleView />
                </AdminOnly>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return <Shell />;
}
