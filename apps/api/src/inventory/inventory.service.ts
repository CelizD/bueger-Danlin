import {
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

type PreparedInventoryItem = {
  productId: string;
  quantity: number;
  modifiers: Array<{
    modifierOptionId: string;
    quantity: number;
    removed: boolean;
  }>;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async publicAvailability() {
    return this.prisma.$transaction(async (tx) => {
      await this.releaseExpiredReservations(tx);

      const items = await tx.inventoryItem.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        include: {
          usages: {
            include: {
              modifierOption: {
                select: { kind: true },
              },
            },
          },
        },
      });

      const productLimits: Record<string, number> = {};
      const modifierLimits: Record<string, number> = {};

      for (const item of items) {
        for (const usage of item.usages) {
          const limit = Math.floor(item.stockQuantity / usage.quantity);

          if (usage.modifierOptionId) {
            const current = modifierLimits[usage.modifierOptionId];
            modifierLimits[usage.modifierOptionId] =
              current === undefined ? limit : Math.min(current, limit);
          } else {
            const current = productLimits[usage.productId];
            productLimits[usage.productId] =
              current === undefined ? limit : Math.min(current, limit);
          }
        }
      }

      return {
        items: items.map((item) => ({
          key: item.key,
          name: item.name,
          unit: item.unit,
          available: item.stockQuantity,
          lowStock: item.stockQuantity <= item.lowStockThreshold,
          outOfStock: item.stockQuantity <= 0,
        })),
        productLimits,
        modifierLimits,
      };
    });
  }

  async adminList() {
    return this.prisma.$transaction(async (tx) => {
      await this.releaseExpiredReservations(tx);

      const items = await tx.inventoryItem.findMany({
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
        },
      });

      return items.map((item) => ({
        ...item,
        lowStock:
          item.active && item.stockQuantity <= item.lowStockThreshold,
        outOfStock: item.active && item.stockQuantity <= 0,
      }));
    });
  }

  async updateItem(
    id: string,
    data: {
      stockQuantity?: number;
      lowStockThreshold?: number;
      active?: boolean;
    },
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT "id" FROM "InventoryItem" WHERE "id" = $1 FOR UPDATE`,
        id,
      );

      const before = await tx.inventoryItem.findUnique({
        where: { id },
      });

      if (!before) {
        throw new ConflictException("El artículo de inventario no existe.");
      }

      const updated = await tx.inventoryItem.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "INVENTORY_ITEM_UPDATED",
          entityType: "InventoryItem",
          entityId: id,
          before: {
            stockQuantity: before.stockQuantity,
            lowStockThreshold: before.lowStockThreshold,
            active: before.active,
          },
          after: {
            stockQuantity: updated.stockQuantity,
            lowStockThreshold: updated.lowStockThreshold,
            active: updated.active,
          },
        },
      });

      return {
        ...updated,
        lowStock:
          updated.active &&
          updated.stockQuantity <= updated.lowStockThreshold,
        outOfStock: updated.active && updated.stockQuantity <= 0,
      };
    });
  }

  async reserveForOrder(
    tx: any,
    orderId: string,
    preparedItems: PreparedInventoryItem[],
  ) {
    await this.releaseExpiredReservations(tx);

    const productIds = [...new Set(preparedItems.map((item) => item.productId))];

    const usages = await tx.inventoryUsage.findMany({
      where: {
        productId: { in: productIds },
        inventoryItem: { active: true },
      },
      include: {
        inventoryItem: true,
        modifierOption: {
          select: {
            kind: true,
          },
        },
      },
    });

    const requirements = new Map<
      string,
      { quantity: number; name: string }
    >();

    for (const usage of usages) {
      let required = 0;

      for (const item of preparedItems) {
        if (item.productId !== usage.productId) continue;

        if (!usage.modifierOptionId) {
          required += item.quantity * usage.quantity;
          continue;
        }

        if (usage.modifierOption?.kind === "REMOVABLE") {
          const removed = item.modifiers.some(
            (modifier) =>
              modifier.modifierOptionId === usage.modifierOptionId &&
              modifier.removed,
          );

          if (!removed) {
            required += item.quantity * usage.quantity;
          }

          continue;
        }

        const selected = item.modifiers
          .filter(
            (modifier) =>
              modifier.modifierOptionId === usage.modifierOptionId &&
              !modifier.removed,
          )
          .reduce((sum, modifier) => sum + modifier.quantity, 0);

        required += selected * usage.quantity;
      }

      if (required <= 0) continue;

      const current = requirements.get(usage.inventoryItemId) ?? {
        quantity: 0,
        name: usage.inventoryItem.name,
      };

      current.quantity += required;
      requirements.set(usage.inventoryItemId, current);
    }

    const inventoryIds = [...requirements.keys()].sort();

    for (const inventoryItemId of inventoryIds) {
      await tx.$queryRawUnsafe(
        `SELECT "id" FROM "InventoryItem" WHERE "id" = $1 FOR UPDATE`,
        inventoryItemId,
      );
    }

    for (const inventoryItemId of inventoryIds) {
      const requirement = requirements.get(inventoryItemId)!;
      const item = await tx.inventoryItem.findUnique({
        where: { id: inventoryItemId },
      });

      if (!item?.active) continue;

      if (item.stockQuantity < requirement.quantity) {
        throw new ConflictException(
          item.stockQuantity <= 0
            ? `${requirement.name} está agotado.`
            : `Solo quedan ${item.stockQuantity} unidad(es) de ${requirement.name}.`,
        );
      }
    }

    for (const inventoryItemId of inventoryIds) {
      const requirement = requirements.get(inventoryItemId)!;

      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: {
          stockQuantity: {
            decrement: requirement.quantity,
          },
        },
      });

      await tx.inventoryAllocation.create({
        data: {
          orderId,
          inventoryItemId,
          quantity: requirement.quantity,
          status: "RESERVED",
        },
      });
    }
  }

  async commitOrder(tx: any, orderId: string) {
    await tx.inventoryAllocation.updateMany({
      where: {
        orderId,
        status: "RESERVED",
      },
      data: {
        status: "COMMITTED",
      },
    });
  }

  async releaseOrder(tx: any, orderId: string) {
    const allocations = await tx.inventoryAllocation.findMany({
      where: {
        orderId,
        status: { in: ["RESERVED", "COMMITTED"] },
      },
      orderBy: { inventoryItemId: "asc" },
    });

    for (const allocation of allocations) {
      const changed = await tx.inventoryAllocation.updateMany({
        where: {
          id: allocation.id,
          status: allocation.status,
        },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
        },
      });

      if (changed.count === 1) {
        await tx.inventoryItem.update({
          where: { id: allocation.inventoryItemId },
          data: {
            stockQuantity: {
              increment: allocation.quantity,
            },
          },
        });
      }
    }
  }

  async releaseExpiredReservations(tx: any) {
    const expired = await tx.inventoryAllocation.findMany({
      where: {
        status: "RESERVED",
        order: {
          status: "PENDING_PAYMENT",
          reservationExpiresAt: {
            lte: new Date(),
          },
        },
      },
      orderBy: [{ inventoryItemId: "asc" }, { createdAt: "asc" }],
    });

    for (const allocation of expired) {
      const changed = await tx.inventoryAllocation.updateMany({
        where: {
          id: allocation.id,
          status: "RESERVED",
        },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
        },
      });

      if (changed.count === 1) {
        await tx.inventoryItem.update({
          where: { id: allocation.inventoryItemId },
          data: {
            stockQuantity: {
              increment: allocation.quantity,
            },
          },
        });
      }
    }
  }
}
