import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { type AuthenticatedRequest, requireAdmin, requireAuth } from '../middleware/auth.js';

export const inventoryRouter = Router();

const itemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  model: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  categoryId: z.string().uuid(),
  nature: z.enum(['RETURNABLE', 'CONSUMABLE']),
  trackingMode: z.enum(['SERIALIZED', 'BULK']),
  unitOfMeasure: z.string().trim().min(1).max(30).default('pcs'),
  lowStockThreshold: z.number().int().min(0).max(999999).optional().nullable(),
  defaultLocationId: z.string().uuid().optional().nullable(),
});
const categorySchema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).optional() });
const locationSchema = z.object({ name: z.string().trim().min(2).max(100), type: z.enum(['LAB', 'ROOM', 'CABINET', 'SHELF', 'DRAWER', 'BIN']), parentId: z.string().uuid().optional().nullable() });
const receiptSchema = z.object({
  itemId: z.string().min(1),
  locationId: z.string().uuid(),
  quantity: z.number().int().positive().max(999999).optional(),
  assetCodes: z.array(z.string().trim().min(2).max(80)).max(500).optional(),
  note: z.string().trim().max(500).optional(),
  referenceNumber: z.string().trim().max(100).optional(),
  clientCommandId: z.string().trim().min(8).max(100),
});

inventoryRouter.get('/items', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
  const nature = req.query.nature === 'RETURNABLE' || req.query.nature === 'CONSUMABLE' ? req.query.nature : undefined;
  const items = await prisma.item.findMany({
    where: { isActive: true, ...(q ? { OR: [{ name: { contains: q } }, { model: { contains: q } }, { description: { contains: q } }] } : {}), ...(categoryId ? { categoryId } : {}), ...(nature ? { nature } : {}) },
    include: {
      category: { select: { id: true, name: true } },
      defaultLocation: { select: { id: true, name: true, type: true } },
      units: { select: { id: true, assetCode: true, status: true, conditionNote: true } },
      balances: { select: { id: true, availableQuantity: true, allocatedQuantity: true, location: { select: { id: true, name: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  const data = items.map((item) => {
    const availableQuantity = item.trackingMode === 'SERIALIZED' ? item.units.filter((unit) => unit.status === 'AVAILABLE').length : item.balances.reduce((sum, balance) => sum + balance.availableQuantity, 0);
    const totalQuantity = item.trackingMode === 'SERIALIZED' ? item.units.length : item.balances.reduce((sum, balance) => sum + balance.availableQuantity + balance.allocatedQuantity, 0);
    return { ...item, categoryName: item.category.name, defaultLocation: item.defaultLocation?.name ?? 'Location not assigned', availableQuantity, totalQuantity, isLowStock: item.lowStockThreshold != null && availableQuantity <= item.lowStockThreshold };
  });
  const filtered = req.query.availableOnly === 'true' ? data.filter((item) => item.availableQuantity > 0) : data;
  res.json({ data: filtered, meta: { total: filtered.length } });
});

inventoryRouter.get('/items/:id', requireAuth, async (req, res: Response) => {
  const item = await prisma.item.findUnique({ where: { id: String(req.params.id) }, include: { category: true, defaultLocation: true, units: true, balances: { include: { location: true } } } });
  if (!item || !item.isActive) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }); return; }
  res.json(item);
});

inventoryRouter.post('/items', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid item' } }); return; }
  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.item.create({ data: parsed.data });
      await tx.auditEvent.create({ data: { actorId: req.user!.id, action: 'ITEM_CREATE', entityType: 'Item', entityId: created.id, metadata: JSON.stringify({ name: created.name }) } });
      return created;
    });
    res.status(201).json(item);
  } catch { res.status(400).json({ error: { code: 'ITEM_CREATE_FAILED', message: 'Check category and location values' } }); }
});

inventoryRouter.get('/categories', requireAuth, async (_req, res: Response) => {
  res.json(await prisma.category.findMany({ include: { _count: { select: { items: true } } }, orderBy: { name: 'asc' } }));
});
inventoryRouter.post('/categories', requireAuth, requireAdmin, async (req, res: Response) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid category' } }); return; }
  try { res.status(201).json(await prisma.category.create({ data: parsed.data })); } catch { res.status(409).json({ error: { code: 'DUPLICATE_CATEGORY', message: 'Category already exists' } }); }
});

inventoryRouter.get('/locations', requireAuth, async (_req, res: Response) => {
  res.json(await prisma.location.findMany({ where: { isActive: true }, include: { parent: true, children: true, _count: { select: { balances: true, unitsHome: true } } }, orderBy: { name: 'asc' } }));
});
inventoryRouter.post('/locations', requireAuth, requireAdmin, async (req, res: Response) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid location' } }); return; }
  if (parsed.data.parentId && !await prisma.location.findUnique({ where: { id: parsed.data.parentId } })) { res.status(400).json({ error: { code: 'INVALID_PARENT', message: 'Parent location does not exist' } }); return; }
  try { res.status(201).json(await prisma.location.create({ data: parsed.data })); } catch { res.status(409).json({ error: { code: 'DUPLICATE_LOCATION', message: 'Location already exists under this parent' } }); }
});

inventoryRouter.post('/stock-receipts', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = receiptSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid stock receipt' } }); return; }
  const input = parsed.data;
  const replay = await prisma.stockReceipt.findUnique({ where: { clientCommandId: input.clientCommandId } });
  if (replay) { res.status(200).json(replay); return; }
  const [item, location] = await Promise.all([prisma.item.findUnique({ where: { id: input.itemId } }), prisma.location.findUnique({ where: { id: input.locationId } })]);
  if (!item || !item.isActive || !location || !location.isActive) { res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'Active item and location are required' } }); return; }
  const codes = input.assetCodes?.map((code) => code.toUpperCase()) ?? [];
  if (item.trackingMode === 'SERIALIZED' && (codes.length === 0 || new Set(codes).size !== codes.length)) { res.status(400).json({ error: { code: 'INVALID_ASSET_CODES', message: 'Unique asset codes are required for serialized stock' } }); return; }
  if (item.trackingMode === 'BULK' && !input.quantity) { res.status(400).json({ error: { code: 'INVALID_QUANTITY', message: 'A positive quantity is required for bulk stock' } }); return; }
  try {
    const receipt = await prisma.$transaction(async (tx) => {
      const created = await tx.stockReceipt.create({ data: { referenceNumber: input.referenceNumber, note: input.note, clientCommandId: input.clientCommandId } });
      if (item.trackingMode === 'SERIALIZED') {
        for (const code of codes) {
          const unit = await tx.inventoryUnit.create({ data: { itemId: item.id, assetCode: code, homeLocationId: location.id, currentLocationId: location.id } });
          await tx.stockMovement.create({ data: { itemId: item.id, unitId: unit.id, destLocationId: location.id, quantity: 1, type: 'RECEIPT', actorId: req.user!.id, reason: input.note || `Receipt ${created.id}` } });
        }
      } else {
        await tx.stockBalance.upsert({ where: { itemId_locationId: { itemId: item.id, locationId: location.id } }, update: { availableQuantity: { increment: input.quantity! } }, create: { itemId: item.id, locationId: location.id, availableQuantity: input.quantity! } });
        await tx.stockMovement.create({ data: { itemId: item.id, destLocationId: location.id, quantity: input.quantity!, type: 'RECEIPT', actorId: req.user!.id, reason: input.note || `Receipt ${created.id}` } });
      }
      await tx.auditEvent.create({ data: { actorId: req.user!.id, action: 'STOCK_RECEIPT', entityType: 'StockReceipt', entityId: created.id, metadata: JSON.stringify({ itemId: item.id, locationId: location.id, quantity: input.quantity ?? codes.length }) } });
      return created;
    });
    res.status(201).json(receipt);
  } catch { res.status(409).json({ error: { code: 'RECEIPT_FAILED', message: 'Receipt could not be recorded; verify asset codes and retry' } }); }
});

inventoryRouter.get('/stock-movements', requireAuth, requireAdmin, async (req, res: Response) => {
  const take = Math.min(Number(req.query.limit) || 50, 200);
  const movements = await prisma.stockMovement.findMany({ take, orderBy: { createdAt: 'desc' }, include: { item: { select: { name: true, nature: true, trackingMode: true } }, actor: { select: { name: true, collegeId: true } }, unit: { select: { assetCode: true } }, destLocation: { select: { name: true } }, sourceLocation: { select: { name: true } } } });
  res.json({ data: movements });
});
