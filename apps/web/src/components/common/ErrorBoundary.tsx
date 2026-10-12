import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CircuitBoard, RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes so a single broken view cannot white-screen the
 * whole single-page application. The reload button is the recovery path.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Reported to the console in development; the browser access log is the
    // only sink available to a static build with no telemetry backend.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-full items-center justify-center bg-[var(--bg-subtle)] p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
            <ShieldAlert size={22} />
          </div>
          <div className="mb-3 flex items-center justify-center gap-2 text-[var(--text-muted)]">
            <CircuitBoard size={15} />
            <span className="text-xs font-semibold uppercase tracking-wide">Deep-Tech Lab Inventory</span>
          </div>
          <h1 className="text-lg font-bold text-[var(--text-strong)]">Something went wrong</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">
            This screen could not be displayed. Reloading the page usually fixes it. If the problem keeps
            happening, sign out and sign back in.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="btn btn-primary btn-sm" onClick={this.handleReset}>
              <RefreshCw size={14} /> Try again
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => window.location.assign('/')}>
              Reload
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-5 max-h-40 overflow-auto rounded-lg bg-[var(--bg-navy)] p-3 text-left text-[11px] leading-relaxed text-slate-200">
              {error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
