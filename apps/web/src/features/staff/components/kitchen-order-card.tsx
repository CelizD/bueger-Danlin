import {
  CheckCircle2,
  ChefHat,
  PackageCheck,
} from "lucide-react";
import { kitchenStatusTitle } from "../kitchen/selectors";
import type {
  KitchenOrder,
  KitchenPreparationSnapshot,
} from "../kitchen/types";

type KitchenItem = KitchenOrder["items"][number];

function preparationFor(
  item: KitchenItem,
): KitchenPreparationSnapshot {
  if (item.preparationSnapshot) {
    return item.preparationSnapshot;
  }

  return {
    included: [],
    removed: item.modifiers
      .filter((modifier) => modifier.removed)
      .map((modifier) => modifier.optionName),
    extras: item.modifiers
      .filter((modifier) => !modifier.removed)
      .map((modifier) =>
        modifier.quantity > 1
          ? `${modifier.optionName} × ${modifier.quantity}`
          : modifier.optionName,
      ),
  };
}

function PreparationGroup({
  title,
  values,
  variant,
  prefix,
}: {
  title: string;
  values: string[];
  variant: "included" | "removed" | "extra";
  prefix: string;
}) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className={`kitchen-prep-group ${variant}`}>
      <span className="kitchen-prep-label">
        {title}
      </span>
      <div className="kitchen-prep-values">
        {values.map((value) => (
          <span key={value}>
            {prefix}
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function KitchenComboPreparation({
  item,
}: {
  item: KitchenItem;
}) {
  const preparation =
    preparationFor(item);
  const hasDetails =
    preparation.included.length > 0 ||
    preparation.removed.length > 0 ||
    preparation.extras.length > 0 ||
    (preparation.quantities?.length ?? 0) > 0 ||
    (preparation.sauces?.length ?? 0) > 0 ||
    (preparation.others?.length ?? 0) > 0;

  if (!hasDetails) {
    return <small>Completa</small>;
  }

  if (preparation.quantities) {
    return (
      <div className="kitchen-preparation">
        <PreparationGroup
          title="Cantidades"
          values={preparation.quantities}
          variant="included"
          prefix=""
        />
        <PreparationGroup
          title="Aderezos"
          values={preparation.sauces ?? []}
          variant="included"
          prefix=""
        />
        <PreparationGroup
          title="Otros"
          values={preparation.others ?? []}
          variant="extra"
          prefix=""
        />
      </div>
    );
  }

  return (
    <div className="kitchen-preparation">
      <PreparationGroup
        title="Incluye"
        values={preparation.included}
        variant="included"
        prefix="✓ "
      />
      <PreparationGroup
        title="NO PONER"
        values={preparation.removed}
        variant="removed"
        prefix="Sin "
      />
      <PreparationGroup
        title="Extras"
        values={preparation.extras}
        variant="extra"
        prefix="+ "
      />
    </div>
  );
}

export function KitchenOrderCard({
  order,
  busy,
  onTransition,
}: {
  order: KitchenOrder;
  busy: boolean;
  onTransition: (
    order: KitchenOrder,
    next: "preparing" | "ready",
  ) => void;
}) {
  return (
    <article className="kitchen-card">
      <div className="kitchen-card-head">
        <div>
          <strong>
            {order.orderCode}
          </strong>
          <span>
            {order.customer.name}
          </span>
        </div>

        <div className="kitchen-combo-count">
          {order.comboQuantity} combo
          {order.comboQuantity === 1
            ? ""
            : "s"}
        </div>
      </div>

      <div className="kitchen-items">
        {order.items.map((item, itemIndex) => {
          const isCombo =
            item.product.type === "COMBO";
          const comboIndex = isCombo
            ? order.items
                .slice(0, itemIndex)
                .filter(
                  (candidate) =>
                    candidate.product.type ===
                    "COMBO",
                ).length + 1
            : null;

          return (
            <div
              className="kitchen-item"
              key={item.id}
            >
              <div className="kitchen-item-name">
                <div className="kitchen-item-title">
                  <strong>
                    {isCombo
                      ? `Hamburguesa ${comboIndex}`
                      : item.productName}
                  </strong>
                  {isCombo && (
                    <small>
                      {item.productName}
                    </small>
                  )}
                </div>
                {item.quantity > 1 && (
                  <span>
                    × {item.quantity}
                  </span>
                )}
              </div>

              {isCombo ? (
                <KitchenComboPreparation
                  item={item}
                />
              ) : item.modifiers.length >
                0 ? (
                <div className="kitchen-modifiers">
                  {item.modifiers.map(
                    (modifier) => (
                      <span
                        key={modifier.id}
                        className={
                          modifier.removed
                            ? "removed"
                            : "extra"
                        }
                      >
                        {modifier.removed
                          ? "Sin "
                          : "+ "}
                        {modifier.optionName}
                        {!modifier.removed &&
                          modifier.quantity > 1
                          ? ` × ${modifier.quantity}`
                          : ""}
                      </span>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="kitchen-card-footer">
        <span>
          {kitchenStatusTitle(
            order.status,
          )}
        </span>

        {(order.status === "PAID" ||
          order.status ===
            "CONFIRMED") && (
          <button
            type="button"
            onClick={() =>
              onTransition(
                order,
                "preparing",
              )
            }
            disabled={busy}
          >
            <ChefHat size={16} />
            {busy
              ? "Actualizando…"
              : "Preparar"}
          </button>
        )}

        {order.status ===
          "PREPARING" && (
          <button
            type="button"
            onClick={() =>
              onTransition(
                order,
                "ready",
              )
            }
            disabled={busy}
          >
            <CheckCircle2
              size={16}
            />
            {busy
              ? "Actualizando…"
              : "Marcar listo"}
          </button>
        )}

        {order.status ===
          "READY" && (
          <span className="kitchen-ready-label">
            <PackageCheck
              size={16}
            />
            Esperando entrega
          </span>
        )}
      </div>
    </article>
  );
}
