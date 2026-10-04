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
  onRemoveBurger: (localId: string) => void;
  onSetModifierQuantities: (
    burgerId: string,
    updates: ModifierQuantityUpdate[],
  ) => void;
};

const QUANTITY_VALUES = [0, 1, 2, 3, 4, 5] as const;

function optionByKey(
  options: ModifierOption[],
  key: string,
) {
  return options.find(
    (option) => option.key === key,
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
  onChange: (quantity: number) => void;
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
            aria-pressed={value === quantity}
            aria-label={
              quantity === 0
                ? `${name}: sin ingrediente`
                : `${name}: ${quantity} ${quantity === 1 ? "porción" : "porciones"}`
            }
            onClick={() => onChange(quantity)}
          >
            {quantity}
          </button>
        ))}
      </div>
    </div>
  );
}

function BooleanPicker({
  name,
  selected,
  hint,
  onChange,
}: {
  name: string;
  selected: boolean;
  hint?: string;
  onChange: (selected: boolean) => void;
}) {
  return (
    <div className="ingredient-quantity-row">
      <div className="ingredient-quantity-copy">
        <strong>{name}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>

      <div
        className="ingredient-quantity-buttons"
        role="group"
        aria-label={`${name}: Sí o No`}
      >
        <button
          type="button"
          className={
            !selected
              ? "ingredient-quantity-button is-selected"
              : "ingredient-quantity-button"
          }
          aria-pressed={!selected}
          aria-label={`${name}: No`}
          onClick={() => onChange(false)}
        >
          No
        </button>
        <button
          type="button"
          className={
            selected
              ? "ingredient-quantity-button is-selected"
              : "ingredient-quantity-button"
          }
          aria-pressed={selected}
          aria-label={`${name}: Sí`}
          onClick={() => onChange(true)}
        >
          Sí
        </button>
      </div>
    </div>
  );
}

function pairQuantity(
  burger: BurgerSelection,
  included: ModifierOption,
  extra: ModifierOption,
) {
  return (
    (burgerModifierQuantity(
      burger,
      included,
    ) > 0
      ? 1
      : 0) +
    burgerModifierQuantity(
      burger,
      extra,
    )
  );
}

function pairHint(
  extra: ModifierOption,
  minimum: 0 | 1,
) {
  if (extra.priceDeltaCents > 0) {
    return `${minimum === 1 ? "Incluye 1" : "1 incluida"} · adicional +${money.format(
      extra.priceDeltaCents / 100,
    )} c/u`;
  }

  return minimum === 1
    ? "Incluye 1 · adicionales sin costo"
    : "Hasta 5 porciones · sin cargo adicional";
}

function selected(
  burger: BurgerSelection,
  option: ModifierOption,
) {
  return (
    burgerModifierQuantity(
      burger,
      option,
    ) > 0
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
  onSetModifierQuantities,
}: BurgerBuilderProps) {
  const meatExtra = optionByKey(
    extraOptions,
    "extra-meat",
  );

  const cheeseIncluded = optionByKey(
    removableOptions,
    "included-cheese",
  );
  const cheeseExtra = optionByKey(
    extraOptions,
    "extra-cheese",
  );

  const baconIncluded = optionByKey(
    removableOptions,
    "included-bacon",
  );
  const baconExtra = optionByKey(
    extraOptions,
    "extra-bacon",
  );

  const lettuceIncluded = optionByKey(
    removableOptions,
    "included-lettuce",
  );
  const lettuceExtra = optionByKey(
    extraOptions,
    "extra-lettuce",
  );

  const tomatoIncluded = optionByKey(
    removableOptions,
    "included-tomato",
  );
  const tomatoExtra = optionByKey(
    extraOptions,
    "extra-tomato",
  );

  const onionIncluded = optionByKey(
    removableOptions,
    "included-white-onion",
  );
  const onionExtra = optionByKey(
    extraOptions,
    "extra-white-onion",
  );

  const pickles = optionByKey(
    extraOptions,
    "extra-pickles",
  );

  const sauceOptions = [
    {
      name: "Ketchup",
      option: optionByKey(
        removableOptions,
        "included-ketchup",
      ),
    },
    {
      name: "Mostaza",
      option: optionByKey(
        removableOptions,
        "included-mustard",
      ),
    },
    {
      name: "Mayonesa",
      option: optionByKey(
        extraOptions,
        "extra-mayonnaise",
      ),
    },
    {
      name: "Chipotle",
      option: optionByKey(
        extraOptions,
        "extra-chipotle",
      ),
    },
    {
      name: "BBQ con Chipotle",
      option: optionByKey(
        extraOptions,
        "extra-bbq-chipotle",
      ),
    },
  ].filter(
    (
      item,
    ): item is {
      name: string;
      option: ModifierOption;
    } => Boolean(item.option),
  );

  const handledIds = new Set<string>();

  for (const option of [
    meatExtra,
    cheeseIncluded,
    cheeseExtra,
    baconIncluded,
    baconExtra,
    lettuceIncluded,
    lettuceExtra,
    tomatoIncluded,
    tomatoExtra,
    onionIncluded,
    onionExtra,
    pickles,
    ...sauceOptions.map(
      (item) => item.option,
    ),
  ]) {
    if (option) handledIds.add(option.id);
  }

  const otherOptions = [
    ...removableOptions,
    ...extraOptions,
  ].filter(
    (option) => !handledIds.has(option.id),
  );

  function setPair(
    burgerId: string,
    included: ModifierOption,
    extra: ModifierOption,
    quantity: number,
  ) {
    onSetModifierQuantities(
      burgerId,
      [
        {
          option: included,
          quantity:
            quantity > 0 ? 1 : 0,
        },
        {
          option: extra,
          quantity: Math.max(
            0,
            quantity - 1,
          ),
        },
      ],
    );
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="step">01</p>
          <h2>Arma tu hamburguesa</h2>
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
          (burger, burgerIndex) => {
            const burgerPriceCents =
              comboPriceCents +
              extraOptions.reduce(
                (sum, option) =>
                  sum +
                  option.priceDeltaCents *
                    burgerModifierQuantity(
                      burger,
                      option,
                    ),
                0,
              );

            return (
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
                          burgerPriceCents /
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
                        Carne y queso siempre
                        llevan mínimo 1. Los
                        demás pueden quedar en
                        0.
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

                        {cheeseIncluded &&
                          cheeseExtra && (
                            <QuantityPicker
                              name="Queso"
                              value={pairQuantity(
                                burger,
                                cheeseIncluded,
                                cheeseExtra,
                              )}
                              min={1}
                              hint={pairHint(
                                cheeseExtra,
                                1,
                              )}
                              onChange={(
                                quantity,
                              ) =>
                                setPair(
                                  burger.localId,
                                  cheeseIncluded,
                                  cheeseExtra,
                                  quantity,
                                )
                              }
                            />
                          )}

                        {baconIncluded &&
                          baconExtra && (
                            <QuantityPicker
                              name="Tocino"
                              value={pairQuantity(
                                burger,
                                baconIncluded,
                                baconExtra,
                              )}
                              min={0}
                              hint={pairHint(
                                baconExtra,
                                0,
                              )}
                              onChange={(
                                quantity,
                              ) =>
                                setPair(
                                  burger.localId,
                                  baconIncluded,
                                  baconExtra,
                                  quantity,
                                )
                              }
                            />
                          )}

                        {lettuceIncluded &&
                          lettuceExtra && (
                            <QuantityPicker
                              name="Lechuga"
                              value={pairQuantity(
                                burger,
                                lettuceIncluded,
                                lettuceExtra,
                              )}
                              min={0}
                              hint={pairHint(
                                lettuceExtra,
                                0,
                              )}
                              onChange={(
                                quantity,
                              ) =>
                                setPair(
                                  burger.localId,
                                  lettuceIncluded,
                                  lettuceExtra,
                                  quantity,
                                )
                              }
                            />
                          )}

                        {tomatoIncluded &&
                          tomatoExtra && (
                            <QuantityPicker
                              name="Tomate"
                              value={pairQuantity(
                                burger,
                                tomatoIncluded,
                                tomatoExtra,
                              )}
                              min={0}
                              hint={pairHint(
                                tomatoExtra,
                                0,
                              )}
                              onChange={(
                                quantity,
                              ) =>
                                setPair(
                                  burger.localId,
                                  tomatoIncluded,
                                  tomatoExtra,
                                  quantity,
                                )
                              }
                            />
                          )}

                        {onionIncluded &&
                          onionExtra && (
                            <QuantityPicker
                              name="Cebolla"
                              value={pairQuantity(
                                burger,
                                onionIncluded,
                                onionExtra,
                              )}
                              min={0}
                              hint={pairHint(
                                onionExtra,
                                0,
                              )}
                              onChange={(
                                quantity,
                              ) =>
                                setPair(
                                  burger.localId,
                                  onionIncluded,
                                  onionExtra,
                                  quantity,
                                )
                              }
                            />
                          )}

                        {pickles && (
                          <QuantityPicker
                            name="Pepinillos"
                            value={burgerModifierQuantity(
                              burger,
                              pickles,
                            )}
                            min={0}
                            hint="Hasta 5 porciones · sin cargo adicional"
                            onChange={(
                              quantity,
                            ) =>
                              onSetModifierQuantities(
                                burger.localId,
                                [
                                  {
                                    option:
                                      pickles,
                                    quantity,
                                  },
                                ],
                              )
                            }
                          />
                        )}
                      </div>
                    </div>

                    {sauceOptions.length >
                      0 && (
                      <div className="option-block">
                        <p className="option-title">
                          Aderezos
                        </p>
                        <p className="option-help">
                          Se eligen como Sí o
                          No; no usan
                          cantidades.
                        </p>

                        <div className="ingredient-quantity-list">
                          {sauceOptions.map(
                            ({
                              name,
                              option,
                            }) => (
                              <BooleanPicker
                                key={
                                  option.id
                                }
                                name={name}
                                selected={selected(
                                  burger,
                                  option,
                                )}
                                onChange={(
                                  next,
                                ) =>
                                  onSetModifierQuantities(
                                    burger.localId,
                                    [
                                      {
                                        option,
                                        quantity:
                                          next
                                            ? 1
                                            : 0,
                                      },
                                    ],
                                  )
                                }
                              />
                            ),
                          )}
                        </div>
                      </div>
                    )}

                    {otherOptions.length >
                      0 && (
                      <div className="option-block">
                        <p className="option-title">
                          Otros
                        </p>
                        <div className="option-grid">
                          {otherOptions.map(
                            (option) => {
                              const isSelected =
                                selected(
                                  burger,
                                  option,
                                );
                              const unavailable =
                                inventory
                                  ?.modifierLimits[
                                  option.id
                                ] ===
                                  0 &&
                                !isSelected;

                              return (
                                <label
                                  className={
                                    option.kind ===
                                    "EXTRA"
                                      ? "check-row extra-row"
                                      : "check-row"
                                  }
                                  key={
                                    option.id
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      isSelected
                                    }
                                    disabled={
                                      unavailable
                                    }
                                    onChange={() =>
                                      onSetModifierQuantities(
                                        burger.localId,
                                        [
                                          {
                                            option,
                                            quantity:
                                              isSelected
                                                ? 0
                                                : 1,
                                          },
                                        ],
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
                                  {option.kind ===
                                    "EXTRA" &&
                                    option.priceDeltaCents >
                                      0 && (
                                      <strong>
                                        +
                                        {money.format(
                                          option.priceDeltaCents /
                                            100,
                                        )}
                                      </strong>
                                    )}
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
            );
          },
        )}
      </div>
    </section>
  );
}
