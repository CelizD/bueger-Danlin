import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
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
        stockQuantity: item.stockQuantity,
        lowStockThreshold: item.lowStockThreshold,
        active: item.active,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        linkedToSales: item._count.usages > 0,
        hasHistory: item._count.allocations > 0,
        deletable:
          item._count.usages === 0 && item._count.allocations === 0,
        lowStock:
          item.active && item.stockQuantity <= item.lowStockThreshold,
        outOfStock: item.active && item.stockQuantity <= 0,
      }));
    });
  }

  async createItem(
    data: {
      name: string;
      unit: string;
      stockQuantity: number;
      lowStockThreshold: number;
      active?: boolean;
    },
    actorUserId: string,
  ) {
    const name = data.name.trim();
    const unit = data.unit.trim();

    if (!name || !unit) {
      throw new BadRequestException("Nombre y unidad son obligatorios.");
    }

    const keyBase = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "item";

    const key = `custom-${keyBase}-${randomBytes(3).toString("hex")}`;

    const created = await this.prisma.inventoryItem.create({
      data: {
        key,
        name,
        unit,
        stockQuantity: data.stockQuantity,
        lowStockThreshold: data.lowStockThreshold,
        active: data.active ?? true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: "INVENTORY_ITEM_CREATED",
        entityType: "InventoryItem",
        entityId: created.id,
        after: {
          key: created.key,
          name: created.name,
          unit: created.unit,
          stockQuantity: created.stockQuantity,
          lowStockThreshold: created.lowStockThreshold,
          active: created.active,
        },
      },
    });

    return {
      ...created,
      linkedToSales: false,
      hasHistory: false,
      deletable: true,
      lowStock:
        created.active &&
        created.stockQuantity <= created.lowStockThreshold,
      outOfStock: created.active && created.stockQuantity <= 0,
    };
  }

  async updateItem(
    id: string,
    data: {
      name?: string;
      unit?: string;
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

      const name = data.name !== undefined ? data.name.trim() : undefined;
      const unit = data.unit !== undefined ? data.unit.trim() : undefined;

      if (data.name !== undefined && !name) {
        throw new BadRequestException("El nombre no puede quedar vacío.");
      }

      if (data.unit !== undefined && !unit) {
        throw new BadRequestException("La unidad no puede quedar vacía.");
      }

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: {
          ...data,
          name,
          unit,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "INVENTORY_ITEM_UPDATED",
          entityType: "InventoryItem",
          entityId: id,
          before: {
            name: before.name,
            unit: before.unit,
            stockQuantity: before.stockQuantity,
            lowStockThreshold: before.lowStockThreshold,
            active: before.active,
          },
          after: {
            name: updated.name,
            unit: updated.unit,
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

  async deleteItem(id: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT "id" FROM "InventoryItem" WHERE "id" = $1 FOR UPDATE`,
        id,
      );

      const item = await tx.inventoryItem.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              usages: true,
              allocations: true,
            },
          },
        },
      });

      if (!item) {
        throw new ConflictException("El artículo de inventario no existe.");
      }

      if (item._count.usages > 0) {
        throw new ConflictException(
          "Este artículo está vinculado a ventas. Desactívalo en lugar de eliminarlo.",
        );
      }

      if (item._count.allocations > 0) {
        throw new ConflictException(
          "Este artículo tiene historial de pedidos y no puede eliminarse.",
        );
      }

      await tx.inventoryItem.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "INVENTORY_ITEM_DELETED",
          entityType: "InventoryItem",
          entityId: id,
          before: {
            key: item.key,
            name: item.name,
            unit: item.unit,
            stockQuantity: item.stockQuantity,
            lowStockThreshold: item.lowStockThreshold,
            active: item.active,
          },
        },
      });

      return {
        id,
        deleted: true,
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
