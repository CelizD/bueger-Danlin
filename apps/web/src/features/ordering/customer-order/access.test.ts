import {
  describe,
  expect,
  it,
} from "vitest";
import { cancellationNotice } from "./access";

describe("customer order helpers", () => {
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
