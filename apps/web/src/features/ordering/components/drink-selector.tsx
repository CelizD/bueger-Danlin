import { money } from "@/features/ordering/formatters";
import { apiUrl } from "@/lib/api/browser";

type DrinkSelectorProps = {
  name: string;
  imagePath?: string | null;
  quantity: number;
  priceCents: number;
  inventoryLimit: number;
  onChange: (quantity: number) => void;
};

export function DrinkSelector({
  name,
  imagePath,
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
        {imagePath && (
          <img
            className="catalog-product-image catalog-product-image-drink"
            src={apiUrl(imagePath)}
            alt={name}
          />
        )}
        <div>
          <strong>{name}</strong>
          <span>
            {money.format(priceCents / 100)} c/u
            {inventoryLimit <= 0 ? " · Agotada" : ""}
          </span>
        </div>

        <div className="quantity">
          <button
            type="button"
            onClick={() => onChange(Math.max(0, quantity - 1))}
            aria-label={`Quitar ${name}`}
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
            aria-label={`Agregar ${name}`}
          >
            +
          </button>
        </div>
      </div>
    </section>
  );
}
