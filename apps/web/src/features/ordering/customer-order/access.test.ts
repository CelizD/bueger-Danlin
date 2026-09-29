import {
  describe,
  expect,
  it,
} from "vitest";
import { cancellationNotice } from "./access";
import { orderTokenStorageKey } from "./config";

describe("customer order helpers", () => {
  it("usa una clave de sesión por código de pedido", () => {
    expect(
      orderTokenStorageKey("H-ABC123"),
    ).toBe(
      "burger-danlin:order-token:H-ABC123",
    );
  });

  it("describe correctamente cancelación y reembolso", () => {
    expect(
      cancellationNotice(null),
    ).toContain("cupo fue liberado");

    expect(
      cancellationNotice("PENDING"),
    ).toContain("reembolso sigue en proceso");

    expect(
      cancellationNotice("REFUNDED"),
    ).toContain("reembolso ya fue completado");
  });
});
