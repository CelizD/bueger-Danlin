import type { PublicSellerConfig } from "@/features/seller/types";
import Link from "next/link";

function phoneHref(phone: string) {
  const normalized =
    phone.replace(/[^\d+]/g, "");

  return normalized.startsWith("+")
    ? "tel:" + normalized
    : "tel:+52" + normalized;
}

export function SiteFooter({
  seller,
}: {
  seller: PublicSellerConfig;
}) {
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <section>
          <p className="site-footer-brand">
            {seller.tradeName}
          </p>
          <p>
            Vendido por{" "}
            <strong>
              {seller.legalName}
            </strong>
            .
          </p>
          <p>
            RFC:{" "}
            <strong>{seller.rfc}</strong>
          </p>
        </section>

        <section>
          <strong>
            Domicilio y soporte
          </strong>
          <p>{seller.address}</p>
          <p>
            <a
              href={phoneHref(
                seller.supportPhone,
              )}
            >
              {seller.supportPhone}
            </a>
            {" · "}
            <a
              href={
                "mailto:" +
                seller.supportEmail
              }
            >
              {seller.supportEmail}
            </a>
          </p>
          <small>
            Para aclaraciones, reclamaciones,
            cancelaciones y soporte de pedidos.
          </small>
        </section>

        <nav
          className="site-footer-links"
          aria-label="Información legal"
        >
          <Link href="/terminos">
            Términos y Condiciones
          </Link>
          <Link href="/privacidad">
            Aviso de Privacidad
          </Link>
        </nav>
      </div>

      {!seller.configured &&
        process.env.NODE_ENV !==
          "production" && (
          <p
            className="site-footer-warning"
            role="status"
          >
            Datos comerciales de desarrollo:
            configura BUSINESS_LEGAL_NAME,
            BUSINESS_RFC, BUSINESS_ADDRESS,
            SUPPORT_PHONE y SUPPORT_EMAIL
            antes del lanzamiento.
          </p>
        )}
    </footer>
  );
}
