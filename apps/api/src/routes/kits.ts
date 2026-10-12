import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireAdmin } from '../middleware/auth.js';

export const kitsRouter = Router();

const kitItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive().max(100_000),
});

const createKitSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  items: z.array(kitItemSchema).min(1).max(200),
});

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
  const parsed = createKitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Kit name and item components are required' } });
    return;
  }

  // Every referenced item must exist — a kit cannot point at phantom stock.
  const itemCount = await prisma.item.count({ where: { id: { in: parsed.data.items.map((i) => i.itemId) } } });
  if (itemCount !== parsed.data.items.length) {
    res.status(400).json({ error: { code: 'INVALID_ITEM', message: 'Every component must be an existing item' } });
    return;
  }

  try {
    const kit = await prisma.$transaction(async (tx) => {
      const created = await tx.kit.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          items: {
            create: parsed.data.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
          },
        },
        include: { items: { include: { item: true } } },
      });
      await tx.auditEvent.create({
        data: { actorId: req.user!.id, action: 'KIT_CREATE', entityType: 'Kit', entityId: created.id },
      });
      return created;
    });

    res.status(201).json(kit);
  } catch {
    res.status(409).json({ error: { code: 'DUPLICATE_KIT', message: 'A kit with this name already exists' } });
  }
});
