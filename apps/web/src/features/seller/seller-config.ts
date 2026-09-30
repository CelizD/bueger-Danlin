import type { PublicSellerConfig } from "./types";

function setting(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getPublicSellerConfig(): PublicSellerConfig {
  const legalName =
    setting("BUSINESS_LEGAL_NAME");
  const tradeName =
    setting("BUSINESS_TRADE_NAME") ||
    "Burger Danlin";
  const rfc =
    setting("BUSINESS_RFC");
  const address =
    setting("BUSINESS_ADDRESS");
  const supportEmail =
    setting("SUPPORT_EMAIL");
  const supportPhone =
    setting("SUPPORT_PHONE");

  return {
    legalName:
      legalName ||
      "Configurar BUSINESS_LEGAL_NAME antes de producción",
    tradeName,
    rfc:
      rfc ||
      "Configurar BUSINESS_RFC antes de producción",
    address:
      address ||
      "Configurar BUSINESS_ADDRESS antes de producción",
    supportEmail:
      supportEmail ||
      "Configurar SUPPORT_EMAIL antes de producción",
    supportPhone:
      supportPhone ||
      "Configurar SUPPORT_PHONE antes de producción",
    configured: Boolean(
      legalName &&
        tradeName &&
        rfc &&
        address &&
        supportEmail &&
        supportPhone,
    ),
  };
}
