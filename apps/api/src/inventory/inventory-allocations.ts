import { ConflictException } from "@nestjs/common";

export type PreparedInventoryItem = {
  productId: string;
  quantity: number;
  modifiers: Array<{
    modifierOptionId: string;
    quantity: number;
    removed: boolean;
  }>;
};

export async function reserveInventoryForOrder(
  tx: any,
  orderId: string,
  preparedItems: PreparedInventoryItem[],
) {
  await releaseExpiredInventoryReservations(tx);

  const productIds = [
    ...new Set(preparedItems.map((item) => item.productId)),
  ];

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

      if (
        usage.modifierOption?.kind === "REMOVABLE"
      ) {
        const removed = item.modifiers.some(
          (modifier) =>
            modifier.modifierOptionId ===
              usage.modifierOptionId &&
            modifier.removed,
        );

        if (!removed) {
          required +=
            item.quantity * usage.quantity;
        }

        continue;
      }

      const selected = item.modifiers
        .filter(
          (modifier) =>
            modifier.modifierOptionId ===
              usage.modifierOptionId &&
            !modifier.removed,
        )
        .reduce(
          (sum, modifier) =>
            sum + modifier.quantity,
          0,
        );

      required += selected * usage.quantity;
    }

    if (required <= 0) continue;

    const current =
      requirements.get(usage.inventoryItemId) ?? {
        quantity: 0,
        name: usage.inventoryItem.name,
      };

    current.quantity += required;
    requirements.set(
      usage.inventoryItemId,
      current,
    );
  }

  const inventoryIds = [
    ...requirements.keys(),
  ].sort();

  for (const inventoryItemId of inventoryIds) {
    await tx.$queryRawUnsafe(
      `SELECT "id" FROM "InventoryItem" WHERE "id" = $1 FOR UPDATE`,
      inventoryItemId,
    );
  }

  for (const inventoryItemId of inventoryIds) {
    const requirement =
      requirements.get(inventoryItemId)!;
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
    const requirement =
      requirements.get(inventoryItemId)!;

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

export async function commitInventoryOrder(
  tx: any,
  orderId: string,
) {
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

export async function releaseInventoryOrder(
  tx: any,
  orderId: string,
) {
  const allocations =
    await tx.inventoryAllocation.findMany({
      where: {
        orderId,
        status: {
          in: ["RESERVED", "COMMITTED"],
        },
      },
      orderBy: {
        inventoryItemId: "asc",
      },
    });

  for (const allocation of allocations) {
    const changed =
      await tx.inventoryAllocation.updateMany({
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
        where: {
          id: allocation.inventoryItemId,
        },
        data: {
          stockQuantity: {
            increment: allocation.quantity,
          },
        },
      });
    }
  }
}

export async function releaseExpiredInventoryReservations(
  tx: any,
) {
  const expired =
    await tx.inventoryAllocation.findMany({
      where: {
        status: "RESERVED",
        order: {
          status: "PENDING_PAYMENT",
          reservationExpiresAt: {
            lte: new Date(),
          },
        },
      },
      orderBy: [
        { inventoryItemId: "asc" },
        { createdAt: "asc" },
      ],
    });

  for (const allocation of expired) {
    const changed =
      await tx.inventoryAllocation.updateMany({
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
        where: {
          id: allocation.inventoryItemId,
        },
        data: {
          stockQuantity: {
            increment: allocation.quantity,
          },
        },
      });
    }
  }
}
