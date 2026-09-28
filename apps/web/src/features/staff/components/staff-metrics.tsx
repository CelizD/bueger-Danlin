import {
  Shield,
  ToggleRight,
  Users,
} from "lucide-react";

export function StaffMetrics({
  total,
  active,
  admins,
}: {
  total: number;
  active: number;
  admins: number;
}) {
  return (
    <section className="staff-metrics">
      <article>
        <Users size={19} />
        <span>Cuentas</span>
        <strong>{total}</strong>
      </article>
      <article>
        <ToggleRight size={19} />
        <span>Activas</span>
        <strong>{active}</strong>
      </article>
      <article>
        <Shield size={19} />
        <span>Administradores activos</span>
        <strong>{admins}</strong>
      </article>
    </section>
  );
}
