import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireAdmin } from '../middleware/auth.js';

export const issuesRouter = Router();

// POST /api/v1/issues - Physical handover of approved components
issuesRouter.post('/', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { requestId, collectorCollegeId, expectedReturnDate, note, lines } = req.body;

  if (!requestId || !collectorCollegeId || !Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request ID, collector ID, and issue lines are required' } });
    return;
  }

  const collector = await prisma.user.findUnique({
    where: { collegeId: String(collectorCollegeId).trim() },
  });

  if (!collector) {
    res.status(400).json({ error: { code: 'COLLECTOR_NOT_FOUND', message: 'No student found with given college ID' } });
    return;
  }

  const targetRequest = await prisma.request.findUnique({
    where: { id: requestId },
    include: { lines: { include: { item: true } } },
  });

  if (!targetRequest) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Issue record
      const issue = await tx.issue.create({
        data: {
          requestId,
          studentId: collector.id,
          projectId: targetRequest.projectId,
          issuedById: req.user!.id,
          expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
          note,
        },
      });

      // 2. Process each line atomically
      for (const line of lines) {
        const reqLine = targetRequest.lines.find((l) => l.id === line.requestLineId);
        if (!reqLine) continue;

        const quantity = Number(line.quantity);
        const item = reqLine.item;

        const createdIssueLine = await tx.issueLine.create({
          data: {
            issueId: issue.id,
            requestLineId: reqLine.id,
            quantity,
          },
        });

        // Update issuedQty on requestLine
        await tx.requestLine.update({
          where: { id: reqLine.id },
          data: { issuedQty: { increment: quantity } },
        });

        if (item.trackingMode === 'SERIALIZED') {
          let unitIds: string[] = line.unitIds || [];
          if (unitIds.length === 0) {
            const availableUnits = await tx.inventoryUnit.findMany({
              where: { itemId: item.id, status: 'AVAILABLE' },
              take: quantity,
            });
            if (availableUnits.length < quantity) {
              throw new Error(`Insufficient available units for ${item.name}: needed ${quantity}, found ${availableUnits.length}`);
            }
            unitIds = availableUnits.map((u) => u.id);
          } else if (unitIds.length !== quantity) {
            throw new Error(`Item ${item.name} is serialized: expected ${quantity} unit IDs, received ${unitIds.length}`);
          }

          for (const uId of unitIds) {
            const unit = await tx.inventoryUnit.findUnique({ where: { id: uId } });
            if (!unit || unit.status !== 'AVAILABLE') {
              throw new Error(`Unit ${uId} is not available for issue`);
            }

            await tx.inventoryUnit.update({
              where: { id: uId },
              data: { status: 'ALLOCATED' },
            });

            await tx.issueLineUnit.create({
              data: {
                issueLineId: createdIssueLine.id,
                unitId: uId,
              },
            });

            // Stock movement
            await tx.stockMovement.create({
              data: {
                itemId: item.id,
                unitId: uId,
                quantity: 1,
                type: 'ISSUE',
                actorId: req.user!.id,
                reason: `Issued for Request #${targetRequest.id.substring(0, 8)}`,
              },
            });
          }
        } else {
          // Bulk stock decrement
          const balance = await tx.stockBalance.findFirst({
            where: { itemId: item.id },
          });

          if (!balance || balance.availableQuantity < quantity) {
            throw new Error(`Insufficient bulk stock for item ${item.name}`);
          }

          await tx.stockBalance.update({
            where: { id: balance.id },
            data: {
              availableQuantity: { decrement: quantity },
              allocatedQuantity: { increment: item.nature === 'RETURNABLE' ? quantity : 0 },
            },
          });

          await tx.stockMovement.create({
            data: {
              itemId: item.id,
              sourceLocationId: balance.locationId,
              quantity,
              type: 'ISSUE',
              actorId: req.user!.id,
              reason: `Bulk issue for Request #${targetRequest.id.substring(0, 8)}`,
            },
          });
        }
      }

      // Update fulfilment status
      const updatedLines = await tx.requestLine.findMany({ where: { requestId } });
      const allFulfilled = updatedLines.every((l) => l.issuedQty >= l.approvedQty && l.approvedQty > 0);
      const someIssued = updatedLines.some((l) => l.issuedQty > 0);

      await tx.request.update({
        where: { id: requestId },
        data: {
          fulfilmentStatus: allFulfilled ? 'FULFILLED' : someIssued ? 'PARTIALLY_ISSUED' : 'NOT_ISSUED',
        },
      });

      return issue;
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'ISSUE_FAILED', message: err.message } });
  }
});

// GET /api/v1/allocations - Current active allocations
issuesRouter.get('/allocations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const isStudent = req.user!.role === 'STUDENT';

  const whereClause: any = {};
  if (isStudent) {
    whereClause.OR = [
      { studentId: req.user!.id },
      { project: { members: { some: { userId: req.user!.id } } } },
    ];
  }

  const issues = await prisma.issue.findMany({
    where: whereClause,
    include: {
      student: { select: { id: true, name: true, collegeId: true } },
      project: { select: { id: true, name: true } },
      lines: {
        include: {
          requestLine: { include: { item: true } },
          units: { include: { unit: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter for active outstanding returnables
  const outstanding = issues.map((iss) => {
    const activeLines = iss.lines.filter((l) => {
      const isReturnable = l.requestLine?.item.nature === 'RETURNABLE';
      return isReturnable && l.quantity > l.returnedQty;
    });

    return {
      ...iss,
      outstandingLines: activeLines,
      isFullyReturned: activeLines.length === 0,
    };
  });

  res.json({ data: outstanding });
});
