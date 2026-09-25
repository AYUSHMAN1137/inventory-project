import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { type AuthenticatedRequest, requireAdmin, requireAuth } from '../middleware/auth.js';

export const issuesRouter = Router();

const issueSchema = z.object({
  requestId: z.string().uuid(),
  collectorCollegeId: z.string().trim().min(3).max(64),
  expectedReturnDate: z.string().datetime().optional().nullable(),
  note: z.string().trim().max(500).optional(),
  clientCommandId: z.string().trim().min(8).max(100),
  lines: z.array(z.object({
    requestLineId: z.string().uuid(),
    quantity: z.number().int().positive().max(9999),
    unitIds: z.array(z.string().uuid()).optional(),
  })).min(1).max(50),
});

issuesRouter.post('/', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid issue' } });
    return;
  }
  const input = parsed.data;
  const replay = await prisma.issue.findUnique({ where: { clientCommandId: input.clientCommandId } });
  if (replay) {
    res.status(200).json(replay);
    return;
  }

  const collector = await prisma.user.findUnique({ where: { collegeId: input.collectorCollegeId.toUpperCase() } });
  if (!collector || collector.status !== 'ACTIVE' || collector.role !== 'STUDENT') {
    res.status(400).json({ error: { code: 'COLLECTOR_NOT_FOUND', message: 'An active student account is required' } });
    return;
  }
  const target = await prisma.request.findUnique({ where: { id: input.requestId }, include: { lines: { include: { item: true } }, project: { include: { members: true } } } });
  if (!target) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
    return;
  }
  if (!['APPROVED', 'PARTIALLY_APPROVED'].includes(target.decisionStatus)) {
    res.status(409).json({ error: { code: 'INVALID_STATE', message: 'Only approved requests can be issued' } });
    return;
  }
  if (target.targetType === 'PERSONAL' && collector.id !== target.requesterId) {
    res.status(403).json({ error: { code: 'COLLECTOR_MISMATCH', message: 'This request belongs to another student' } });
    return;
  }
  if (target.targetType === 'PROJECT' && !target.project?.members.some((member) => member.userId === collector.id)) {
    res.status(403).json({ error: { code: 'COLLECTOR_MISMATCH', message: 'Collector is not a project member' } });
    return;
  }

  const submittedIds = input.lines.map((line) => line.requestLineId);
  if (new Set(submittedIds).size !== submittedIds.length || submittedIds.some((id) => !target.lines.some((line) => line.id === id))) {
    res.status(400).json({ error: { code: 'INVALID_LINE', message: 'Issue contains an invalid or duplicate request line' } });
    return;
  }
  for (const line of input.lines) {
    const requestLine = target.lines.find((candidate) => candidate.id === line.requestLineId)!;
    if (line.quantity > requestLine.approvedQty - requestLine.issuedQty) {
      res.status(409).json({ error: { code: 'APPROVED_QUANTITY_EXCEEDED', message: `Only ${requestLine.approvedQty - requestLine.issuedQty} ${requestLine.item.unitOfMeasure} of ${requestLine.item.name} remain approved` } });
      return;
    }
    if (requestLine.item.trackingMode === 'SERIALIZED' && line.unitIds && line.unitIds.length !== line.quantity) {
      res.status(400).json({ error: { code: 'INVALID_UNITS', message: `Select exactly ${line.quantity} unit(s) for ${requestLine.item.name}` } });
      return;
    }
  }

  try {
    const issue = await prisma.$transaction(async (tx) => {
      const created = await tx.issue.create({ data: { requestId: target.id, studentId: collector.id, projectId: target.projectId, issuedById: req.user!.id, expectedReturnDate: input.expectedReturnDate ? new Date(input.expectedReturnDate) : target.expectedReturnDate, note: input.note, clientCommandId: input.clientCommandId } });
      for (const line of input.lines) {
        const requestLine = target.lines.find((candidate) => candidate.id === line.requestLineId)!;
        const issueLine = await tx.issueLine.create({ data: { issueId: created.id, requestLineId: requestLine.id, quantity: line.quantity } });
        await tx.requestLine.update({ where: { id: requestLine.id }, data: { issuedQty: { increment: line.quantity } } });

        if (requestLine.item.trackingMode === 'SERIALIZED') {
          const units = line.unitIds?.length
            ? await tx.inventoryUnit.findMany({ where: { id: { in: line.unitIds }, itemId: requestLine.itemId, status: 'AVAILABLE' } })
            : await tx.inventoryUnit.findMany({ where: { itemId: requestLine.itemId, status: 'AVAILABLE' }, orderBy: { assetCode: 'asc' }, take: line.quantity });
          if (units.length !== line.quantity) throw new Error(`Insufficient available units for ${requestLine.item.name}`);
          for (const unit of units) {
            const claimed = await tx.inventoryUnit.updateMany({ where: { id: unit.id, status: 'AVAILABLE' }, data: { status: 'ALLOCATED', currentLocationId: null } });
            if (claimed.count !== 1) throw new Error(`Unit ${unit.assetCode} is no longer available`);
            await tx.issueLineUnit.create({ data: { issueLineId: issueLine.id, unitId: unit.id } });
            await tx.stockMovement.create({ data: { itemId: requestLine.itemId, unitId: unit.id, sourceLocationId: unit.currentLocationId, quantity: 1, type: 'ISSUE', actorId: req.user!.id, reason: `Issued against request ${target.id}` } });
          }
        } else {
          const balance = await tx.stockBalance.findFirst({ where: { itemId: requestLine.itemId, availableQuantity: { gte: line.quantity } }, orderBy: { availableQuantity: 'desc' } });
          if (!balance) throw new Error(`Insufficient stock for ${requestLine.item.name}`);
          const claimed = await tx.stockBalance.updateMany({ where: { id: balance.id, availableQuantity: { gte: line.quantity } }, data: { availableQuantity: { decrement: line.quantity }, allocatedQuantity: { increment: requestLine.item.nature === 'RETURNABLE' ? line.quantity : 0 } } });
          if (claimed.count !== 1) throw new Error(`Stock changed while issuing ${requestLine.item.name}; retry`);
          await tx.stockMovement.create({ data: { itemId: requestLine.itemId, sourceLocationId: balance.locationId, quantity: line.quantity, type: 'ISSUE', actorId: req.user!.id, reason: `Issued against request ${target.id}` } });
        }
      }
      const updatedLines = await tx.requestLine.findMany({ where: { requestId: target.id } });
      const approvedLines = updatedLines.filter((line) => line.approvedQty > 0);
      const allFulfilled = approvedLines.length > 0 && approvedLines.every((line) => line.issuedQty >= line.approvedQty);
      await tx.request.update({ where: { id: target.id }, data: { fulfilmentStatus: allFulfilled ? 'FULFILLED' : 'PARTIALLY_ISSUED' } });
      await tx.auditEvent.create({ data: { actorId: req.user!.id, action: 'STOCK_ISSUE', entityType: 'Issue', entityId: created.id, metadata: JSON.stringify({ requestId: target.id, collectorId: collector.id }) } });
      return created;
    });
    res.status(201).json(issue);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Issue failed';
    res.status(409).json({ error: { code: 'ISSUE_FAILED', message } });
  }
});
