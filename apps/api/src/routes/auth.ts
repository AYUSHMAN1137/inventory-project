import { Router, Request, Response } from 'express';
import argon2 from 'argon2';
import { prisma } from '../db.js';

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { collegeId, password } = req.body;

  if (!collegeId || !password) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'College ID and password are required' } });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { collegeId: String(collegeId).trim() },
  });

  if (!user || user.status !== 'ACTIVE') {
    res.status(401).json({ error: { code: 'AUTH_FAILED', message: 'Invalid credentials or inactive account' } });
    return;
  }

  const validPassword = await argon2.verify(user.passwordHash, password);
  if (!validPassword) {
    res.status(401).json({ error: { code: 'AUTH_FAILED', message: 'Invalid credentials' } });
    return;
  }

  // Set session cookie
  res.cookie('dt_user_id', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  });

  res.json({
    user: {
      id: user.id,
      collegeId: user.collegeId,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// GET /api/v1/auth/me
authRouter.get('/me', async (req: Request, res: Response) => {
  const userId = req.cookies['dt_user_id'];
  if (!userId) {
    res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Not authenticated' } });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      collegeId: true,
      name: true,
      email: true,
      role: true,
      status: true,
      mustChangePassword: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    res.clearCookie('dt_user_id');
    res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'User not found or inactive' } });
    return;
  }

  res.json(user);
});

// POST /api/v1/auth/logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('dt_user_id');
  res.json({ message: 'Logged out successfully' });
});
