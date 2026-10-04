import { money } from "@/features/ordering/formatters";
import { apiUrl } from "@/lib/api/browser";
import { BurgerPreview } from "./burger-preview";
import type {
  BurgerSelection,
  InventoryAvailability,
  ModifierOption,
} from "@/features/ordering/types";

type BurgerBuilderProps = {
  burgers: BurgerSelection[];
  comboName: string;
  comboImagePath?: string | null;
  comboPriceCents: number;
  removableOptions: ModifierOption[];
  extraOptions: ModifierOption[];
  inventory: InventoryAvailability | null;
  maxCombosAvailable: number;
  onAddBurger: () => void;
  onRemoveBurger: (localId: string) => void;
  onToggleRemoved: (
    burgerId: string,
    optionId: string,
  ) => void;
  onToggleExtra: (
    burgerId: string,
    optionId: string,
  ) => void;
  onSetIngredientQuantity: (
    burgerId: string,
    includedOptionId: string | null,
    extraOptionId: string,
    quantity: number,
  ) => void;
};

const QUANTITY_VALUES = [
  0, 1, 2, 3, 4, 5,
] as const;

function selectedExtraQuantity(
  burger: BurgerSelection,
  optionId: string,
) {
  return Math.max(
    burger.extraQuantities?.[optionId] ?? 0,
    burger.extraIds.includes(optionId)
      ? 1
      : 0,
  );
}

function companionExtraKey(
  includedKey: string | undefined,
) {
  if (!includedKey?.startsWith("included-")) {
    return null;
  }

  return (
    "extra-" +
    includedKey.slice(
      "included-".length,
    )
  );
}

function quantityHint(
  priceDeltaCents: number,
) {
  if (priceDeltaCents <= 0) {
    return "Porciones adicionales sin costo";
  }

  return (
    "Porción adicional +" +
    money.format(
      priceDeltaCents / 100,
    )
  );
}

function IngredientQuantity({
  name,
  value,
  min,
  extraPriceCents,
  disabled,
  onChange,
}: {
  name: string;
  value: number;
  min: 0 | 1;
  extraPriceCents: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
}) {
  return (
    <div className="ingredient-quantity-row">
      <div className="ingredient-quantity-copy">
        <strong>{name}</strong>
        <small>
          {quantityHint(
            extraPriceCents,
          )}
        </small>
      </div>

      <div
        className="ingredient-quantity-buttons"
        role="group"
        aria-label={`Cantidad de ${name}`}
      >
        {QUANTITY_VALUES.filter(
          (quantity) => quantity >= min,
        ).map((quantity) => (
          <button
            key={quantity}
            type="button"
            className={
              value === quantity
                ? "ingredient-quantity-button is-selected"
                : "ingredient-quantity-button"
            }
            aria-pressed={
              value === quantity
            }
            disabled={disabled}
            onClick={() =>
              onChange(quantity)
            }
          >
            {quantity}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BurgerBuilder({
  burgers,
  comboName,
  comboImagePath,
  comboPriceCents,
  removableOptions,
  extraOptions,
  inventory,
  maxCombosAvailable,
  onAddBurger,
  onRemoveBurger,
  onToggleRemoved,
  onToggleExtra,
  onSetIngredientQuantity,
}: BurgerBuilderProps) {
  const extraByKey = new Map(
    extraOptions
      .filter((option) => option.key)
      .map((option) => [
        option.key!,
        option,
      ]),
  );

  const meatExtra =
    extraByKey.get("extra-meat");

  const quantityControlledExtraKeys =
    new Set<string>(["extra-meat"]);

  for (const option of removableOptions) {
    const key = companionExtraKey(
      option.key,
    );

    if (key) {
      quantityControlledExtraKeys.add(
        key,
      );
    }
  }

  const standaloneExtras =
    extraOptions.filter(
      (option) =>
        !option.key ||
        !quantityControlledExtraKeys.has(
          option.key,
        ),
    );

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="step">01</p>
          <h2>Tus hamburguesas</h2>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={onAddBurger}
          disabled={
            burgers.length >=
            maxCombosAvailable
          }
        >
          + Agregar combo
        </button>
      </div>

      <div className="burger-list">
        {burgers.map(
          (burger, burgerIndex) => (
            <article
              className="burger-card"
              key={burger.localId}
            >
              <div className="burger-card-title">
                <div className="burger-card-title-main">
                  {comboImagePath && (
                    <img
                      className="burger-card-product-thumb"
                      src={apiUrl(
                        comboImagePath,
                      )}
                      alt={comboName}
                    />
                  )}
                  <div className="burger-card-title-copy">
                    <span>
                      Combo{" "}
                      {burgerIndex + 1}
                    </span>
                    <strong>
                      {money.format(
                        comboPriceCents /
                          100,
                      )}
                    </strong>
                  </div>
                </div>

                {burgers.length > 1 && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      onRemoveBurger(
                        burger.localId,
                      )
                    }
                    aria-label={`Quitar combo ${burgerIndex + 1}`}
                  >
                    Quitar
                  </button>
                )}
              </div>

              <div className="burger-config-layout">
                <BurgerPreview
                  burger={burger}
                  removableOptions={
                    removableOptions
                  }
                  extraOptions={
                    extraOptions
                  }
                  label={`${comboName}, combo ${burgerIndex + 1}`}
                />

                <div className="burger-option-panel">
                  <div className="option-block">
                    <p className="option-title">
                      Cantidad de ingredientes
                    </p>
                    <p className="option-help">
                      Elige de 0 a 5
                      porciones. La carne
                      siempre lleva al menos
                      una.
                    </p>

                    <div className="ingredient-quantity-list">
                      {meatExtra && (
                        <IngredientQuantity
                          name="Carne"
                          value={
                            1 +
                            selectedExtraQuantity(
                              burger,
                              meatExtra.id,
                            )
                          }
                          min={1}
                          extraPriceCents={
                            meatExtra.priceDeltaCents
                          }
                          onChange={(
                            quantity,
                          ) =>
                            onSetIngredientQuantity(
                              burger.localId,
                              null,
                              meatExtra.id,
                              quantity,
                            )
                          }
                        />
                      )}

                      {removableOptions.map(
                        (option) => {
                          const extraKey =
                            companionExtraKey(
                              option.key,
                            );
                          const companion =
                            extraKey
                              ? extraByKey.get(
                                  extraKey,
                                )
                              : undefined;
                          const included =
                            !burger.removedIds.includes(
                              option.id,
                            );
                          const value =
                            Number(
                              included,
                            ) +
                            (companion
                              ? selectedExtraQuantity(
                                  burger,
                                  companion.id,
                                )
                              : 0);
                          const unavailable =
                            inventory
                              ?.modifierLimits[
                              option.id
                            ] === 0 &&
                            value === 0;

                          if (!companion) {
                            return (
                              <div
                                className="ingredient-quantity-row"
                                key={
                                  option.id
                                }
                              >
                                <div className="ingredient-quantity-copy">
                                  <strong>
                                    {
                                      option.name
                                    }
                                  </strong>
                                  <small>
                                    Una porción
                                    incluida
                                  </small>
                                </div>
                                <div
                                  className="ingredient-quantity-buttons"
                                  role="group"
                                  aria-label={`Cantidad de ${option.name}`}
                                >
                                  {[0, 1].map(
                                    (
                                      quantity,
                                    ) => (
                                      <button
                                        key={
                                          quantity
                                        }
                                        type="button"
                                        className={
                                          value ===
                                          quantity
                                            ? "ingredient-quantity-button is-selected"
                                            : "ingredient-quantity-button"
                                        }
                                        aria-pressed={
                                          value ===
                                          quantity
                                        }
                                        disabled={
                                          unavailable &&
                                          quantity >
                                            0
                                        }
                                        onClick={() => {
                                          if (
                                            quantity !==
                                            value
                                          ) {
                                            onToggleRemoved(
                                              burger.localId,
                                              option.id,
                                            );
                                          }
                                        }}
                                      >
                                        {
                                          quantity
                                        }
                                      </button>
                                    ),
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <IngredientQuantity
                              key={
                                option.id
                              }
                              name={
                                option.name
                              }
                              value={value}
                              min={0}
                              extraPriceCents={
                                companion.priceDeltaCents
                              }
                              disabled={
                                unavailable
                              }
                              onChange={(
                                quantity,
                              ) =>
                                onSetIngredientQuantity(
                                  burger.localId,
                                  option.id,
                                  companion.id,
                                  quantity,
                                )
                              }
                            />
                          );
                        },
                      )}
                    </div>
                  </div>

                  {standaloneExtras.length >
                    0 && (
                    <div className="option-block">
                      <p className="option-title">
                        Otros extras
                      </p>
                      <div className="option-grid">
                        {standaloneExtras.map(
                          (option) => {
                            const selected =
                              burger.extraIds.includes(
                                option.id,
                              );
                            const unavailable =
                              inventory
                                ?.modifierLimits[
                                option.id
                              ] === 0 &&
                              !selected;

                            return (
                              <label
                                className="check-row extra-row"
                                key={
                                  option.id
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    selected
                                  }
                                  disabled={
                                    unavailable
                                  }
                                  onChange={() =>
                                    onToggleExtra(
                                      burger.localId,
                                      option.id,
                                    )
                                  }
                                />
                                <span>
                                  {
                                    option.name
                                  }
                                  {unavailable
                                    ? " · Agotado"
                                    : ""}
                                </span>
                                <strong>
                                  +
                                  {money.format(
                                    option.priceDeltaCents /
                                      100,
                                  )}
                                </strong>
                              </label>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  );
}
