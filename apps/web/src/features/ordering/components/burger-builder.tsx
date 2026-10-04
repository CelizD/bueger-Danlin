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
  onToggleRemoved: (burgerId: string, optionId: string) => void;
  onToggleExtra: (burgerId: string, optionId: string) => void;
};

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
}: BurgerBuilderProps) {
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
          disabled={burgers.length >= maxCombosAvailable}
        >
          + Agregar combo
        </button>
      </div>

      <div className="burger-list">
        {burgers.map((burger, burgerIndex) => (
          <article className="burger-card" key={burger.localId}>
            <div className="burger-card-title">
              <div className="burger-card-title-main">
                {comboImagePath && (
                  <img
                    className="burger-card-product-thumb"
                    src={apiUrl(comboImagePath)}
                    alt={comboName}
                  />
                )}
                <div className="burger-card-title-copy">
                  <span>Combo {burgerIndex + 1}</span>
                  <strong>{money.format(comboPriceCents / 100)}</strong>
                </div>
              </div>
              {burgers.length > 1 && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => onRemoveBurger(burger.localId)}
                  aria-label={`Quitar combo ${burgerIndex + 1}`}
                >
                  Quitar
                </button>
              )}
            </div>

            <BurgerPreview
              burger={burger}
              removableOptions={removableOptions}
              extraOptions={extraOptions}
              label={`${comboName}, combo ${burgerIndex + 1}`}
            />

            <div className="option-block">
              <p className="option-title">Ingredientes incluidos</p>
              <p className="option-help">Desmarca lo que no quieras.</p>
              <div className="option-grid">
                {removableOptions.map((option) => {
                  const included = !burger.removedIds.includes(option.id);
                  const unavailable =
                    inventory?.modifierLimits[option.id] === 0;

                  return (
                    <label className="check-row" key={option.id}>
                      <input
                        type="checkbox"
                        checked={included}
                        disabled={unavailable}
                        onChange={() =>
                          onToggleRemoved(burger.localId, option.id)
                        }
                      />
                      <span>
                        {option.name}
                        {unavailable ? " · Agotado" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="option-block">
              <p className="option-title">Extras</p>
              <div className="option-grid">
                {extraOptions.map((option) => {
                  const selected = burger.extraIds.includes(option.id);
                  const unavailable =
                    inventory?.modifierLimits[option.id] === 0 && !selected;

                  return (
                    <label className="check-row extra-row" key={option.id}>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={unavailable}
                        onChange={() =>
                          onToggleExtra(burger.localId, option.id)
                        }
                      />
                      <span>
                        {option.name}
                        {unavailable ? " · Agotado" : ""}
                      </span>
                      <strong>
                        +{money.format(option.priceDeltaCents / 100)}
                      </strong>
                    </label>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
