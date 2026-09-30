import type { PublicSellerConfig } from "@/features/seller/types";

function phoneHref(phone: string) {
  const normalized =
    phone.replace(/[^\d+]/g, "");

  return normalized.startsWith("+")
    ? "tel:" + normalized
    : "tel:+52" + normalized;
}

export function SellerDisclosure({
  seller,
}: {
  seller: PublicSellerConfig;
}) {
  return (
    <aside
      className="seller-disclosure"
      aria-label="Datos del vendedor y soporte"
    >
      <div>
        <p className="eyebrow">
          Información del vendedor
        </p>
        <h2>{seller.tradeName}</h2>
      </div>

      <dl>
        <div>
          <dt>Vendedor</dt>
          <dd>{seller.legalName}</dd>
        </div>
        <div>
          <dt>RFC</dt>
          <dd>{seller.rfc}</dd>
        </div>
        <div>
          <dt>Domicilio</dt>
          <dd>{seller.address}</dd>
        </div>
      </dl>

      <p>
        ¿Necesitas una aclaración o ayuda con
        tu pedido?{" "}
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
    </aside>
  );
}
