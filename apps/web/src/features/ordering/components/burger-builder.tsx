import { money } from "@/features/ordering/formatters";
import {
  burgerModifierQuantity,
  type ModifierQuantityUpdate,
} from "@/features/ordering/modifier-quantities";
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
  onRemoveBurger: (
    localId: string,
  ) => void;
  onSetModifierQuantities: (
    burgerId: string,
    updates: ModifierQuantityUpdate[],
  ) => void;
};

const QUANTITY_VALUES = [
  0, 1, 2, 3, 4, 5,
] as const;

function optionByKey(
  options: ModifierOption[],
  key: string,
) {
  return options.find(
    (option) => option.key === key,
  );
}

function companionExtra(
  option: ModifierOption,
  extraOptions: ModifierOption[],
) {
  if (
    !option.key?.startsWith(
      "included-",
    )
  ) {
    return undefined;
  }

  return optionByKey(
    extraOptions,
    `extra-${option.key.slice(
      "included-".length,
    )}`,
  );
}

function QuantityPicker({
  name,
  value,
  min,
  hint,
  onChange,
}: {
  name: string;
  value: number;
  min: 0 | 1;
  hint: string;
  onChange: (
    quantity: number,
  ) => void;
}) {
  return (
    <div className="ingredient-quantity-row">
      <div className="ingredient-quantity-copy">
        <strong>{name}</strong>
        <small>{hint}</small>
      </div>

      <div
        className="ingredient-quantity-buttons"
        role="group"
        aria-label={`Cantidad de ${name}`}
      >
        {QUANTITY_VALUES.filter(
          (quantity) =>
            quantity >= min,
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
            aria-label={
              quantity === 0
                ? `${name}: sin ingrediente`
                : `${name}: ${quantity} ${quantity === 1 ? "porción" : "porciones"}`
            }
            onClick={() =>
              onChange(quantity)
            }
          >
            {quantity === 0
              ? "Sin"
              : quantity}
          </button>
        ))}
      </div>
    </div>
  );
}

function extraHint(
  option: ModifierOption | undefined,
) {
  if (!option) {
    return "Incluido · hasta 5 porciones";
  }

  return option.priceDeltaCents > 0
    ? `Incluye 1 · adicional +${money.format(
        option.priceDeltaCents /
          100,
      )} c/u`
    : "Incluye 1 · adicionales sin costo";
}

export function BurgerBuilder({
  burgers,
  comboName,
  comboImagePath,
  comboPriceCents,
  removableOptions,
  extraOptions,
  inventory: _inventory,
  maxCombosAvailable,
  onAddBurger,
  onRemoveBurger,
  onSetModifierQuantities,
}: BurgerBuilderProps) {
  const meatExtra = optionByKey(
    extraOptions,
    "extra-meat",
  );

  const pairedExtraIds = new Set(
    removableOptions
      .map((option) =>
        companionExtra(
          option,
          extraOptions,
        ),
      )
      .filter(
        (
          option,
        ): option is ModifierOption =>
          Boolean(option),
      )
      .map((option) => option.id),
  );

  if (meatExtra) {
    pairedExtraIds.add(
      meatExtra.id,
    );
  }

  const standaloneExtras =
    extraOptions.filter(
      (option) =>
        !pairedExtraIds.has(
          option.id,
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
                      Elige hasta 5 porciones
                      por ingrediente. La
                      carne siempre lleva al
                      menos una.
                    </p>

                    <div className="ingredient-quantity-list">
                      {meatExtra && (
                        <QuantityPicker
                          name="Carne"
                          value={
                            1 +
                            burgerModifierQuantity(
                              burger,
                              meatExtra,
                            )
                          }
                          min={1}
                          hint={
                            meatExtra.priceDeltaCents >
                            0
                              ? `Incluye 1 · adicional +${money.format(
                                  meatExtra.priceDeltaCents /
                                    100,
                                )} c/u`
                              : "Incluye 1"
                          }
                          onChange={(
                            quantity,
                          ) =>
                            onSetModifierQuantities(
                              burger.localId,
                              [
                                {
                                  option:
                                    meatExtra,
                                  quantity:
                                    quantity -
                                    1,
                                },
                              ],
                            )
                          }
                        />
                      )}

                      {removableOptions.map(
                        (option) => {
                          const extra =
                            companionExtra(
                              option,
                              extraOptions,
                            );

                          if (extra) {
                            const included =
                              burgerModifierQuantity(
                                burger,
                                option,
                              ) >
                              0;
                            const value =
                              (included
                                ? 1
                                : 0) +
                              burgerModifierQuantity(
                                burger,
                                extra,
                              );

                            return (
                              <QuantityPicker
                                key={
                                  option.id
                                }
                                name={
                                  option.name
                                }
                                value={
                                  value
                                }
                                min={0}
                                hint={extraHint(
                                  extra,
                                )}
                                onChange={(
                                  quantity,
                                ) =>
                                  onSetModifierQuantities(
                                    burger.localId,
                                    [
                                      {
                                        option,
                                        quantity:
                                          quantity >
                                          0
                                            ? 1
                                            : 0,
                                      },
                                      {
                                        option:
                                          extra,
                                        quantity:
                                          Math.max(
                                            0,
                                            quantity -
                                              1,
                                          ),
                                      },
                                    ],
                                  )
                                }
                              />
                            );
                          }

                          return (
                            <QuantityPicker
                              key={
                                option.id
                              }
                              name={
                                option.name
                              }
                              value={burgerModifierQuantity(
                                burger,
                                option,
                              )}
                              min={0}
                              hint={extraHint(
                                undefined,
                              )}
                              onChange={(
                                quantity,
                              ) =>
                                onSetModifierQuantities(
                                  burger.localId,
                                  [
                                    {
                                      option,
                                      quantity,
                                    },
                                  ],
                                )
                              }
                            />
                          );
                        },
                      )}

                      {standaloneExtras.map(
                        (option) => (
                          <QuantityPicker
                            key={
                              option.id
                            }
                            name={
                              option.name
                            }
                            value={burgerModifierQuantity(
                              burger,
                              option,
                            )}
                            min={0}
                            hint={
                              option.priceDeltaCents >
                              0
                                ? `+${money.format(
                                    option.priceDeltaCents /
                                      100,
                                  )} por porción`
                                : "Hasta 5 porciones"
                            }
                            onChange={(
                              quantity,
                            ) =>
                              onSetModifierQuantities(
                                burger.localId,
                                [
                                  {
                                    option,
                                    quantity,
                                  },
                                ],
                              )
                            }
                          />
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  );
}
