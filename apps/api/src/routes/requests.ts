import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireAdmin } from '../middleware/auth.js';

export const requestsRouter = Router();

// GET /api/v1/requests - List requests
requestsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const isStudent = req.user!.role === 'STUDENT';

  const whereClause: any = {};
  if (isStudent) {
    whereClause.OR = [
      { requesterId: req.user!.id },
      { project: { members: { some: { userId: req.user!.id } } } },
    ];
  }

  const requests = await prisma.request.findMany({
    where: whereClause,
    include: {
      requester: { select: { id: true, name: true, collegeId: true } },
      project: { select: { id: true, name: true } },
      lines: {
        include: {
          item: { select: { id: true, name: true, nature: true, trackingMode: true, unitOfMeasure: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: requests });
});

// POST /api/v1/requests - Create new request (Student or Admin)
requestsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { targetType, projectId, purpose, expectedReturnDate, lines } = req.body;

  if (!purpose || !Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Purpose and at least one item line are required' } });
    return;
  }

  if (targetType === 'PROJECT' && !projectId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Project ID is required for project requests' } });
    return;
  }

  const newRequest = await prisma.request.create({
    data: {
      requesterId: req.user!.id,
      targetType: targetType === 'PROJECT' ? 'PROJECT' : 'PERSONAL',
      projectId: targetType === 'PROJECT' ? projectId : null,
      purpose,
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      lines: {
        create: lines.map((l: any) => ({
          itemId: l.itemId,
          requestedQty: Number(l.quantity),
          approvedQty: 0,
        })),
      },
    },
    include: {
      lines: { include: { item: true } },
    },
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      actorId: req.user!.id,
      action: 'REQUEST_SUBMIT',
      entityType: 'Request',
      entityId: newRequest.id,
      metadata: JSON.stringify({ linesCount: lines.length }),
    },
  });

  res.status(201).json(newRequest);
});

// POST /api/v1/requests/:id/decision - Admin decision (Approve / Reject)
requestsRouter.post('/:id/decision', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { status, decisionReason, lines } = req.body;

  const targetRequest = await prisma.request.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!targetRequest) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
    return;
  }

  if (targetRequest.decisionStatus !== 'PENDING') {
    res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Only PENDING requests can be decided' } });
    return;
  }

  // Update line approved quantities if provided
  await prisma.$transaction(async (tx) => {
    if (Array.isArray(lines)) {
      for (const line of lines) {
        await tx.requestLine.update({
          where: { id: line.lineId },
          data: {
            approvedQty: Number(line.approvedQuantity),
            rejectionReason: line.rejectionReason,
          },
        });
      }
    }

    await tx.request.update({
      where: { id },
      data: {
        decisionStatus: status, // APPROVED, PARTIALLY_APPROVED, REJECTED
        decisionReason,
        decidedAt: new Date(),
      },
    });

    await tx.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: `REQUEST_DECISION_${status}`,
        entityType: 'Request',
        entityId: id,
        metadata: JSON.stringify({ status, decisionReason }),
      },
    });
  });

  const updated = await prisma.request.findUnique({
    where: { id },
    include: { lines: { include: { item: true } } },
  });

  res.json(updated);
});
