import {
  buildCustomerOrderReceiptPdf,
  receiptSellerFromEnv,
  type ReceiptOrder,
} from "../orders/customer-order-receipt.js";
import type { MailMessage } from "./smtp-mail.transport.js";

function money(
  cents: number,
  currency: string,
) {
  return new Intl.NumberFormat(
    "es-MX",
    {
      style: "currency",
      currency,
    },
  ).format(cents / 100);
}

function dateTime(
  value: Date | string,
  timezone: string,
) {
  return new Intl.DateTimeFormat(
    "es-MX",
    {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

function html(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function deliveryText(
  order: ReceiptOrder,
) {
  if (
    order.groupDelivery.finalized
  ) {
    const fee =
      order.groupDelivery
        .finalFeeCents ?? 0;

    return fee > 0
      ? "Traslado final: " +
          money(
            fee,
            order.currency,
          ) +
          " en efectivo al entregar."
      : "Traslado final: envío gratis.";
  }

  if (
    order.groupDelivery
      .freeDeliveryUnlocked
  ) {
    return "Envío gratis desbloqueado; se confirma al cierre del grupo.";
  }

  const estimate =
    order.groupDelivery
      .estimatedDeliveryFeeCents;

  return estimate == null
    ? "El costo de traslado se confirmará al cierre del grupo."
    : "Traslado estimado: " +
        money(
          estimate,
          order.currency,
        ) +
        " en efectivo al entregar; el monto final se confirma al cierre.";
}

export function buildPurchaseConfirmationEmail(
  input: {
    recipient: string;
    order: ReceiptOrder;
  },
): MailMessage {
  const seller =
    receiptSellerFromEnv();
  const order = input.order;
  const receipt =
    buildCustomerOrderReceiptPdf(
      order,
      seller,
    );
  const pickupWhen =
    dateTime(
      order.pickup.startsAt,
      order.pickup.timezone,
    );
  const delivery =
    deliveryText(order);
  const itemText = order.items
    .map(
      (item) =>
        "- " +
        item.quantity +
        " x " +
        item.productName +
        " — " +
        money(
          item.lineTotalCents,
          order.currency,
        ),
    )
    .join("\n");

  const text = [
    "Pago confirmado",
    "",
    "Tu compra en " +
      seller.tradeName +
      " quedó pagada correctamente.",
    "",
    "Folio: " +
      order.orderCode,
    "Total pagado: " +
      money(
        order.totalCents,
        order.currency,
      ),
    "Entrega: " +
      pickupWhen,
    "Punto: " +
      order.pickup.pickupPoint
        .name,
    order.pickup.pickupPoint
      .address
      ? "Dirección: " +
        order.pickup.pickupPoint
          .address
      : "",
    delivery,
    "",
    "Detalle:",
    itemText,
    "",
    "Adjuntamos tu comprobante de compra en PDF.",
    "Este comprobante es informativo y no es CFDI ni factura fiscal.",
    "",
    "Soporte: " +
      seller.supportPhone +
      " | " +
      seller.supportEmail,
    "",
    "Conserva tu folio para cualquier aclaración.",
  ]
    .filter(
      (line) =>
        line !== undefined,
    )
    .join("\n");

  const itemRows =
    order.items
      .map(
        (item) =>
          "<tr>" +
          "<td style=\"padding:8px 0;border-bottom:1px solid #ece8df\">" +
          html(
            item.quantity +
              " x " +
              item.productName,
          ) +
          "</td>" +
          "<td style=\"padding:8px 0;border-bottom:1px solid #ece8df;text-align:right\">" +
          html(
            money(
              item.lineTotalCents,
              order.currency,
            ),
          ) +
          "</td>" +
          "</tr>",
      )
      .join("");

  const address =
    order.pickup.pickupPoint
      .address
      ? "<p style=\"margin:4px 0;color:#665f55\">" +
        html(
          order.pickup.pickupPoint
            .address,
        ) +
        "</p>"
      : "";

  const htmlBody =
    "<!doctype html>" +
    "<html><body style=\"margin:0;background:#f4f1ea;font-family:Arial,sans-serif;color:#29251f\">" +
    "<div style=\"max-width:640px;margin:0 auto;padding:28px 16px\">" +
    "<div style=\"background:#ffffff;border:1px solid #ded8ce;border-radius:18px;padding:28px\">" +
    "<p style=\"margin:0 0 8px;color:#61734f;font-size:12px;font-weight:700;text-transform:uppercase\">" +
    html(seller.tradeName) +
    "</p>" +
    "<h1 style=\"margin:0 0 10px;font-size:28px\">Pago confirmado</h1>" +
    "<p style=\"margin:0 0 22px;color:#665f55\">Tu compra quedó pagada correctamente.</p>" +
    "<div style=\"background:#f8f5ef;border-radius:12px;padding:16px;margin-bottom:20px\">" +
    "<p style=\"margin:0 0 6px\"><strong>Folio:</strong> " +
    html(order.orderCode) +
    "</p>" +
    "<p style=\"margin:0 0 6px\"><strong>Total pagado:</strong> " +
    html(
      money(
        order.totalCents,
        order.currency,
      ),
    ) +
    "</p>" +
    "<p style=\"margin:0 0 6px\"><strong>Entrega:</strong> " +
    html(pickupWhen) +
    "</p>" +
    "<p style=\"margin:0\"><strong>Punto:</strong> " +
    html(
      order.pickup.pickupPoint
        .name,
    ) +
    "</p>" +
    address +
    "</div>" +
    "<table style=\"width:100%;border-collapse:collapse;margin-bottom:20px\">" +
    itemRows +
    "</table>" +
    "<p style=\"margin:0 0 16px;padding:12px;border-left:4px solid #61734f;background:#f8f5ef\">" +
    html(delivery) +
    "</p>" +
    "<p style=\"margin:0 0 8px;color:#665f55\">Adjuntamos tu comprobante de compra en PDF.</p>" +
    "<p style=\"margin:0 0 18px;color:#857d72;font-size:12px\">El comprobante es informativo y no es CFDI ni factura fiscal.</p>" +
    "<p style=\"margin:0;color:#665f55;font-size:12px\">Soporte: " +
    html(seller.supportPhone) +
    " · " +
    html(seller.supportEmail) +
    "</p>" +
    "</div></div></body></html>";

  return {
    to: input.recipient,
    subject:
      "Pago confirmado · " +
      order.orderCode +
      " · " +
      seller.tradeName,
    text,
    html: htmlBody,
    attachments: [
      {
        filename:
          "comprobante-" +
          order.orderCode +
          ".pdf",
        contentType:
          "application/pdf",
        content: receipt,
      },
    ],
  };
}
