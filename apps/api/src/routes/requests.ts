import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { type AuthenticatedRequest, requireAdmin, requireAuth } from '../middleware/auth.js';

export const requestsRouter = Router();

const requestSchema = z.object({
  targetType: z.enum(['PERSONAL', 'PROJECT']).default('PERSONAL'),
  projectId: z.string().uuid().optional(),
  purpose: z.string().trim().min(5).max(500),
  expectedReturnDate: z.string().datetime().optional().nullable(),
  lines: z.array(z.object({ itemId: z.string().min(1), quantity: z.number().int().positive().max(9999) })).min(1).max(50),
}).superRefine((data, context) => {
  if (data.targetType === 'PROJECT' && !data.projectId) {
    context.addIssue({ code: 'custom', message: 'Project ID is required for project requests', path: ['projectId'] });
  }
  if (new Set(data.lines.map((line) => line.itemId)).size !== data.lines.length) {
    context.addIssue({ code: 'custom', message: 'Duplicate items must be combined into one line', path: ['lines'] });
  }
});

const decisionSchema = z.object({
  status: z.enum(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED']),
  decisionReason: z.string().trim().max(500).optional(),
  lines: z.array(z.object({
    lineId: z.string().uuid(),
    approvedQuantity: z.number().int().min(0).max(9999),
    rejectionReason: z.string().trim().max(300).optional(),
  })).default([]),
});

requestsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const where = req.user!.role === 'STUDENT'
    ? { OR: [{ requesterId: req.user!.id }, { project: { members: { some: { userId: req.user!.id } } } }] }
    : {};
  const requests = await prisma.request.findMany({
    where,
    include: {
      requester: { select: { id: true, name: true, collegeId: true } },
      project: { select: { id: true, name: true } },
      lines: { include: { item: { select: { id: true, name: true, nature: true, trackingMode: true, unitOfMeasure: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: requests });
});

requestsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request' } });
    return;
  }
  const input = parsed.data;
  if (input.targetType === 'PROJECT') {
    const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: input.projectId!, userId: req.user!.id } } });
    if (!membership && req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: { code: 'PROJECT_ACCESS_DENIED', message: 'You are not a member of this project' } });
      return;
    }
  }
  const activeItems = await prisma.item.count({ where: { id: { in: input.lines.map((line) => line.itemId) }, isActive: true } });
  if (activeItems !== input.lines.length) {
    res.status(400).json({ error: { code: 'INVALID_ITEM', message: 'One or more items are unavailable' } });
    return;
  }

  const newRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.request.create({
      data: {
        requesterId: req.user!.id,
        targetType: input.targetType,
        projectId: input.targetType === 'PROJECT' ? input.projectId : null,
        purpose: input.purpose,
        expectedReturnDate: input.expectedReturnDate ? new Date(input.expectedReturnDate) : null,
        lines: { create: input.lines.map((line) => ({ itemId: line.itemId, requestedQty: line.quantity })) },
      },
      include: { lines: { include: { item: true } } },
    });
    await tx.auditEvent.create({ data: { actorId: req.user!.id, action: 'REQUEST_SUBMIT', entityType: 'Request', entityId: created.id, metadata: JSON.stringify({ linesCount: input.lines.length }) } });
    return created;
  });
  res.status(201).json(newRequest);
});

requestsRouter.post('/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const target = await prisma.request.findUnique({ where: { id } });
  if (!target) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }); return; }
  if (req.user!.role !== 'ADMIN' && target.requesterId !== req.user!.id) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot cancel this request' } }); return; }
  if (target.decisionStatus !== 'PENDING' || target.fulfilmentStatus !== 'NOT_ISSUED') { res.status(409).json({ error: { code: 'INVALID_STATE', message: 'Only pending, unissued requests can be cancelled' } }); return; }
  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.request.update({ where: { id }, data: { decisionStatus: 'CANCELLED' } });
    await tx.auditEvent.create({ data: { actorId: req.user!.id, action: 'REQUEST_CANCEL', entityType: 'Request', entityId: id } });
    return updated;
  });
  res.json(cancelled);
});

requestsRouter.post('/:id/decision', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid decision' } });
    return;
  }
  const id = String(req.params.id);
  const target = await prisma.request.findUnique({ where: { id }, include: { lines: true } });
  if (!target) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
    return;
  }
  if (target.decisionStatus !== 'PENDING') {
    res.status(409).json({ error: { code: 'INVALID_STATE', message: 'Only pending requests can be decided' } });
    return;
  }

  const submitted = new Map(parsed.data.lines.map((line) => [line.lineId, line]));
  if (submitted.size !== parsed.data.lines.length || [...submitted.keys()].some((lineId) => !target.lines.some((line) => line.id === lineId))) {
    res.status(400).json({ error: { code: 'INVALID_LINE', message: 'Decision contains an invalid request line' } });
    return;
  }
  const approvals = target.lines.map((line) => ({ line, decision: submitted.get(line.id) }));
  if (approvals.some(({ line, decision }) => (decision?.approvedQuantity ?? 0) > line.requestedQty)) {
    res.status(400).json({ error: { code: 'INVALID_QUANTITY', message: 'Approved quantity cannot exceed requested quantity' } });
    return;
  }
  const approvedTotal = approvals.reduce((sum, entry) => sum + (entry.decision?.approvedQuantity ?? 0), 0);
  const requestedTotal = target.lines.reduce((sum, line) => sum + line.requestedQty, 0);
  const derivedStatus = approvedTotal === 0 ? 'REJECTED' : approvedTotal === requestedTotal ? 'APPROVED' : 'PARTIALLY_APPROVED';
  if (parsed.data.status !== derivedStatus) {
    res.status(400).json({ error: { code: 'STATUS_MISMATCH', message: `Decision quantities require status ${derivedStatus}` } });
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const { line, decision } of approvals) {
      await tx.requestLine.update({ where: { id: line.id }, data: { approvedQty: decision?.approvedQuantity ?? 0, rejectionReason: decision?.rejectionReason } });
    }
    await tx.request.update({ where: { id }, data: { decisionStatus: derivedStatus, decisionReason: parsed.data.decisionReason, decidedAt: new Date() } });
    await tx.auditEvent.create({ data: { actorId: req.user!.id, action: `REQUEST_DECISION_${derivedStatus}`, entityType: 'Request', entityId: id, metadata: JSON.stringify({ status: derivedStatus, reason: parsed.data.decisionReason }) } });
  });
  const updated = await prisma.request.findUnique({ where: { id }, include: { lines: { include: { item: true } }, requester: { select: { id: true, name: true, collegeId: true } }, project: { select: { id: true, name: true } } } });
  res.json(updated);
});
