import { Router, type Response } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../db.js';
import { type AuthenticatedRequest, requireAdmin, requireAuth } from '../middleware/auth.js';

export const managementRouter = Router();

const userSchema = z.object({
  collegeId: z.string().trim().min(3).max(64).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  email: z.string().email().optional().nullable(),
  role: z.enum(['ADMIN', 'STUDENT']).default('STUDENT'),
  temporaryPassword: z.string().min(10).max(256),
});

const projectSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional(),
  memberIds: z.array(z.string().uuid()).max(100).default([]),
});

managementRouter.get('/users', requireAuth, requireAdmin, async (_req, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, collegeId: true, name: true, email: true, role: true, status: true, mustChangePassword: true, createdAt: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json({ data: users });
});

managementRouter.post('/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid user' } }); return; }
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { collegeId: parsed.data.collegeId, name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, passwordHash: await argon2.hash(parsed.data.temporaryPassword), mustChangePassword: true } });
      await tx.auditEvent.create({ data: { actorId: req.user!.id, action: 'USER_CREATE', entityType: 'User', entityId: created.id, metadata: JSON.stringify({ collegeId: created.collegeId, role: created.role }) } });
      return created;
    });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch { res.status(409).json({ error: { code: 'DUPLICATE_USER', message: 'College ID or email is already in use' } }); }
});

managementRouter.get('/projects', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const projects = await prisma.project.findMany({
    where: req.user!.role === 'STUDENT' ? { isActive: true, members: { some: { userId: req.user!.id } } } : {},
    include: { members: { include: { user: { select: { id: true, collegeId: true, name: true, status: true } } } }, _count: { select: { requests: true, issues: true } } },
    orderBy: { name: 'asc' },
  });
  res.json({ data: projects });
});

managementRouter.post('/projects', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid project' } }); return; }
  if (new Set(parsed.data.memberIds).size !== parsed.data.memberIds.length) { res.status(400).json({ error: { code: 'DUPLICATE_MEMBER', message: 'A student can be added only once' } }); return; }
  const memberCount = await prisma.user.count({ where: { id: { in: parsed.data.memberIds }, role: 'STUDENT', status: 'ACTIVE' } });
  if (memberCount !== parsed.data.memberIds.length) { res.status(400).json({ error: { code: 'INVALID_MEMBER', message: 'Every member must be an active student' } }); return; }
  try {
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({ data: { name: parsed.data.name, description: parsed.data.description, members: { create: parsed.data.memberIds.map((userId, index) => ({ userId, role: index === 0 ? 'LEADER' : 'MEMBER' })) } }, include: { members: { include: { user: { select: { id: true, collegeId: true, name: true } } } } } });
      await tx.auditEvent.create({ data: { actorId: req.user!.id, action: 'PROJECT_CREATE', entityType: 'Project', entityId: created.id } });
      return created;
    });
    res.status(201).json(project);
  } catch { res.status(409).json({ error: { code: 'DUPLICATE_PROJECT', message: 'A project with this name already exists' } }); }
});
