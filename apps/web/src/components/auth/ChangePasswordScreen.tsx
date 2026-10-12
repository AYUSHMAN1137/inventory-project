import { useState } from 'react';
import { CircuitBoard, KeyRound, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../lib/api';

const POLICY_HINTS = [
  'At least 10 characters',
  'One uppercase and one lowercase letter',
  'One number',
  'One symbol',
];

/**
 * Forced first-run screen for accounts an admin provisioned with a temporary
 * password (`mustChangePassword`). Nothing else in the app renders until the
 * password is changed, and the server enforces the same rule.
 */
export function ChangePasswordScreen() {
  const { user, reload } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setBusy(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword, confirmPassword });
      // The server re-issues the session cookie on change; pick it up.
      await reload();
      setNotice('Password updated. You can continue using the lab system.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await authApi.logout();
    } catch {
      /* leaving anyway */
    }
    // Relay through login failure path by reloading to force the login screen.
    window.location.assign('/');
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
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
            Set your own password before you start.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Your account was created with a temporary password issued by the lab administrator. Choosing
            your own password secures your requests, approvals and audit trail.
          </p>
        </div>

        <p className="text-xs text-slate-500">College Internal System · Session-protected</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-teal-600 text-white">
              <CircuitBoard size={24} />
            </div>
            <h1 className="text-xl font-bold">Deep-Tech Lab Inventory</h1>
            <p className="text-sm text-[var(--text-muted)]">5th Floor Innovation Centre</p>
          </div>

          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#fde68a] bg-[var(--warn-soft)] px-3.5 py-3 text-sm text-[#92400e]">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Password change required</p>
              <p className="mt-0.5 text-xs">
                Signed in as <span className="mono">{user?.collegeId}</span>
              </p>
            </div>
          </div>

          <h2 className="text-xl font-bold">Choose a new password</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Enter the temporary password and pick a new one.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="current-password">
                Temporary password
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  className="input pl-9"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  minLength={1}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="new-password">
                New password
              </label>
              <div className="relative">
                <ShieldCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  className="input pl-9"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={10}
                  aria-describedby="password-policy"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="confirm-password">
                Confirm new password
              </label>
              <div className="relative">
                <ShieldCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  className="input pl-9"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={10}
                />
              </div>
            </div>

            <ul id="password-policy" className="space-y-1 rounded-lg border bg-[var(--bg-subtle)] px-3 py-2.5">
              {POLICY_HINTS.map((hint) => (
                <li key={hint} className="text-[11px] text-[var(--text-muted)]">
                  • {hint}
                </li>
              ))}
            </ul>

            {error && (
              <p
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-[#fecdd3] bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[#9f1239]"
              >
                {error}
              </p>
            )}

            {notice && (
              <p
                role="status"
                aria-live="polite"
                className="rounded-lg border border-[#a7f3d0] bg-[var(--ok-soft)] px-3 py-2 text-xs font-medium text-[#065f46]"
              >
                {notice}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={busy || !currentPassword || newPassword.length < 10 || confirmPassword.length < 10}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <button type="button" className="btn btn-ghost btn-sm mt-4 w-full" onClick={() => void handleSignOut()}>
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
