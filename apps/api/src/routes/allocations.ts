import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

export const allocationsRouter = Router();

// GET /api/v1/allocations - Current active allocations
allocationsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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
