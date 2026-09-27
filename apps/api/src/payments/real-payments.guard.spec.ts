import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  assertRealPaymentsEnabled,
  realPaymentsEnabled,
} from "./real-payments.guard.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("real payments kill switch", () => {
  it.each([undefined, "", "false", "FALSE", "1", "yes"])(
    "mantiene pagos reales deshabilitados con %s",
    (value) => {
      if (value === undefined) {
        vi.stubEnv("ENABLE_REAL_PAYMENTS", "");
      } else {
        vi.stubEnv("ENABLE_REAL_PAYMENTS", value);
      }

      expect(realPaymentsEnabled()).toBe(false);
      expect(() => assertRealPaymentsEnabled()).toThrow(
        "Real payment calls are disabled",
      );
    },
  );

  it("solo habilita llamadas reales con true explícito", () => {
    vi.stubEnv("ENABLE_REAL_PAYMENTS", "true");

    expect(realPaymentsEnabled()).toBe(true);
    expect(() => assertRealPaymentsEnabled()).not.toThrow();
  });
});
