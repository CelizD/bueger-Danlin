import { Search } from "lucide-react";

export function DeliverySearchCard({
  query,
  readyCount,
  onChange,
}: {
  query: string;
  readyCount: number;
  onChange: (value: string) => void;
}) {
  return (
    <section className="delivery-search-card">
      <div className="delivery-search-input">
        <Search size={21} />
        <input
          value={query}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          placeholder="Código H-..., nombre o teléfono"
        />
      </div>

      <div className="delivery-search-count">
        <strong>{readyCount}</strong>
        <span>
          listos para entregar
        </span>
      </div>
    </section>
  );
}
