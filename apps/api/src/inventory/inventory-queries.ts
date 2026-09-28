import type { PrismaService } from "../database/prisma.service.js";
import { releaseExpiredInventoryReservations } from "./inventory-allocations.js";

export async function getPublicInventoryAvailability(
  prisma: PrismaService,
) {
  return prisma.$transaction(async (tx) => {
    await releaseExpiredInventoryReservations(tx);

    const items =
      await tx.inventoryItem.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        include: {
          usages: {
            include: {
              modifierOption: {
                select: {
                  kind: true,
                },
              },
            },
          },
        },
      });

    const productLimits: Record<
      string,
      number
    > = {};
    const modifierLimits: Record<
      string,
      number
    > = {};

    for (const item of items) {
      for (const usage of item.usages) {
        const limit = Math.floor(
          item.stockQuantity /
            usage.quantity,
        );

        if (usage.modifierOptionId) {
          const current =
            modifierLimits[
              usage.modifierOptionId
            ];
          modifierLimits[
            usage.modifierOptionId
          ] =
            current === undefined
              ? limit
              : Math.min(
                  current,
                  limit,
                );
        } else {
          const current =
            productLimits[
              usage.productId
            ];
          productLimits[
            usage.productId
          ] =
            current === undefined
              ? limit
              : Math.min(
                  current,
                  limit,
                );
        }
      }
    }

    return {
      items: items.map((item) => ({
        key: item.key,
        name: item.name,
        unit: item.unit,
        available:
          item.stockQuantity,
        lowStock:
          item.stockQuantity <=
          item.lowStockThreshold,
        outOfStock:
          item.stockQuantity <= 0,
      })),
      productLimits,
      modifierLimits,
    };
  });
}

export async function listAdminInventory(
  prisma: PrismaService,
) {
  return prisma.$transaction(async (tx) => {
    await releaseExpiredInventoryReservations(tx);

    const items =
      await tx.inventoryItem.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          key: true,
          name: true,
          unit: true,
          stockQuantity: true,
          lowStockThreshold: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              usages: true,
              allocations: true,
            },
          },
        },
      });

    return items.map((item) => ({
      id: item.id,
      key: item.key,
      name: item.name,
      unit: item.unit,
      stockQuantity:
        item.stockQuantity,
      lowStockThreshold:
        item.lowStockThreshold,
      active: item.active,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      linkedToSales:
        item._count.usages > 0,
      hasHistory:
        item._count.allocations > 0,
      deletable:
        item._count.usages === 0 &&
        item._count.allocations === 0,
      lowStock:
        item.active &&
        item.stockQuantity <=
          item.lowStockThreshold,
      outOfStock:
        item.active &&
        item.stockQuantity <= 0,
    }));
  });
}
