import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getPublicSellerConfig } from "./seller-config";

describe("getPublicSellerConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marca la configuración completa con identidad y soporte", () => {
    vi.stubEnv(
      "BUSINESS_LEGAL_NAME",
      "Persona Vendedora",
    );
    vi.stubEnv(
      "BUSINESS_TRADE_NAME",
      "Burger Danlin",
    );
    vi.stubEnv(
      "BUSINESS_RFC",
      "ABCD010101ABC",
    );
    vi.stubEnv(
      "BUSINESS_ADDRESS",
      "Domicilio comercial de prueba 123",
    );
    vi.stubEnv(
      "SUPPORT_PHONE",
      "+52 664 123 4567",
    );
    vi.stubEnv(
      "SUPPORT_EMAIL",
      "soporte@example.com",
    );

    expect(
      getPublicSellerConfig(),
    ).toEqual({
      legalName:
        "Persona Vendedora",
      tradeName:
        "Burger Danlin",
      rfc:
        "ABCD010101ABC",
      address:
        "Domicilio comercial de prueba 123",
      supportPhone:
        "+52 664 123 4567",
      supportEmail:
        "soporte@example.com",
      configured: true,
    });
  });

  it("marca incompleto cuando faltan datos públicos del vendedor", () => {
    vi.stubEnv(
      "BUSINESS_LEGAL_NAME",
      "",
    );
    vi.stubEnv(
      "BUSINESS_RFC",
      "",
    );
    vi.stubEnv(
      "BUSINESS_ADDRESS",
      "",
    );
    vi.stubEnv(
      "SUPPORT_PHONE",
      "",
    );
    vi.stubEnv(
      "SUPPORT_EMAIL",
      "",
    );

    expect(
      getPublicSellerConfig()
        .configured,
    ).toBe(false);
  });
});
