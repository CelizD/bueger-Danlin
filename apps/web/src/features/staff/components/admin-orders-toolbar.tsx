import { Search } from "lucide-react";

export function AdminOrdersToolbar({
  query,
  status,
  onQueryChange,
  onStatusChange,
}: {
  query: string;
  status: string;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="admin-orders-toolbar">
      <div className="admin-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) =>
            onQueryChange(event.target.value)
          }
          placeholder="Buscar código, cliente, teléfono o punto"
        />
      </div>

      <select
        value={status}
        onChange={(event) =>
          onStatusChange(event.target.value)
        }
        aria-label="Filtrar pedidos por estado"
      >
        <option value="ALL">Todos los estados</option>
        <option value="PAID">Pagados</option>
        <option value="PENDING">Pendientes de pago</option>
        <option value="PREPARING">Preparando</option>
        <option value="READY">Listos</option>
        <option value="DELIVERED">Entregados</option>
        <option value="CANCELLED">Cancelados</option>
        <option value="REFUNDED">Reembolsados</option>
      </select>
    </div>
  );
}
