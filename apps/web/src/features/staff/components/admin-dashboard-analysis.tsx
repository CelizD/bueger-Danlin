import {
  dashboardBarWidth,
  dashboardEventDate,
  dashboardMoney,
} from "../dashboard/formatters";
import type { DashboardData } from "../dashboard/types";

type Props = {
  data: DashboardData;
  maxExtraQuantity: number;
  maxEventRevenue: number;
};

export function AdminDashboardAnalysis({
  data,
  maxExtraQuantity,
  maxEventRevenue,
}: Props) {
  return (
    <>
      <div className="dashboard-history-heading">
        <div>
          <p className="admin-kicker">
            Análisis
          </p>
          <h2>
            Rendimiento e histórico
          </h2>
        </div>
        <span>
          {data.filter.selectedEvent
            ? "Entrega seleccionada"
            : "Acumulado general"}
        </span>
      </div>

      <section className="dashboard-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="admin-kicker">
                Preferencias
              </p>
              <h2>
                Extras más vendidos
              </h2>
            </div>
            <span>
              {data.topExtras.length}{" "}
              extras
            </span>
          </div>

          {data.topExtras.length ===
          0 ? (
            <div className="dashboard-empty">
              Todavía no hay extras
              vendidos en este periodo.
            </div>
          ) : (
            <div className="dashboard-ranking">
              {data.topExtras.map(
                (extra, index) => (
                  <div
                    className="dashboard-ranking-row"
                    key={extra.name}
                  >
                    <span className="dashboard-rank">
                      {index + 1}
                    </span>

                    <div className="dashboard-ranking-main">
                      <div>
                        <strong>
                          {extra.name}
                        </strong>
                        <span>
                          {extra.quantity}{" "}
                          vendido
                          {extra.quantity ===
                          1
                            ? ""
                            : "s"}{" "}
                          ·{" "}
                          {dashboardMoney.format(
                            extra.revenueCents /
                              100,
                          )}
                        </span>
                      </div>

                      <div className="dashboard-bar">
                        <span
                          style={{
                            width:
                              dashboardBarWidth(
                                extra.quantity,
                                maxExtraQuantity,
                              ) + "%",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="admin-kicker">
                Histórico
              </p>
              <h2>
                Ventas por sábado
              </h2>
            </div>
            <span>
              Últimos 8 con ventas
            </span>
          </div>

          {data.salesByEvent.length ===
          0 ? (
            <div className="dashboard-empty">
              Todavía no hay ventas
              pagadas para mostrar.
            </div>
          ) : (
            <div className="dashboard-event-list">
              {data.salesByEvent.map(
                (event) => (
                  <div
                    className="dashboard-event-row"
                    key={event.id}
                  >
                    <div className="dashboard-event-copy">
                      <strong>
                        {dashboardEventDate(
                          event.startsAt,
                        )}
                      </strong>
                      <span>
                        {event.combosSold}{" "}
                        combos ·{" "}
                        {event.paidOrders}{" "}
                        pedidos
                      </span>
                    </div>

                    <div className="dashboard-event-value">
                      <strong>
                        {dashboardMoney.format(
                          event.revenueCents /
                            100,
                        )}
                      </strong>
                      <div className="dashboard-bar">
                        <span
                          style={{
                            width:
                              dashboardBarWidth(
                                event.revenueCents,
                                maxEventRevenue,
                              ) + "%",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </article>
      </section>
    </>
  );
}
