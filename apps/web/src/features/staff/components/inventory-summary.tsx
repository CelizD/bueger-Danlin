import {
  AlertTriangle,
  Boxes,
  PackageCheck,
} from "lucide-react";

export function InventorySummary({
  total,
  low,
  out,
}: {
  total: number;
  low: number;
  out: number;
}) {
  return (
    <section className="inventory-summary">
      <article>
        <PackageCheck size={19} />
        <span>Artículos activos</span>
        <strong>{total}</strong>
      </article>
      <article>
        <AlertTriangle size={19} />
        <span>Stock bajo</span>
        <strong>{low}</strong>
      </article>
      <article>
        <Boxes size={19} />
        <span>Agotados</span>
        <strong>{out}</strong>
      </article>
    </section>
  );
}
