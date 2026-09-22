import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireAdmin } from '../middleware/auth.js';

export const inventoryRouter = Router();

// GET /api/v1/items - List items with filter/search
inventoryRouter.get('/items', async (req, res: Response) => {
  const { q, categoryId, nature, availableOnly } = req.query;

  const whereClause: any = { isActive: true };

  if (q && typeof q === 'string') {
    whereClause.OR = [
      { name: { contains: q } },
      { model: { contains: q } },
      { description: { contains: q } },
    ];
  }

  if (categoryId && typeof categoryId === 'string') {
    whereClause.categoryId = categoryId;
  }

  if (nature && (nature === 'RETURNABLE' || nature === 'CONSUMABLE')) {
    whereClause.nature = nature;
  }

  const items = await prisma.item.findMany({
    where: whereClause,
    include: {
      category: { select: { id: true, name: true } },
      defaultLocation: { select: { id: true, name: true, type: true } },
      units: { select: { id: true, assetCode: true, status: true, conditionNote: true } },
      balances: { select: { id: true, availableQuantity: true, allocatedQuantity: true, location: { select: { name: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  const formattedItems = items.map((item) => {
    let availableQty = 0;
    let totalQty = 0;

    if (item.trackingMode === 'SERIALIZED') {
      totalQty = item.units.length;
      availableQty = item.units.filter((u) => u.status === 'AVAILABLE').length;
    } else {
      for (const b of item.balances) {
        availableQty += b.availableQuantity;
        totalQty += b.availableQuantity + b.allocatedQuantity;
      }
    }

    return {
      id: item.id,
      name: item.name,
      model: item.model,
      description: item.description,
      nature: item.nature,
      trackingMode: item.trackingMode,
      unitOfMeasure: item.unitOfMeasure,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      defaultLocation: item.defaultLocation?.name ?? 'General Lab Storage',
      lowStockThreshold: item.lowStockThreshold,
      totalQuantity: totalQty,
      availableQuantity: availableQty,
      isLowStock: item.lowStockThreshold != null && availableQty <= item.lowStockThreshold,
      units: item.units,
      balances: item.balances,
    };
  });

  const filtered = availableOnly === 'true'
    ? formattedItems.filter((i) => i.availableQuantity > 0)
    : formattedItems;

  res.json({ data: filtered, meta: { total: filtered.length } });
});

// GET /api/v1/items/:id - Single item details
inventoryRouter.get('/items/:id', async (req, res: Response) => {
  const id = String(req.params.id);
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      category: true,
      defaultLocation: true,
      units: true,
      balances: { include: { location: true } },
    },
  });

  if (!item) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Item not found' } });
    return;
  }

  res.json(item);
});

// POST /api/v1/items - Create item (Admin)
inventoryRouter.post('/items', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { name, model, description, categoryId, nature, trackingMode, unitOfMeasure, lowStockThreshold, defaultLocationId } = req.body;

  if (!name || !categoryId || !nature || !trackingMode) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
    return;
  }

  const item = await prisma.item.create({
    data: {
      name,
      model,
      description,
      categoryId,
      nature,
      trackingMode,
      unitOfMeasure: unitOfMeasure || 'pcs',
      lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : null,
      defaultLocationId,
    },
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      actorId: req.user!.id,
      action: 'ITEM_CREATE',
      entityType: 'Item',
      entityId: item.id,
      metadata: JSON.stringify({ name: item.name }),
    },
  });

  res.status(201).json(item);
});

// GET /api/v1/categories
inventoryRouter.get('/categories', async (_req, res: Response) => {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(categories);
});

// POST /api/v1/categories - Admin create category
inventoryRouter.post('/categories', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Category name is required' } });
    return;
  }
  const category = await prisma.category.create({
    data: { name, description },
  });
  res.status(201).json(category);
});

// GET /api/v1/locations
inventoryRouter.get('/locations', async (_req, res: Response) => {
  const locations = await prisma.location.findMany({
    include: {
      parent: true,
      children: true,
      _count: { select: { balances: true, unitsHome: true } },
    },
    orderBy: { name: 'asc' },
  });
  res.json(locations);
});

// POST /api/v1/locations - Admin create location
inventoryRouter.post('/locations', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { name, type, parentId } = req.body;
  if (!name || !type) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Location name and type are required' } });
    return;
  }
  const location = await prisma.location.create({
    data: { name, type, parentId: parentId || null },
  });
  res.status(201).json(location);
});

// POST /api/v1/stock-receipts - Admin receive new stock (Phase 6)
inventoryRouter.post('/stock-receipts', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { itemId, locationId, quantity, assetCodes, note } = req.body;

  if (!itemId || !locationId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Item ID and Location ID are required' } });
    return;
  }

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Item not found' } });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (item.trackingMode === 'SERIALIZED') {
        const codes: string[] = Array.isArray(assetCodes) ? assetCodes : [];
        if (codes.length === 0) {
          throw new Error('Asset codes are required for serialized item stock receiving');
        }

        for (const code of codes) {
          const unit = await tx.inventoryUnit.create({
            data: {
              itemId: item.id,
              assetCode: code.trim(),
              homeLocationId: locationId,
              currentLocationId: locationId,
              status: 'AVAILABLE',
              conditionNote: note,
            },
          });

          await tx.stockMovement.create({
            data: {
              itemId: item.id,
              unitId: unit.id,
              destLocationId: locationId,
              quantity: 1,
              type: 'RECEIPT',
              actorId: req.user!.id,
              reason: note || 'New stock receipt',
            },
          });
        }
      } else {
        const qty = Number(quantity);
        if (!qty || qty <= 0) {
          throw new Error('Valid positive quantity required for bulk stock receiving');
        }

        const balance = await tx.stockBalance.upsert({
          where: { itemId_locationId: { itemId: item.id, locationId } },
          update: { availableQuantity: { increment: qty } },
          create: {
            itemId: item.id,
            locationId,
            availableQuantity: qty,
            allocatedQuantity: 0,
          },
        });

        await tx.stockMovement.create({
          data: {
            itemId: item.id,
            destLocationId: locationId,
            quantity: qty,
            type: 'RECEIPT',
            actorId: req.user!.id,
            reason: note || 'New bulk stock receipt',
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          actorId: req.user!.id,
          action: 'STOCK_RECEIPT',
          entityType: 'Item',
          entityId: item.id,
          metadata: JSON.stringify({ quantity, assetCodes, locationId }),
        },
      });
    });

    res.status(201).json({ message: 'Stock received successfully' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'RECEIPT_FAILED', message: err.message } });
  }
});

// GET /api/v1/stock-movements - Ledger history
inventoryRouter.get('/stock-movements', requireAuth, async (_req, res: Response) => {
  const movements = await prisma.stockMovement.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      item: { select: { name: true, nature: true, trackingMode: true } },
      actor: { select: { name: true, collegeId: true } },
      unit: { select: { assetCode: true } },
      destLocation: { select: { name: true } },
      sourceLocation: { select: { name: true } },
    },
  });
  res.json({ data: movements });
});

