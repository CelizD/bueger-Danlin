import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { OrderCodePipe } from "./order-code.pipe.js";

describe("OrderCodePipe", () => {
  const pipe = new OrderCodePipe();

  it("normaliza y acepta un código válido", () => {
    expect(pipe.transform(" h-a1b2c3d4 ")).toBe("H-A1B2C3D4");
  });

  it.each([
    "",
    "A1B2C3D4",
    "H-123",
    "H-123456789",
    "H-ZZZZZZZZ",
    "H-1234-678",
  ])("rechaza código inválido: %s", (value) => {
    expect(() => pipe.transform(value)).toThrow(
      BadRequestException,
    );
  });
});
