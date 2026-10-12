/// <reference types="vite/client" />

/**
 * Typed environment surface exposed to the browser by Vite.
 *
 * Everything in here is INLINED INTO THE PUBLIC BUNDLE — never put a backend
 * secret in a `VITE_` variable.
 */
interface ImportMetaEnv {
  /** Set to "true" on a local machine to show the seeded-account hint. */
  readonly VITE_SHOW_DEMO_HINTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
