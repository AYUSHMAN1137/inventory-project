/**
 * Vitest setup for browser-side tests. `@testing-library/jest-dom` extends
 * `expect` with DOM matchers; the cleanup call restores a fresh DOM between
 * test cases so state cannot leak from one render to the next.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// The app only ever uses window.matchMedia indirectly through component
// libraries; stub it so renders never explode in jsdom.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
