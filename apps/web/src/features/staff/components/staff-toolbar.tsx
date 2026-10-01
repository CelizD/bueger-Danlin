import { Search } from "lucide-react";
import type {
  StaffRole,
  StaffRoleFilter,
} from "../personal/types";

export function StaffToolbar({
  query,
  roleFilter,
  onQueryChange,
  onRoleChange,
}: {
  query: string;
  roleFilter: StaffRoleFilter;
  onQueryChange: (value: string) => void;
  onRoleChange: (
    value: StaffRoleFilter,
  ) => void;
}) {
  return (
    <section className="staff-toolbar">
      <div className="admin-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) =>
            onQueryChange(
              event.target.value,
            )
          }
          placeholder="Buscar nombre o correo"
        />
      </div>

      <select
        aria-label="Filtrar personal por rol"
        value={roleFilter}
        onChange={(event) =>
          onRoleChange(
            event.target
              .value as "ALL" | StaffRole,
          )
        }
      >
        <option value="ALL">
          Todos los roles
        </option>
        <option value="ADMIN">
          Administradores
        </option>
        <option value="KITCHEN">
          Cocina
        </option>
        <option value="DELIVERY">
          Entrega
        </option>
      </select>
    </section>
  );
}
