// ---------------------------------------------------------------------------
// Environment configuration — validated once at process start.
//
// The server refuses to boot when a required variable is missing or invalid.
// This prevents the classic production failure where the app starts happily
// with an undefined DATABASE_URL or a weak SESSION_SECRET and only breaks
// later at runtime.
// ---------------------------------------------------------------------------

import { z } from 'zod';

const isTest = process.env.NODE_ENV === 'test';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Sessions are signed/derived with this secret. In production a weak value
  // is a real vulnerability, so it is rejected; tests and local development
  // accept any non-empty value.
  SESSION_SECRET: isTest
    ? z.string().min(1).optional().default('test-session-secret')
    : z
        .string()
        .min(32, 'SESSION_SECRET must be at least 32 characters'),

  // Origin the browser is served from. Used for CORS in development and for
  // validating the request origin behind the TLS proxy in production.
  APP_ORIGIN: z.string().url().default('http://localhost:4000'),

  // Dev-only CORS origin for the Vite server.
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Parses and validates the environment, caching the result. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/** The validated environment. Throws on first access if it is invalid. */
export function env(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}
