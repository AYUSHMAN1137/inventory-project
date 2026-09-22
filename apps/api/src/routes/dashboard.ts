import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();

// GET /api/v1/dashboard/stats
dashboardRouter.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const isStudent = req.user!.role === 'STUDENT';

  // Overall system counts
  const totalItemsCount = await prisma.item.count({ where: { isActive: true } });
  const activeProjectsCount = await prisma.project.count({ where: { isActive: true } });

  // Serialized units counts
  const totalUnits = await prisma.inventoryUnit.count();
  const allocatedUnits = await prisma.inventoryUnit.count({ where: { status: 'ALLOCATED' } });
  const availableUnits = await prisma.inventoryUnit.count({ where: { status: 'AVAILABLE' } });
  const unavailableUnits = await prisma.inventoryUnit.count({ where: { status: 'UNAVAILABLE' } });

  // Low stock bulk items
  const bulkItems = await prisma.item.findMany({
    where: { trackingMode: 'BULK', isActive: true, lowStockThreshold: { not: null } },
    include: { balances: true },
  });

  const lowStockItems = bulkItems.filter((item) => {
    const totalAvail = item.balances.reduce((acc, b) => acc + b.availableQuantity, 0);
    return item.lowStockThreshold != null && totalAvail <= item.lowStockThreshold;
  });

  // Pending requests count
  const pendingRequestsCount = await prisma.request.count({
    where: isStudent ? { requesterId: req.user!.id, decisionStatus: 'PENDING' } : { decisionStatus: 'PENDING' },
  });

  // Recent movements
  const recentMovements = await prisma.stockMovement.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      item: { select: { name: true, nature: true, trackingMode: true } },
      actor: { select: { name: true, collegeId: true } },
      unit: { select: { assetCode: true } },
    },
  });

  res.json({
    metrics: {
      totalItemsCount,
      activeProjectsCount,
      totalUnits,
      allocatedUnits,
      availableUnits,
      unavailableUnits,
      lowStockCount: lowStockItems.length,
      pendingRequestsCount,
    },
    lowStockItems: lowStockItems.map((i) => ({
      id: i.id,
      name: i.name,
      threshold: i.lowStockThreshold,
      current: i.balances.reduce((acc, b) => acc + b.availableQuantity, 0),
    })),
    recentMovements,
  });
});
