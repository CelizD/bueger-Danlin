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
    quantities?: string[];
    sauces?: string[];
    others?: string[];
  };
  modifiers: Array<{
    modifierOptionId: string;
    optionName: string;
    priceDeltaCents: number;
    quantity: number;
    removed: boolean;
  }>;
};

const QUANTIFIED_KEYS = new Set([
  "included-cheese",
  "included-bacon",
  "included-lettuce",
  "included-tomato",
  "included-white-onion",
  "extra-meat",
  "extra-cheese",
  "extra-bacon",
  "extra-lettuce",
  "extra-tomato",
  "extra-white-onion",
  "extra-pickles",
]);

const SAUCE_KEYS = [
  ["included-ketchup", "Ketchup"],
  ["included-mustard", "Mostaza"],
  ["extra-mayonnaise", "Mayonesa"],
  ["extra-chipotle", "Chipotle"],
  ["extra-bbq-chipotle", "BBQ con Chipotle"],
] as const;

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
    const optionByKey = new Map<string, any>(
      availableOptions
        .filter(
          (option: any) =>
            typeof option.key === "string",
        )
        .map((option: any) => [
          option.key,
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
        typeof option.key !== "string" ||
        !QUANTIFIED_KEYS.has(option.key)
      ) {
        throw new BadRequestException(
          `${option.name} solo admite selección Sí/No.`,
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

    const extraPortions = (
      option: any | undefined,
    ) => {
      if (!option) return 0;

      return (
        quantityById.get(option.id) ??
        (legacyExtraIdSet.has(option.id)
          ? 1
          : 0)
      );
    };

    const includedPortions = (
      option: any | undefined,
    ) => {
      if (!option) return 0;
      if (removedIdSet.has(option.id)) {
        return 0;
      }

      return quantityById.get(option.id) ?? 1;
    };

    const cheeseIncluded =
      optionByKey.get("included-cheese");
    if (
      product.type === "COMBO" &&
      cheeseIncluded &&
      removedIdSet.has(
        cheeseIncluded.id,
      )
    ) {
      throw new BadRequestException(
        "Queso debe tener mínimo 1 porción.",
      );
    }

    for (const includedOption of removableOptions) {
      if (
        typeof includedOption.key !== "string" ||
        !includedOption.key.startsWith("included-")
      ) {
        continue;
      }

      const ingredient =
        includedOption.key.slice(
          "included-".length,
        );
      const companion =
        extraOptions.find(
          (candidate: any) =>
            candidate.key ===
            `extra-${ingredient}`,
        );

      if (
        companion &&
        !removedIdSet.has(
          includedOption.id,
        ) &&
        (quantityById.get(
          includedOption.id,
        ) ?? 1) > 1
      ) {
        throw new BadRequestException(
          `Las porciones adicionales de ${includedOption.name} deben enviarse como extra.`,
        );
      }
    }

    for (const option of extraOptions) {
      const portions =
        extraPortions(option);

      if (portions <= 0) {
        continue;
      }

      if (option.key === "extra-meat") {
        if (portions > 4) {
          throw new BadRequestException(
            "La hamburguesa puede tener como máximo 5 porciones de carne.",
          );
        }

        continue;
      }

      if (
        typeof option.key === "string" &&
        QUANTIFIED_KEYS.has(option.key) &&
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
          const included =
            includedPortions(
              includedOption,
            );

          if (
            included + portions >
            5
          ) {
            throw new BadRequestException(
              `${includedOption.name} puede tener como máximo 5 porciones.`,
            );
          }

          if (included > 1) {
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
        extraPortions(option);

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
      const pairTotal = (
        includedKey: string,
        extraKey: string,
      ) =>
        includedPortions(
          optionByKey.get(includedKey),
        ) +
        extraPortions(
          optionByKey.get(extraKey),
        );

      preparationSnapshot.quantities = [
        `Carne ×${1 + extraPortions(
          optionByKey.get("extra-meat"),
        )}`,
        `Queso ×${pairTotal(
          "included-cheese",
          "extra-cheese",
        )}`,
        `Tocino ×${pairTotal(
          "included-bacon",
          "extra-bacon",
        )}`,
        `Lechuga ×${pairTotal(
          "included-lettuce",
          "extra-lettuce",
        )}`,
        `Tomate ×${pairTotal(
          "included-tomato",
          "extra-tomato",
        )}`,
        `Cebolla ×${pairTotal(
          "included-white-onion",
          "extra-white-onion",
        )}`,
        `Pepinillos ×${extraPortions(
          optionByKey.get("extra-pickles"),
        )}`,
      ];

      preparationSnapshot.sauces =
        SAUCE_KEYS.flatMap(
          ([key, label]) => {
            const option: any =
              optionByKey.get(key);

            if (!option) return [];

            const isSelected =
              option.kind === "REMOVABLE"
                ? includedPortions(
                    option,
                  ) > 0
                : extraPortions(
                    option,
                  ) > 0;

            return [
              `${label}: ${isSelected ? "Sí" : "No"}`,
            ];
          },
        );

      const summarizedKeys = new Set([
        ...QUANTIFIED_KEYS,
        ...SAUCE_KEYS.map(
          ([key]) => key,
        ),
      ]);
      const others: string[] = [];

      for (const option of removableOptions) {
        if (
          typeof option.key === "string" &&
          summarizedKeys.has(option.key)
        ) {
          continue;
        }

        others.push(
          `${option.name}: ${removedIdSet.has(option.id) ? "No" : "Sí"}`,
        );
      }

      for (const option of extraOptions) {
        if (
          typeof option.key === "string" &&
          summarizedKeys.has(option.key)
        ) {
          continue;
        }

        const portions =
          extraPortions(option);

        if (portions <= 0) continue;

        others.push(
          quantityLabel(
            option.name,
            portions,
          ),
        );
      }

      preparationSnapshot.others =
        others;
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
