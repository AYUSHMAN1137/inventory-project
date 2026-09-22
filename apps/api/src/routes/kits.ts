import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireAdmin } from '../middleware/auth.js';

export const kitsRouter = Router();

// GET /api/v1/kits - List all active kits
kitsRouter.get('/', async (_req, res: Response) => {
  const kits = await prisma.kit.findMany({
    where: { isActive: true },
    include: {
      items: {
        include: {
          item: {
            select: {
              id: true,
              name: true,
              model: true,
              nature: true,
              trackingMode: true,
              unitOfMeasure: true,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json({ data: kits });
});

// POST /api/v1/kits - Create kit template (Admin)
kitsRouter.post('/', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, items } = req.body;

  if (!name || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Kit name and item components are required' } });
    return;
  }

  const kit = await prisma.kit.create({
    data: {
      name,
      description,
      items: {
        create: items.map((i: any) => ({
          itemId: i.itemId,
          quantity: Number(i.quantity) || 1,
        })),
      },
    },
    include: { items: { include: { item: true } } },
  });

  res.status(201).json(kit);
});
