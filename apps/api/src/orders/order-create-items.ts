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

function quantityLabel(
  name: string,
  quantity: number,
) {
  return quantity > 1
    ? `${name} ×${quantity}`
    : name;
}

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
    const extraIds =
      item.extraModifierOptionIds ?? [];
    const quantityEntries =
      item.modifierQuantities ?? [];

    if (
      new Set(removedIds).size !==
      removedIds.length
    ) {
      throw new BadRequestException(
        "Hay ingredientes removidos duplicados en un item.",
      );
    }

    if (
      new Set(extraIds).size !==
      extraIds.length
    ) {
      throw new BadRequestException(
        "Hay extras duplicados en un item.",
      );
    }

    if (
      new Set(
        quantityEntries.map(
          (entry) => entry.modifierOptionId,
        ),
      ).size !== quantityEntries.length
    ) {
      throw new BadRequestException(
        "Hay cantidades de ingredientes duplicadas en un item.",
      );
    }

    const availableOptions =
      product.modifierGroups
        .filter(
          (link: any) =>
            link.modifierGroup.active,
        )
        .flatMap(
          (link: any) =>
            link.modifierGroup.options,
        );

    const optionById = new Map(
      availableOptions.map((option: any) => [
        option.id,
        option,
      ]),
    );

    const quantityById = new Map(
      quantityEntries.map((entry) => [
        entry.modifierOptionId,
        entry.quantity,
      ]),
    );

    for (const entry of quantityEntries) {
      const option: any =
        optionById.get(
          entry.modifierOptionId,
        );

      if (
        !option ||
        !["REMOVABLE", "EXTRA"].includes(
          option.kind,
        )
      ) {
        throw new BadRequestException(
          "Una cantidad de ingrediente no pertenece a este producto.",
        );
      }

      if (
        removedIds.includes(option.id) &&
        option.kind === "REMOVABLE"
      ) {
        throw new BadRequestException(
          "Un ingrediente no puede estar removido y tener cantidad al mismo tiempo.",
        );
      }
    }

    const removableOptions =
      availableOptions.filter(
        (option: any) =>
          option.kind === "REMOVABLE",
      );
    const extraOptions =
      availableOptions.filter(
        (option: any) =>
          option.kind === "EXTRA",
      );
    const removedIdSet =
      new Set(removedIds);
    const legacyExtraIdSet =
      new Set(extraIds);

    for (const option of extraOptions) {
      const extraPortions =
        quantityById.get(option.id) ??
        (legacyExtraIdSet.has(option.id)
          ? 1
          : 0);

      if (extraPortions <= 0) {
        continue;
      }

      if (option.key === "extra-meat") {
        if (extraPortions > 4) {
          throw new BadRequestException(
            "La hamburguesa puede tener como máximo 5 porciones de carne.",
          );
        }

        continue;
      }

      if (
        typeof option.key === "string" &&
        option.key.startsWith("extra-")
      ) {
        const ingredient =
          option.key.slice("extra-".length);
        const includedOption =
          removableOptions.find(
            (candidate: any) =>
              candidate.key ===
              `included-${ingredient}`,
          );

        if (includedOption) {
          const includedPortions =
            removedIdSet.has(
              includedOption.id,
            )
              ? 0
              : quantityById.get(
                  includedOption.id,
                ) ?? 1;

          if (
            includedPortions +
              extraPortions >
            5
          ) {
            throw new BadRequestException(
              `${includedOption.name} puede tener como máximo 5 porciones.`,
            );
          }

          if (
            includedPortions > 1
          ) {
            throw new BadRequestException(
              `Las porciones adicionales de ${includedOption.name} deben enviarse como extra.`,
            );
          }
        }
      }
    }

    const preparationSnapshot:
      PreparedOrderItem["preparationSnapshot"] =
      {
        included: [],
        removed: [],
        extras: [],
      };

    const modifiers:
      PreparedOrderItem["modifiers"] = [];

    for (const option of removableOptions) {
      if (removedIdSet.has(option.id)) {
        preparationSnapshot.removed.push(
          option.name,
        );

        modifiers.push({
          modifierOptionId: option.id,
          optionName: option.name,
          priceDeltaCents: 0,
          quantity: item.quantity,
          removed: true,
        });

        continue;
      }

      const portions =
        quantityById.get(option.id) ?? 1;

      preparationSnapshot.included.push(
        quantityLabel(
          option.name,
          portions,
        ),
      );

      if (portions > 1) {
        modifiers.push({
          modifierOptionId: option.id,
          optionName: option.name,
          priceDeltaCents: 0,
          quantity:
            portions * item.quantity,
          removed: false,
        });
      }
    }

    for (const optionId of removedIds) {
      const option: any =
        optionById.get(optionId);

      if (
        !option ||
        option.kind !== "REMOVABLE"
      ) {
        throw new BadRequestException(
          "Uno de los ingredientes a quitar no pertenece a este producto.",
        );
      }
    }

    let extrasCents = 0;

    for (const option of extraOptions) {
      const portions =
        quantityById.get(option.id) ??
        (legacyExtraIdSet.has(option.id)
          ? 1
          : 0);

      if (portions <= 0) {
        continue;
      }

      extrasCents +=
        option.priceDeltaCents *
        portions;

      preparationSnapshot.extras.push(
        quantityLabel(
          option.name,
          portions,
        ),
      );

      modifiers.push({
        modifierOptionId: option.id,
        optionName: option.name,
        priceDeltaCents:
          option.priceDeltaCents,
        quantity:
          portions * item.quantity,
        removed: false,
      });
    }

    for (const optionId of extraIds) {
      const option: any =
        optionById.get(optionId);

      if (
        !option ||
        option.kind !== "EXTRA"
      ) {
        throw new BadRequestException(
          "Uno de los extras no pertenece a este producto.",
        );
      }
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
      unitPriceCents:
        product.priceCents,
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
