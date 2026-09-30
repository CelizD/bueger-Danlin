import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getPublicPrivacyConfig } from "./privacy-config";

describe("getPublicPrivacyConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marca la configuración completa cuando existen identidad, domicilio y correo", () => {
    vi.stubEnv(
      "PRIVACY_RESPONSIBLE",
      "Responsable Legal",
    );
    vi.stubEnv(
      "PRIVACY_ADDRESS",
      "Domicilio de contacto 123",
    );
    vi.stubEnv(
      "PRIVACY_EMAIL",
      "privacidad@example.com",
    );

    expect(
      getPublicPrivacyConfig(),
    ).toEqual({
      responsible:
        "Responsable Legal",
      address:
        "Domicilio de contacto 123",
      email:
        "privacidad@example.com",
      configured: true,
    });
  });

  it("marca como incompleto cuando falta contacto legal", () => {
    vi.stubEnv(
      "PRIVACY_RESPONSIBLE",
      "Burger Danlin",
    );
    vi.stubEnv(
      "PRIVACY_ADDRESS",
      "",
    );
    vi.stubEnv(
      "PRIVACY_EMAIL",
      "",
    );

    expect(
      getPublicPrivacyConfig()
        .configured,
    ).toBe(false);
  });
});
