import {
  CircleDollarSign,
  CupSoda,
  Package,
  RotateCcw,
  Ticket,
  UserX,
  XCircle,
} from "lucide-react";
import { dashboardMoney } from "../dashboard/formatters";
import type { DashboardData } from "../dashboard/types";

export function AdminDashboardMetrics({
  metrics,
}: {
  metrics: DashboardData["metrics"];
}) {
  return (
    <>
      <section className="dashboard-primary-metrics">
        <article className="dashboard-metric revenue">
          <div className="dashboard-metric-icon">
            <CircleDollarSign
              size={21}
            />
          </div>
          <span>Ingresos</span>
          <strong>
            {dashboardMoney.format(
              metrics.revenueCents /
                100,
            )}
          </strong>
          <small>
            {metrics.effectiveOrders}{" "}
            pedidos efectivos
          </small>
        </article>

        <article className="dashboard-metric">
          <div className="dashboard-metric-icon">
            <Package size={21} />
          </div>
          <span>Combos vendidos</span>
          <strong>
            {metrics.combosSold}
          </strong>
          <small>
            Pagados y no reembolsados
          </small>
        </article>

        <article className="dashboard-metric">
          <div className="dashboard-metric-icon">
            <CupSoda size={21} />
          </div>
          <span>
            Coca-Colas vendidas
          </span>
          <strong>
            {metrics.cokesSold}
          </strong>
          <small>
            Latas dentro de ventas
            efectivas
          </small>
        </article>

        <article className="dashboard-metric">
          <div className="dashboard-metric-icon">
            <Ticket size={21} />
          </div>
          <span>Ticket promedio</span>
          <strong>
            {dashboardMoney.format(
              metrics.averageTicketCents /
                100,
            )}
          </strong>
          <small>
            Promedio por pedido efectivo
          </small>
        </article>
      </section>

      <section className="dashboard-secondary-metrics">
        <article>
          <XCircle size={18} />
          <div>
            <span>Cancelados</span>
            <strong>
              {metrics.cancelledOrders}
            </strong>
          </div>
        </article>

        <article>
          <RotateCcw size={18} />
          <div>
            <span>Reembolsados</span>
            <strong>
              {metrics.refundedOrders}
            </strong>
          </div>
        </article>

        <article>
          <UserX size={18} />
          <div>
            <span>No recogidos</span>
            <strong>
              {metrics.noShowOrders}
            </strong>
          </div>
        </article>
      </section>
    </>
  );
}
