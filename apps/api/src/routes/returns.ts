import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireAdmin } from '../middleware/auth.js';

export const returnsRouter = Router();

// POST /api/v1/returns - Process physical return of issued items
returnsRouter.post('/', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { issueId, note, lines } = req.body;

  if (!issueId || !Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Issue ID and return lines are required' } });
    return;
  }

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      lines: {
        include: {
          requestLine: { include: { item: true } },
          units: { include: { unit: true } },
        },
      },
    },
  });

  if (!issue) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue record not found' } });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Return record
      const returnRecord = await tx.return.create({
        data: {
          issueId,
          processedById: req.user!.id,
          note,
        },
      });

      // 2. Process return lines
      for (const line of lines) {
        const issueLine = issue.lines.find((l) => l.id === line.issueLineId);
        if (!issueLine) continue;

        const returnQty = Number(line.quantity);
        const item = issueLine.requestLine?.item;
        if (!item || item.nature !== 'RETURNABLE') {
          throw new Error('Only RETURNABLE items can be returned');
        }

        const remainingAllocated = issueLine.quantity - issueLine.returnedQty;
        if (returnQty > remainingAllocated) {
          throw new Error(`Cannot return ${returnQty}; only ${remainingAllocated} remaining`);
        }

        const condition = line.condition || 'WORKING';

        const createdReturnLine = await tx.returnLine.create({
          data: {
            returnId: returnRecord.id,
            issueLineId: issueLine.id,
            quantity: returnQty,
            condition,
            note: line.note,
          },
        });

        // Increment returnedQty on issueLine
        await tx.issueLine.update({
          where: { id: issueLine.id },
          data: { returnedQty: { increment: returnQty } },
        });

        if (item.trackingMode === 'SERIALIZED') {
          const unitId = line.unitId;
          if (!unitId) {
            throw new Error(`Unit ID required for serialized item ${item.name}`);
          }

          // New unit status based on condition
          const newStatus = condition === 'NOT_WORKING' ? 'UNAVAILABLE' : 'AVAILABLE';

          await tx.inventoryUnit.update({
            where: { id: unitId },
            data: {
              status: newStatus,
              conditionNote: line.note || condition,
            },
          });

          await tx.returnLineUnit.create({
            data: {
              returnLineId: createdReturnLine.id,
              unitId,
            },
          });

          await tx.stockMovement.create({
            data: {
              itemId: item.id,
              unitId,
              quantity: 1,
              type: 'RETURN',
              actorId: req.user!.id,
              reason: `Returned in condition: ${condition}`,
            },
          });
        } else {
          // Bulk return: restore available quantity
          const balance = await tx.stockBalance.findFirst({
            where: { itemId: item.id },
          });

          if (balance) {
            await tx.stockBalance.update({
              where: { id: balance.id },
              data: {
                availableQuantity: { increment: returnQty },
                allocatedQuantity: { decrement: returnQty },
              },
            });

            await tx.stockMovement.create({
              data: {
                itemId: item.id,
                destLocationId: balance.locationId,
                quantity: returnQty,
                type: 'RETURN',
                actorId: req.user!.id,
                reason: `Bulk return of ${item.name}`,
              },
            });
          }
        }
      }

      return returnRecord;
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'RETURN_FAILED', message: err.message } });
  }
});
