import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Loader2, Minus, Plus, ShoppingCart, Trash2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLab } from '../context/LabContext';
import { requestsApi } from '../lib/api';
import { Callout, EmptyState } from '../components/common/ui';

export function CartView() {
  const { user } = useAuth();
  const { lines, setQuantity, remove, clear } = useCart();
  const { projects, refreshRequests } = useLab();
  const navigate = useNavigate();

  const [targetType, setTargetType] = useState<'PERSONAL' | 'PROJECT'>('PERSONAL');
  const [projectId, setProjectId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const myProjects = projects.filter((p) => p.members.some((m) => m.userId === user?.id));

  useEffect(() => {
    if (myProjects.length > 0 && !projectId) setProjectId(myProjects[0].id);
  }, [myProjects, projectId]);

  async function submit() {
    setError(null);
    if (purpose.trim().length < 5) {
      setError('Please describe why you need these items (at least 5 characters).');
      return;
    }
    if (targetType === 'PROJECT' && !projectId) {
      setError('Select a project for this request.');
      return;
    }
    setBusy(true);
    try {
      await requestsApi.create({
        targetType,
        projectId: targetType === 'PROJECT' ? projectId : undefined,
        purpose: purpose.trim(),
        expectedReturnDate: returnDate ? new Date(returnDate).toISOString() : null,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
      });
      clear();
      setSuccess(true);
      await refreshRequests();
      setTimeout(() => navigate('/my-requests'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <div className="card card-pad text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ok-soft)] text-[var(--ok)]">
            <ClipboardCheck size={26} />
          </div>
          <h1 className="text-xl font-bold">Request submitted</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Your request is now pending review. You will see its status under “My Requests”.
          </p>
          <p className="mt-4 text-xs text-[var(--text-muted)]">Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Request Cart</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Review the items you want to borrow, then submit the request for approval.
        </p>
      </div>

      {lines.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ShoppingCart size={22} />}
            title="Your request cart is empty"
            description="Browse the inventory and add the components you need, then come back here to submit."
            action={
              <button className="btn btn-primary" onClick={() => navigate('/catalog')}>
                Browse Inventory
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ------------------------------------------------------- Lines */}
          <div className="space-y-3 lg:col-span-2">
            {lines.map((line) => (
              <div key={line.itemId} className="card flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-strong)]">{line.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {line.nature === 'CONSUMABLE' ? 'Consumable' : 'Returnable'} ·{' '}
                    {line.availableQuantity} {line.unitOfMeasure} available
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    className="btn btn-secondary btn-sm"
                    aria-label={`Decrease quantity of ${line.name}`}
                    onClick={() => setQuantity(line.itemId, line.quantity - 1)}
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    className="input mono w-16 text-center"
                    type="number"
                    min={1}
                    max={line.availableQuantity}
                    aria-label={`Quantity of ${line.name}`}
                    value={line.quantity}
                    onChange={(e) => setQuantity(line.itemId, Number(e.target.value))}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    aria-label={`Increase quantity of ${line.name}`}
                    disabled={line.quantity >= line.availableQuantity}
                    onClick={() => setQuantity(line.itemId, line.quantity + 1)}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <button
                  className="btn btn-ghost btn-sm text-[var(--danger)]"
                  aria-label={`Remove ${line.name} from cart`}
                  onClick={() => remove(line.itemId)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* ------------------------------------------------------ Submit */}
          <div className="space-y-4">
            <div className="card card-pad space-y-4">
              <h2 className="section-title text-base">Request details</h2>

              <div>
                <label className="label">Requesting for</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`btn ${targetType === 'PERSONAL' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setTargetType('PERSONAL')}
                  >
                    Myself
                  </button>
                  <button
                    className={`btn ${targetType === 'PROJECT' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setTargetType('PROJECT')}
                    disabled={myProjects.length === 0}
                  >
                    <Users size={14} /> Project
                  </button>
                </div>
              </div>

              {targetType === 'PROJECT' && (
                <div>
                  <label className="label">Project / Team</label>
                  <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    {myProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Purpose / experiment</label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="e.g. Line-following robot prototype for the robotics practical"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Expected return date (optional)</label>
                <input type="date" className="input" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </div>

              {error && <Callout tone="danger">{error}</Callout>}

              <button className="btn btn-primary w-full" onClick={submit} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />}
                {busy ? 'Submitting…' : `Submit request (${lines.length} item${lines.length > 1 ? 's' : ''})`}
              </button>

              <button className="btn btn-ghost btn-sm w-full" onClick={clear}>
                Clear cart
              </button>
            </div>

            <Callout tone="info" title="What happens next">
              Your request goes to the lab admin as <strong>Pending</strong>. Once approved, collect the items
              at the counter — stock is only reduced at physical handover.
            </Callout>
          </div>
        </div>
      )}
    </div>
  );
}
