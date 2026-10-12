import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';

export const SESSION_COOKIE = 'dt_session';
const SESSION_HOURS = 8;

export interface SessionUser {
  id: string;
  collegeId: string;
  name: string;
  email: string | null;
  role: 'ADMIN' | 'STUDENT';
  mustChangePassword: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
  sessionId?: string;
  csrfToken?: string;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken() {
  return randomBytes(32).toString('base64url');
}

export async function createSession(userId: string) {
  const token = newToken();
  const csrfToken = newToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), csrfToken, expiresAt } });
  return { token, csrfToken, expiresAt };
}

export async function destroySession(token?: string) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Revokes every session for a user, optionally keeping one alive. */
export async function destroySessionsForUser(userId: string, keepSessionId?: string) {
  await prisma.session.deleteMany({
    where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
  });
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    return;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, collegeId: true, name: true, email: true, role: true, status: true, mustChangePassword: true } } },
  });

  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Session expired or account inactive' } });
    return;
  }

  req.user = session.user;
  req.sessionId = session.id;
  req.csrfToken = session.csrfToken;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin privileges required' } });
    return;
  }
  next();
}

export function requireCsrf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.csrfToken || req.get('x-csrf-token') !== req.csrfToken) {
    res.status(403).json({ error: { code: 'CSRF_INVALID', message: 'Security token missing or invalid' } });
    return;
  }
  next();
}

/**
 * Blocks state-changing work while the account is still on the temporary
 * password the admin issued. Defence-in-depth: the UI also gates these
 * screens behind a forced password-change form.
 */
export function requirePasswordChanged(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.mustChangePassword) {
    res.status(403).json({ error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'Change your temporary password before continuing' } });
    return;
  }
  next();
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
    path: '/',
  };
}
