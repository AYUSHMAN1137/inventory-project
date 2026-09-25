import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { prisma } from './db.js';
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
import { requireAuth, requireCsrf } from './middleware/auth.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin: process.env.WEB_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));
}
app.use('/api/v1', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || req.path === '/auth/login') {
    next();
    return;
  }
  requireAuth(req, res, () => requireCsrf(req, res, next));
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

if (process.env.NODE_ENV === 'production') {
  const webDist = path.resolve(process.cwd(), 'apps/web/dist');
  app.use(express.static(webDist, { index: false }));
  app.get(/^(?!\/api\/).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// Liveness & Readiness Probes
app.get('/api/v1/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/health/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

app.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
});
