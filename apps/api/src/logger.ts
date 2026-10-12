// ---------------------------------------------------------------------------
// Structured logging.
//
// Production needs greppable, machine-readable logs; `console.log` cannot tell
// an operator what happened after the fact. This is a tiny dependency-free
// logger that emits JSON lines (or readable text in development).
// ---------------------------------------------------------------------------

import { env } from './env.js';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const isProduction = () => env().NODE_ENV === 'production';

function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[env().LOG_LEVEL]) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ?? {}),
  };

  const line = isProduction() ? JSON.stringify(entry) : `${entry.time} ${level.toUpperCase().padEnd(5)} ${message}${context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : ''}`;

  if (level === 'error' || level === 'fatal') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const logger = {
  fatal: (message: string, context?: Record<string, unknown>) => write('fatal', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  trace: (message: string, context?: Record<string, unknown>) => write('trace', message, context),
};
