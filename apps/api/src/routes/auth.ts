import { Router, type Request, type Response } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  SESSION_COOKIE,
  cookieOptions,
  createSession,
  destroySession,
  requireAuth,
  requireCsrf,
  type AuthenticatedRequest,
} from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  collegeId: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(256),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' } },
});

function publicUser(user: { id: string; collegeId: string; name: string; email: string | null; role: string; mustChangePassword: boolean }) {
  return {
    id: user.id,
    collegeId: user.collegeId,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

authRouter.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'College ID and password are required' } });
    return;
  }

  const user = await prisma.user.findUnique({ where: { collegeId: parsed.data.collegeId.toUpperCase() } });
  const validPassword = user?.status === 'ACTIVE' && await argon2.verify(user.passwordHash, parsed.data.password);
  if (!user || !validPassword) {
    res.status(401).json({ error: { code: 'AUTH_FAILED', message: 'Invalid credentials or inactive account' } });
    return;
  }

  const session = await createSession(user.id);
  res.cookie(SESSION_COOKIE, session.token, cookieOptions());
  await prisma.auditEvent.create({ data: { actorId: user.id, action: 'AUTH_LOGIN', entityType: 'Session' } });
  res.json({ user: publicUser(user), csrfToken: session.csrfToken });
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ ...req.user, csrfToken: req.csrfToken });
});

authRouter.post('/logout', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  await destroySession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  res.json({ message: 'Logged out successfully' });
});
