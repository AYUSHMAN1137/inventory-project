import { Router, type Request, type Response } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { logger } from '../logger.js';
import {
  SESSION_COOKIE,
  cookieOptions,
  createSession,
  destroySession,
  destroySessionsForUser,
  requireAuth,
  requireCsrf,
  type AuthenticatedRequest,
} from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  collegeId: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(256),
});

// Password policy — long enough to be safe, with a light complexity floor so
// seeded temporary passwords cannot survive as permanent ones.
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 256;
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX)
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1).max(PASSWORD_MAX),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' } },
});

// Passwords are changed at most a handful of times per session, but a tight
// limit stops an attacker who has stolen a session from grinding candidates.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many password changes. Try again later.' } },
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

/**
 * PATCH /api/v1/auth/password
 *
 * Changes the signed-in user's password. This is the escape hatch from the
 * `mustChangePassword` state set when an admin provisions an account — without
 * it a temporary password could never be rotated.
 *
 * On success every *other* session for the user is revoked, which forces a
 * fresh login everywhere and limits the blast radius of a stolen token.
 */
authRouter.patch('/password', requireAuth, requireCsrf, changePasswordLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid password' } });
    return;
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: { code: 'PASSWORD_MISMATCH', message: 'New password and confirmation do not match' } });
    return;
  }
  if (newPassword === currentPassword) {
    res.status(400).json({ error: { code: 'PASSWORD_REUSED', message: 'The new password must be different from the current one' } });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || user.status !== 'ACTIVE') {
    res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Session no longer valid' } });
    return;
  }

  const currentValid = await argon2.verify(user.passwordHash, currentPassword);
  if (!currentValid) {
    res.status(401).json({ error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect' } });
    return;
  }

  const passwordHash = await argon2.hash(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    await tx.auditEvent.create({
      data: { actorId: user.id, action: 'AUTH_PASSWORD_CHANGE', entityType: 'User', entityId: user.id },
    });
  });

  // Revoke every other session so any stolen token dies with the old password.
  await destroySessionsForUser(user.id, req.sessionId);

  // Re-issue a fresh session for this browser so the user stays signed in.
  const session = await createSession(user.id);
  res.cookie(SESSION_COOKIE, session.token, cookieOptions());

  logger.info('password changed', { actorId: user.id, collegeId: user.collegeId });
  res.json({ user: publicUser({ ...user, mustChangePassword: false }), csrfToken: session.csrfToken });
});
