import { money } from "@/features/ordering/formatters";

type DrinkSelectorProps = {
  quantity: number;
  priceCents: number;
  inventoryLimit: number;
  onChange: (quantity: number) => void;
};

export function DrinkSelector({
  quantity,
  priceCents,
  inventoryLimit,
  onChange,
}: DrinkSelectorProps) {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="step">02</p>
          <h2>Bebida</h2>
        </div>
      </div>

      <div className="drink-row">
        <div>
          <strong>Coca-Cola lata</strong>
          <span>
            {money.format(priceCents / 100)} c/u
            {inventoryLimit <= 0 ? " · Agotada" : ""}
          </span>
        </div>

        <div className="quantity">
          <button
            type="button"
            onClick={() => onChange(Math.max(0, quantity - 1))}
            aria-label="Quitar Coca-Cola"
          >
            −
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            type="button"
            onClick={() =>
              onChange(Math.min(20, inventoryLimit, quantity + 1))
            }
            disabled={quantity >= inventoryLimit}
            aria-label="Agregar Coca-Cola"
          >
            +
          </button>
        </div>
      </div>
    </section>
  );
}
