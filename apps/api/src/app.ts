import express, { type Request, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import compression from 'compression';
import { randomUUID } from 'node:crypto';
import { prisma } from './db.js';
import { env, loadEnv } from './env.js';
import { logger } from './logger.js';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { inventoryRouter } from './routes/inventory.js';
import { requestsRouter } from './routes/requests.js';
import { issuesRouter } from './routes/issues.js';
import { returnsRouter } from './routes/returns.js';
import { kitsRouter } from './routes/kits.js';
import { dashboardRouter } from './routes/dashboard.js';
import { allocationsRouter } from './routes/allocations.js';
import { managementRouter } from './routes/management.js';
import { requireAuth, requireCsrf, requirePasswordChanged } from './middleware/auth.js';

// Fail fast on misconfiguration rather than breaking later at runtime.
const config = loadEnv();

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Attach a request id so log lines from one request can be tied together.
app.use((req: Request, res: Response, next: express.NextFunction) => {
  const incoming = req.get('x-request-id');
  const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.setHeader('x-request-id', requestId);
  (req as Request & { id?: string }).id = requestId;
  next();
});

app.use((req: Request, res: Response, next: express.NextFunction) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    logger.info('http request', {
      requestId: (req as Request & { id?: string }).id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
    });
  });
  next();
});

if (config.NODE_ENV !== 'production') {
  app.use(cors({
    origin: config.WEB_ORIGIN,
    credentials: true,
  }));
}

// Routes a signed-in user must always be able to reach, even while the
// account is still on the temporary password the admin issued.
const PASSWORD_GATE_EXEMPT = ['/auth/password', '/auth/logout', '/auth/me'];

app.use('/api/v1', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || req.path === '/auth/login') {
    next();
    return;
  }
  requireAuth(req, res, () =>
    requireCsrf(req, res, () => {
      if (PASSWORD_GATE_EXEMPT.includes(req.path)) {
        next();
        return;
      }
      requirePasswordChanged(req, res, next);
    }),
  );
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', inventoryRouter);
app.use('/api/v1/requests', requestsRouter);
app.use('/api/v1/issues', issuesRouter);
app.use('/api/v1/returns', returnsRouter);
app.use('/api/v1/kits', kitsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/allocations', allocationsRouter);
app.use('/api/v1', managementRouter);

if (config.NODE_ENV === 'production') {
  const webDist = path.resolve(process.cwd(), 'apps/web/dist');
  const indexHtml = path.join(webDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(webDist, { index: false }));
    app.get(/^(?!\/api\/).*/, (_req: Request, res: Response) => {
      res.sendFile(indexHtml);
    });
  } else {
    app.get('/', (_req: Request, res: Response) => {
      res.json({ status: 'ok', service: 'Deep-Tech Lab Inventory API' });
    });
  }
}

// Liveness & Readiness Probes
app.get('/api/v1/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/health/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch (err) {
    logger.error('readiness check failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(503).json({ status: 'not_ready' });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Central error handler. Stack traces are logged, never returned to clients.
app.use((error: unknown, req: Request, res: Response, _next: express.NextFunction) => {
  const requestId = (req as Request & { id?: string }).id;
  const message = error instanceof Error ? error.message : String(error);
  logger.error('unhandled request error', { requestId, method: req.method, path: req.originalUrl, error: message });

  if (res.headersSent) return;
  if (config.NODE_ENV === 'production') {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId } });
    return;
  }
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId, detail: message } });
});

export { config as appConfig, env };

