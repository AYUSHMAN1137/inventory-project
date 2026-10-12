import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): React.ReactElement {
  throw new Error('render exploded');
}

function Safe() {
  return <p>Rendered fine</p>;
}

/** Silence the expected console noise from the boundary's componentDidCatch. */
function quietErrorSpy() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Safe />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Rendered fine')).toBeInTheDocument();
  });

  it('catches a render crash and shows a recovery screen instead of a white page', () => {
    const spy = quietErrorSpy();
    try {
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      );

      expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it('recovers when the user retries after the crash', async () => {
    const spy = quietErrorSpy();
    let shouldThrow = true;

    function Toggle() {
      if (shouldThrow) throw new Error('boom');
      return <p>Recovered</p>;
    }

    try {
      render(
        <ErrorBoundary>
          <Toggle />
        </ErrorBoundary>,
      );
      expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();

      shouldThrow = false;
      await userEvent.click(screen.getByRole('button', { name: /try again/i }));

      await waitFor(() => expect(screen.getByText('Recovered')).toBeInTheDocument());
    } finally {
      spy.mockRestore();
    }
  });
});
