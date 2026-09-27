import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GroupDeliveryProgress } from "./group-delivery-progress";

describe("GroupDeliveryProgress", () => {
  it("muestra progreso, faltantes y costo estimado", () => {
    const html = renderToStaticMarkup(
      <GroupDeliveryProgress
        pointName="Universidad"
        paymentStatus="PAID"
        group={{
          minPaidOrders: 5,
          paidOrderCount: 4,
          remainingPaidOrders: 1,
          transportCostCents: 10_000,
          estimatedDeliveryFeeCents: 2_500,
          freeDeliveryUnlocked: false,
        }}
      />,
    );

    expect(html).toContain("4 de 5 pedidos pagados");
    expect(html).toContain("Falta");
    expect(html).toContain("$25");
  });

  it("muestra cargo final congelado después del cierre", () => {
    const html = renderToStaticMarkup(
      <GroupDeliveryProgress
        pointName="Universidad"
        paymentStatus="PAID"
        group={{
          minPaidOrders: 5,
          paidOrderCount: 3,
          remainingPaidOrders: 2,
          transportCostCents: 10_000,
          estimatedDeliveryFeeCents: 3_334,
          freeDeliveryUnlocked: false,
          finalized: true,
          finalizedAt: "2026-10-03T04:00:00.000Z",
          finalFeeCents: 3_334,
        }}
      />,
    );

    expect(html).toContain("Cargo final de envío");
    expect(html).toContain("$33");
    expect(html).toContain("ya no cambiará");
  });

  it("muestra envío gratis al completar la meta", () => {
    const html = renderToStaticMarkup(
      <GroupDeliveryProgress
        pointName="Cucapá"
        paymentStatus="PAID"
        group={{
          minPaidOrders: 5,
          paidOrderCount: 5,
          remainingPaidOrders: 0,
          transportCostCents: 10_000,
          estimatedDeliveryFeeCents: 0,
          freeDeliveryUnlocked: true,
        }}
      />,
    );

    expect(html).toContain("Envío gratis desbloqueado");
    expect(html).toContain("$0");
  });
});
