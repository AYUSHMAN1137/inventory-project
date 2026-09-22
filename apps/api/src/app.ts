import express, { Request, Response } from 'express';
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

export const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', inventoryRouter);
app.use('/api/v1/requests', requestsRouter);
app.use('/api/v1/issues', issuesRouter);
app.use('/api/v1/returns', returnsRouter);
app.use('/api/v1/kits', kitsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/allocations', allocationsRouter);

// Liveness & Readiness Probes
app.get('/api/v1/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/health/ready', (_req: Request, res: Response) => {
  res.json({ status: 'ready' });
});
