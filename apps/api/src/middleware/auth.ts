import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    collegeId: string;
    name: string;
    role: 'ADMIN' | 'STUDENT';
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.cookies['dt_user_id'];
  if (!userId) {
    res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, collegeId: true, name: true, role: true, status: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'User inactive or session invalid' } });
    return;
  }

  req.user = user as AuthenticatedRequest['user'];
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin privileges required' } });
    return;
  }
  next();
}
