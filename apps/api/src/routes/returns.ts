import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { type AuthenticatedRequest, requireAdmin, requireAuth } from '../middleware/auth.js';

export const returnsRouter = Router();

const returnSchema = z.object({
  issueId: z.string().uuid(),
  clientCommandId: z.string().trim().min(8).max(100),
  note: z.string().trim().max(500).optional(),
  lines: z.array(z.object({
    issueLineId: z.string().uuid(),
    quantity: z.number().int().positive().max(9999),
    condition: z.enum(['WORKING', 'NEEDS_CHECKING', 'NOT_WORKING']).default('WORKING'),
    note: z.string().trim().max(500).optional(),
    unitIds: z.array(z.string().uuid()).optional(),
    unitId: z.string().uuid().optional(),
  })).min(1).max(50),
});

returnsRouter.post('/', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = returnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid return' } });
    return;
  }
  const input = parsed.data;
  const replay = await prisma.return.findUnique({ where: { clientCommandId: input.clientCommandId } });
  if (replay) {
    res.status(200).json(replay);
    return;
  }
  const issue = await prisma.issue.findUnique({ where: { id: input.issueId }, include: { lines: { include: { requestLine: { include: { item: true } }, units: { include: { unit: true } } } } } });
  if (!issue) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue record not found' } });
    return;
  }
  const submittedIds = input.lines.map((line) => line.issueLineId);
  if (new Set(submittedIds).size !== submittedIds.length || submittedIds.some((id) => !issue.lines.some((line) => line.id === id))) {
    res.status(400).json({ error: { code: 'INVALID_LINE', message: 'Return contains an invalid or duplicate issue line' } });
    return;
  }

  try {
    const returned = await prisma.$transaction(async (tx) => {
      const record = await tx.return.create({ data: { issueId: issue.id, processedById: req.user!.id, note: input.note, clientCommandId: input.clientCommandId } });
      for (const inputLine of input.lines) {
        const issueLine = issue.lines.find((line) => line.id === inputLine.issueLineId)!;
        const item = issueLine.requestLine?.item;
        if (!item || item.nature !== 'RETURNABLE') throw new Error('Only returnable items can be checked in');
        const remaining = issueLine.quantity - issueLine.returnedQty;
        if (inputLine.quantity > remaining) throw new Error(`Only ${remaining} ${item.unitOfMeasure} remain outstanding for ${item.name}`);

        const providedUnitIds = inputLine.unitIds ?? (inputLine.unitId ? [inputLine.unitId] : []);
        if (item.trackingMode === 'SERIALIZED') {
          if (providedUnitIds.length !== inputLine.quantity) throw new Error(`Select exactly ${inputLine.quantity} issued unit(s) for ${item.name}`);
          const issuedUnitIds = new Set(issueLine.units.map((entry) => entry.unitId));
          if (new Set(providedUnitIds).size !== providedUnitIds.length || providedUnitIds.some((id) => !issuedUnitIds.has(id))) {
            throw new Error(`A selected unit was not issued on this line`);
          }
          const alreadyReturned = await tx.returnLineUnit.count({ where: { unitId: { in: providedUnitIds } } });
          if (alreadyReturned > 0) throw new Error('A selected unit has already been returned');
        }

        const returnLine = await tx.returnLine.create({ data: { returnId: record.id, issueLineId: issueLine.id, quantity: inputLine.quantity, condition: inputLine.condition, note: inputLine.note } });
        await tx.issueLine.update({ where: { id: issueLine.id }, data: { returnedQty: { increment: inputLine.quantity } } });

        if (item.trackingMode === 'SERIALIZED') {
          for (const unitId of providedUnitIds) {
            const unit = issueLine.units.find((entry) => entry.unitId === unitId)!.unit;
            const nextStatus = inputLine.condition === 'WORKING' ? 'AVAILABLE' : 'UNAVAILABLE';
            const updated = await tx.inventoryUnit.updateMany({ where: { id: unitId, itemId: item.id, status: 'ALLOCATED' }, data: { status: nextStatus, currentLocationId: unit.homeLocationId, conditionNote: inputLine.note || inputLine.condition } });
            if (updated.count !== 1) throw new Error(`Unit ${unit.assetCode} is not currently allocated`);
            await tx.returnLineUnit.create({ data: { returnLineId: returnLine.id, unitId } });
            await tx.stockMovement.create({ data: { itemId: item.id, unitId, destLocationId: unit.homeLocationId, quantity: 1, type: 'RETURN', actorId: req.user!.id, reason: `Returned in condition: ${inputLine.condition}` } });
          }
        } else {
          const balance = await tx.stockBalance.findFirst({ where: { itemId: item.id, allocatedQuantity: { gte: inputLine.quantity } }, orderBy: { allocatedQuantity: 'desc' } });
          if (!balance) throw new Error(`Allocated balance not found for ${item.name}`);
          const restored = await tx.stockBalance.updateMany({ where: { id: balance.id, allocatedQuantity: { gte: inputLine.quantity } }, data: { availableQuantity: { increment: inputLine.quantity }, allocatedQuantity: { decrement: inputLine.quantity } } });
          if (restored.count !== 1) throw new Error(`Stock changed while returning ${item.name}; retry`);
          await tx.stockMovement.create({ data: { itemId: item.id, destLocationId: balance.locationId, quantity: inputLine.quantity, type: 'RETURN', actorId: req.user!.id, reason: `Returned in condition: ${inputLine.condition}` } });
        }
      }
      await tx.auditEvent.create({ data: { actorId: req.user!.id, action: 'STOCK_RETURN', entityType: 'Return', entityId: record.id, metadata: JSON.stringify({ issueId: issue.id }) } });
      return record;
    });
    res.status(201).json(returned);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Return failed';
    res.status(400).json({ error: { code: 'RETURN_FAILED', message } });
  }
});
