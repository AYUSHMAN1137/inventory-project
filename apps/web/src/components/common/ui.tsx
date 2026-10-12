import { useEffect, useRef, type ReactNode } from 'react';
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Loader2,
  PackageX,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

/* ------------------------------------------------------------------ Badge */

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'accent';

const toneClass: Record<BadgeTone, string> = {
  ok: 'badge-ok',
  warn: 'badge-warn',
  danger: 'badge-danger',
  info: 'badge-info',
  neutral: 'badge-neutral',
  accent: 'badge-accent',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge ${toneClass[tone]}`}>{children}</span>;
}

/* --------------------------------------------------------- Status helpers */

export function decisionTone(status: string): BadgeTone {
  switch (status) {
    case 'APPROVED':
      return 'ok';
    case 'PARTIALLY_APPROVED':
      return 'info';
    case 'REJECTED':
      return 'danger';
    case 'CANCELLED':
      return 'neutral';
    default:
      return 'warn';
  }
}

export function decisionLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fulfilmentTone(status: string): BadgeTone {
  switch (status) {
    case 'FULFILLED':
      return 'ok';
    case 'PARTIALLY_ISSUED':
      return 'info';
    default:
      return 'neutral';
  }
}

export function unitTone(status: string): BadgeTone {
  switch (status) {
    case 'AVAILABLE':
      return 'ok';
    case 'ALLOCATED':
      return 'info';
    case 'UNAVAILABLE':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function conditionTone(condition: string | null | undefined): BadgeTone {
  switch (condition) {
    case 'WORKING':
      return 'ok';
    case 'NEEDS_CHECKING':
      return 'warn';
    case 'NOT_WORKING':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function natureTone(nature: string): BadgeTone {
  return nature === 'CONSUMABLE' ? 'warn' : 'accent';
}

/* ------------------------------------------------------------ Empty/Error */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)]">
        {icon ?? <PackageX size={22} />}
      </div>
      <p className="text-sm font-semibold text-[var(--text-strong)]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-[var(--text-muted)]">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
        <ShieldAlert size={22} />
      </div>
      <p className="text-sm font-semibold text-[var(--text-strong)]">Something went wrong</p>
      <p className="mt-1 max-w-md text-sm text-[var(--text-muted)]">{message}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm mt-4" onClick={onRetry}>
          <RefreshCw size={13} /> Retry
        </button>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="skeleton h-9 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Remember the element that opened the dialog so focus can be restored.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    focusables()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // Trap Tab inside the dialog so the page behind stays inert.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`animate-slide-up relative z-10 w-full ${width} rounded-xl border bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <h3 id="modal-title" className="text-base font-semibold">
              {title}
            </h3>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t bg-[var(--bg-subtle)] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Drawer */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    focusables()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="animate-slide-right relative z-10 flex h-full w-full max-w-lg flex-col border-l bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <h3 id="drawer-title" className="text-base font-semibold">
              {title}
            </h3>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t bg-[var(--bg-subtle)] px-5 py-3">{footer}</div>}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------- Callout */

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'ok' | 'warn' | 'danger';
  title?: string;
  children: ReactNode;
}) {
  const map = {
    info: { cls: 'border-[#bfdbfe] bg-[var(--info-soft)] text-[#1e40af]', Icon: CircleAlert },
    ok: { cls: 'border-[#a7f3d0] bg-[var(--ok-soft)] text-[#065f46]', Icon: CircleCheck },
    warn: { cls: 'border-[#fde68a] bg-[var(--warn-soft)] text-[#92400e]', Icon: CircleDashed },
    danger: { cls: 'border-[#fecdd3] bg-[var(--danger-soft)] text-[#9f1239]', Icon: CircleAlert },
  } as const;
  const { cls, Icon } = map[tone];
  return (
    <div className={`flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${cls}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Stat */

export function KpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';
  icon?: ReactNode;
}) {
  const accentBar: Record<string, string> = {
    neutral: 'bg-slate-300',
    ok: 'bg-emerald-500',
    warn: 'bg-amber-500',
    danger: 'bg-rose-500',
    accent: 'bg-teal-600',
  };
  return (
    <div className="card card-hover relative overflow-hidden p-4">
      <span className={`absolute left-0 top-0 h-full w-1 ${accentBar[tone]}`} />
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
        {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
      </div>
      <p className="kpi-value mt-2">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------- Pagination */

export function StockBar({ available, total }: { available: number; total: number }) {
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;
  const tone = pct === 0 ? 'bg-rose-500' : pct <= 34 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="mono text-xs text-[var(--text-muted)]">
        {available}/{total}
      </span>
    </div>
  );
}
