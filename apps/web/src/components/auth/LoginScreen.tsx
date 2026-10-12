import { useState } from 'react';
import { CircuitBoard, KeyRound, Loader2, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Local demo hint. Only rendered when the developer explicitly opts in via
 * `VITE_SHOW_DEMO_HINTS=true` (see `.env.example`). In production the login
 * form is a plain credential form with no shortcuts — the password is never
 * bundled into the client.
 */
const DEMO_HINT = import.meta.env.VITE_SHOW_DEMO_HINTS === 'true';

export function LoginScreen() {
  const { login, error } = useAuth();
  const [collegeId, setCollegeId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!collegeId.trim() || !password) return;
    setBusy(true);
    try {
      await login(collegeId.trim(), password);
    } catch {
      /* error surfaced via context */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* ------------------------------------------------ Brand panel */}
      <div className="relative hidden flex-col justify-between bg-[var(--bg-navy)] p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600">
            <CircuitBoard size={22} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">Deep-Tech Innovation Centre</p>
            <p className="text-xs text-slate-400">5th Floor · Lab Inventory</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
            Complete visibility over every component in the lab.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Track serialized equipment and bulk consumables across rooms, cabinets and drawers. Approve
            requests, issue items at the counter, and audit every stock movement from one system.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { k: 'Serialized assets', v: 'Barcode-level tracking' },
              { k: 'Consumables', v: 'Quantity balances' },
              { k: 'Approval flow', v: 'Partial & full' },
              { k: 'Audit ledger', v: 'Immutable history' },
            ].map((f) => (
              <div key={f.k} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-teal-300">{f.k}</p>
                <p className="mt-1 text-xs text-slate-300">{f.v}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500">
          College Internal System · Role-based access · Session-protected
        </p>
      </div>

      {/* ------------------------------------------------ Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-teal-600 text-white">
              <CircuitBoard size={24} />
            </div>
            <h1 className="text-xl font-bold">Deep-Tech Lab Inventory</h1>
            <p className="text-sm text-[var(--text-muted)]">5th Floor Innovation Centre</p>
          </div>

          <h2 className="text-xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Use your college ID to access the lab system.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="collegeId">
                College ID
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="collegeId"
                  name="collegeId"
                  className="input pl-9"
                  placeholder="e.g. ADMIN001 or 2024BCSE042"
                  value={collegeId}
                  onChange={(e) => setCollegeId(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  minLength={3}
                  maxLength={64}
                  aria-describedby={error ? 'login-error' : undefined}
                  aria-invalid={error ? true : undefined}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="input pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  maxLength={256}
                  aria-describedby={error ? 'login-error' : undefined}
                  aria-invalid={error ? true : undefined}
                />
              </div>
            </div>

            {error && (
              <p
                id="login-error"
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-[#fecdd3] bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[#9f1239]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={busy || !collegeId.trim() || password.length < 8}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {DEMO_HINT && (
            <div className="mt-8 rounded-lg border bg-[var(--bg-subtle)] p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Local setup reference
              </p>
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                Seeded accounts are listed in the terminal output of{' '}
                <span className="mono">npm run prisma:seed --workspace=apps/api</span>. Accounts created by
                an admin are issued a temporary password and must change it on first sign-in.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
