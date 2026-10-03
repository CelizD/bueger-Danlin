import { BadRequestException } from "@nestjs/common";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

export type PreparedOrderItem = {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  preparationSnapshot: {
    included: string[];
    removed: string[];
    extras: string[];
  };
  modifiers: Array<{
    modifierOptionId: string;
    optionName: string;
    priceDeltaCents: number;
    quantity: number;
    removed: boolean;
  }>;
};

export async function prepareOrderItems(
  tx: any,
  items: CreateOrderDto["items"],
) {
  const productIds = [
    ...new Set(items.map((item) => item.productId)),
  ];

  const products: any[] = await tx.product.findMany({
    where: {
      id: { in: productIds },
      active: true,
    },
    include: {
      modifierGroups: {
        include: {
          modifierGroup: {
            include: {
              options: {
                where: { active: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  const productById = new Map(
    products.map((product) => [
      product.id,
      product,
    ]),
  );

  const preparedItems: PreparedOrderItem[] = [];
  let comboQuantity = 0;
  let totalCents = 0;

  for (const item of items) {
    const product = productById.get(item.productId);

    if (!product) {
      throw new BadRequestException(
        `Producto no disponible: ${item.productId}`,
      );
    }

    if (
      product.type === "COMBO" &&
      item.quantity !== 1
    ) {
      throw new BadRequestException(
        "Cada combo debe enviarse como un item separado para poder personalizar cada hamburguesa.",
      );
    }

    const removedIds =
      item.removedModifierOptionIds ?? [];
    const extraIds = item.extraModifierOptionIds ?? [];

    if (
      new Set(removedIds).size !== removedIds.length
    ) {
      throw new BadRequestException(
        "Hay ingredientes removidos duplicados en un item.",
      );
    }

    if (new Set(extraIds).size !== extraIds.length) {
      throw new BadRequestException(
        "Hay extras duplicados en un item.",
      );
    }

    const availableOptions = product.modifierGroups
      .filter(
        (link: any) => link.modifierGroup.active,
      )
      .flatMap(
        (link: any) => link.modifierGroup.options,
      );

    const optionById = new Map(
      availableOptions.map((option: any) => [
        option.id,
        option,
      ]),
    );
    const removableOptions = availableOptions.filter(
      (option: any) => option.kind === "REMOVABLE",
    );
    const removedIdSet = new Set(removedIds);
    const preparationSnapshot: PreparedOrderItem["preparationSnapshot"] = {
      included: removableOptions
        .filter((option: any) => !removedIdSet.has(option.id))
        .map((option: any) => option.name),
      removed: [],
      extras: [],
    };

    const modifiers: PreparedOrderItem["modifiers"] = [];

    for (const optionId of removedIds) {
      const option: any = optionById.get(optionId);

      if (
        !option ||
        option.kind !== "REMOVABLE"
      ) {
        throw new BadRequestException(
          "Uno de los ingredientes a quitar no pertenece a este producto.",
        );
      }

      preparationSnapshot.removed.push(option.name);

      modifiers.push({
        modifierOptionId: option.id,
        optionName: option.name,
        priceDeltaCents: 0,
        quantity: item.quantity,
        removed: true,
      });
    }

    let extrasCents = 0;

    for (const optionId of extraIds) {
      const option: any = optionById.get(optionId);

      if (!option || option.kind !== "EXTRA") {
        throw new BadRequestException(
          "Uno de los extras no pertenece a este producto.",
        );
      }

      extrasCents += option.priceDeltaCents;
      preparationSnapshot.extras.push(option.name);

      modifiers.push({
        modifierOptionId: option.id,
        optionName: option.name,
        priceDeltaCents: option.priceDeltaCents,
        quantity: item.quantity,
        removed: false,
      });
    }

    if (product.type === "COMBO") {
      comboQuantity += item.quantity;
    }

    const lineTotalCents =
      product.priceCents * item.quantity +
      extrasCents * item.quantity;

    totalCents += lineTotalCents;

    preparedItems.push({
      productId: product.id,
      productName: product.name,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
      lineTotalCents,
      preparationSnapshot,
      modifiers,
    });
  }

  if (comboQuantity < 1) {
    throw new BadRequestException(
      "El pedido debe contener al menos un combo.",
    );
  }

  return {
    preparedItems,
    comboQuantity,
    totalCents,
  };
}
