import argon2 from 'argon2';
import type { Role } from '@prisma/client';
import { prisma } from '../db.js';

export async function createUser(role: Role = 'STUDENT', collegeId = role === 'ADMIN' ? 'ADMIN001' : '2024BCSE042') {
  return prisma.user.create({
    data: {
      collegeId,
      name: role === 'ADMIN' ? 'Lab Administrator' : 'Test Student',
      role,
      status: 'ACTIVE',
      passwordHash: await argon2.hash('Password@123'),
      mustChangePassword: false,
    },
  });
}

export async function createInventory(options?: { trackingMode?: 'BULK' | 'SERIALIZED'; nature?: 'RETURNABLE' | 'CONSUMABLE'; quantity?: number }) {
  const category = await prisma.category.create({ data: { name: `Electronics-${crypto.randomUUID()}` } });
  const location = await prisma.location.create({ data: { name: `Drawer-${crypto.randomUUID()}`, type: 'DRAWER' } });
  const item = await prisma.item.create({
    data: {
      name: 'Arduino Uno R3',
      categoryId: category.id,
      nature: options?.nature ?? 'RETURNABLE',
      trackingMode: options?.trackingMode ?? 'BULK',
      defaultLocationId: location.id,
      lowStockThreshold: 2,
    },
  });
  if ((options?.trackingMode ?? 'BULK') === 'BULK') {
    await prisma.stockBalance.create({
      data: { itemId: item.id, locationId: location.id, availableQuantity: options?.quantity ?? 5 },
    });
  } else {
    for (let index = 1; index <= (options?.quantity ?? 2); index += 1) {
      await prisma.inventoryUnit.create({
        data: { itemId: item.id, assetCode: `ARD-${index.toString().padStart(3, '0')}`, homeLocationId: location.id, currentLocationId: location.id },
      });
    }
  }
  return { item, category, location };
}
