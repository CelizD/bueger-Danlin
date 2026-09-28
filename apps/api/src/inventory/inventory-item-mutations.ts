import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { PrismaService } from "../database/prisma.service.js";

export async function createInventoryItem(
  prisma: PrismaService,
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
    throw new BadRequestException(
      "Nombre y unidad son obligatorios.",
    );
  }

  const keyBase =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "item";

  const key =
    `custom-${keyBase}-${randomBytes(3).toString("hex")}`;

  const created =
    await prisma.inventoryItem.create({
      data: {
        key,
        name,
        unit,
        stockQuantity: data.stockQuantity,
        lowStockThreshold:
          data.lowStockThreshold,
        active: data.active ?? true,
      },
    });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "INVENTORY_ITEM_CREATED",
      entityType: "InventoryItem",
      entityId: created.id,
      after: {
        key: created.key,
        name: created.name,
        unit: created.unit,
        stockQuantity:
          created.stockQuantity,
        lowStockThreshold:
          created.lowStockThreshold,
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
      created.stockQuantity <=
        created.lowStockThreshold,
    outOfStock:
      created.active &&
      created.stockQuantity <= 0,
  };
}

export async function updateInventoryItem(
  prisma: PrismaService,
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
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      `SELECT "id" FROM "InventoryItem" WHERE "id" = $1 FOR UPDATE`,
      id,
    );

    const before =
      await tx.inventoryItem.findUnique({
        where: { id },
      });

    if (!before) {
      throw new ConflictException(
        "El artículo de inventario no existe.",
      );
    }

    const name =
      data.name !== undefined
        ? data.name.trim()
        : undefined;
    const unit =
      data.unit !== undefined
        ? data.unit.trim()
        : undefined;

    if (
      data.name !== undefined &&
      !name
    ) {
      throw new BadRequestException(
        "El nombre no puede quedar vacío.",
      );
    }

    if (
      data.unit !== undefined &&
      !unit
    ) {
      throw new BadRequestException(
        "La unidad no puede quedar vacía.",
      );
    }

    const updated =
      await tx.inventoryItem.update({
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
          stockQuantity:
            before.stockQuantity,
          lowStockThreshold:
            before.lowStockThreshold,
          active: before.active,
        },
        after: {
          name: updated.name,
          unit: updated.unit,
          stockQuantity:
            updated.stockQuantity,
          lowStockThreshold:
            updated.lowStockThreshold,
          active: updated.active,
        },
      },
    });

    return {
      ...updated,
      lowStock:
        updated.active &&
        updated.stockQuantity <=
          updated.lowStockThreshold,
      outOfStock:
        updated.active &&
        updated.stockQuantity <= 0,
    };
  });
}

export async function deleteInventoryItem(
  prisma: PrismaService,
  id: string,
  actorUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      `SELECT "id" FROM "InventoryItem" WHERE "id" = $1 FOR UPDATE`,
      id,
    );

    const item =
      await tx.inventoryItem.findUnique({
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
      throw new ConflictException(
        "El artículo de inventario no existe.",
      );
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
          stockQuantity:
            item.stockQuantity,
          lowStockThreshold:
            item.lowStockThreshold,
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
