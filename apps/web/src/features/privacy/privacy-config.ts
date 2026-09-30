import type { PublicPrivacyConfig } from "./types";

function setting(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getPublicPrivacyConfig(): PublicPrivacyConfig {
  const responsible =
    setting("PRIVACY_RESPONSIBLE");
  const address =
    setting("PRIVACY_ADDRESS");
  const email =
    setting("PRIVACY_EMAIL");

  return {
    responsible:
      responsible || "Burger Danlin",
    address:
      address ||
      "Configurar PRIVACY_ADDRESS antes de producción",
    email:
      email ||
      "Configurar PRIVACY_EMAIL antes de producción",
    configured: Boolean(
      responsible && address && email,
    ),
  };
}
