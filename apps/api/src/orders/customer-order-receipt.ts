type ReceiptLine = {
  text: string;
  bold?: boolean;
  size?: number;
  gapAfter?: number;
};

type ReceiptOrder = {
  orderCode: string;
  status: string;
  paymentStatus: string;
  currency: string;
  totalCents: number;
  comboQuantity: number;
  createdAt: Date | string;
  purchaseTermsVersion?: string | null;
  purchaseTermsAcceptedAt?: Date | string | null;
  payment?: {
    provider: string;
    paidAt: Date | string | null;
    refundedAt: Date | string | null;
  } | null;
  pickup: {
    startsAt: Date | string;
    timezone: string;
    pickupPoint: {
      name: string;
      address: string | null;
    };
  };
  groupDelivery: {
    finalized: boolean;
    freeDeliveryUnlocked: boolean;
    estimatedDeliveryFeeCents: number | null;
    finalFeeCents: number | null;
  };
  items: Array<{
    productName: string;
    quantity: number;
    lineTotalCents: number;
    modifiers: Array<{
      optionName: string;
      removed: boolean;
      priceDeltaCents: number;
    }>;
  }>;
};

type ReceiptSeller = {
  legalName: string;
  tradeName: string;
  rfc: string;
  address: string;
  supportPhone: string;
  supportEmail: string;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function receiptSellerFromEnv(): ReceiptSeller {
  const seller = {
    legalName:
      env("BUSINESS_LEGAL_NAME"),
    tradeName:
      env("BUSINESS_TRADE_NAME") ||
      "Burger Danlin",
    rfc: env("BUSINESS_RFC"),
    address: env("BUSINESS_ADDRESS"),
    supportPhone:
      env("SUPPORT_PHONE"),
    supportEmail:
      env("SUPPORT_EMAIL"),
  };

  if (
    process.env.NODE_ENV ===
      "production" &&
    Object.values(seller).some(
      (value) => !value,
    )
  ) {
    throw new Error(
      "Seller identity is incomplete for receipt generation.",
    );
  }

  return {
    legalName:
      seller.legalName ||
      "Vendedor de desarrollo",
    tradeName: seller.tradeName,
    rfc:
      seller.rfc ||
      "RFC-NO-CONFIGURADO",
    address:
      seller.address ||
      "Domicilio no configurado",
    supportPhone:
      seller.supportPhone ||
      "Teléfono no configurado",
    supportEmail:
      seller.supportEmail ||
      "Correo no configurado",
  };
}

function money(
  cents: number,
  currency: string,
) {
  return (
    "$" +
    (cents / 100).toFixed(2) +
    " " +
    currency
  );
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_PAYMENT:
      "Pendiente de pago",
    PENDING: "Pendiente",
    PROCESSING: "Procesando",
    PAID: "Pagado",
    PREPARING: "En preparación",
    READY: "Listo",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
    REFUNDED: "Reembolsado",
    NO_SHOW: "No recogido",
  };

  return labels[status] ?? status;
}

function buildLines(
  order: ReceiptOrder,
  seller: ReceiptSeller,
): ReceiptLine[] {
  const lines: ReceiptLine[] = [
    {
      text: seller.tradeName,
      bold: true,
      size: 17,
      gapAfter: 3,
    },
    {
      text:
        "COMPROBANTE DE COMPRA",
      bold: true,
      size: 13,
    },
    {
      text:
        "Documento informativo. No es CFDI ni factura fiscal.",
      size: 9,
      gapAfter: 8,
    },
    {
      text:
        "Vendedor: " +
        seller.legalName,
    },
    {
      text: "RFC: " + seller.rfc,
    },
    {
      text:
        "Domicilio: " +
        seller.address,
    },
    {
      text:
        "Soporte: " +
        seller.supportPhone +
        " | " +
        seller.supportEmail,
      gapAfter: 8,
    },
    {
      text:
        "Folio: " + order.orderCode,
      bold: true,
    },
    {
      text:
        "Fecha de compra: " +
        dateTime(
          order.createdAt,
          order.pickup.timezone,
        ),
    },
    {
      text:
        "Estado del pedido: " +
        statusLabel(order.status),
    },
    {
      text:
        "Estado del pago: " +
        statusLabel(
          order.paymentStatus,
        ),
    },
  ];

  if (order.payment) {
    lines.push({
      text:
        "Proveedor de pago: " +
        order.payment.provider,
    });

    if (order.payment.paidAt) {
      lines.push({
        text:
          "Pago confirmado: " +
          dateTime(
            order.payment.paidAt,
            order.pickup.timezone,
          ),
      });
    }

    if (
      order.payment.refundedAt
    ) {
      lines.push({
        text:
          "Reembolso confirmado: " +
          dateTime(
            order.payment.refundedAt,
            order.pickup.timezone,
          ),
      });
    }
  }

  if (
    order.purchaseTermsVersion
  ) {
    lines.push({
      text:
        "Términos aceptados: " +
        order.purchaseTermsVersion,
      gapAfter: 8,
    });
  } else {
    lines.push({
      text: "",
      gapAfter: 8,
    });
  }

  lines.push({
    text: "DETALLE DE COMPRA",
    bold: true,
    size: 12,
    gapAfter: 3,
  });

  for (const item of order.items) {
    lines.push({
      text:
        item.quantity +
        " x " +
        item.productName +
        " — " +
        money(
          item.lineTotalCents,
          order.currency,
        ),
      bold: true,
    });

    for (const modifier of item.modifiers) {
      const delta =
        modifier.priceDeltaCents !== 0
          ? " (" +
            money(
              modifier.priceDeltaCents,
              order.currency,
            ) +
            ")"
          : "";

      lines.push({
        text:
          "   " +
          (modifier.removed
            ? "Sin "
            : "+ ") +
          modifier.optionName +
          delta,
        size: 9,
      });
    }
  }

  lines.push(
    {
      text: "",
      gapAfter: 4,
    },
    {
      text:
        "Total del pedido pagado en línea: " +
        money(
          order.totalCents,
          order.currency,
        ),
      bold: true,
      size: 12,
      gapAfter: 5,
    },
  );

  if (order.groupDelivery.finalized) {
    const finalFee =
      order.groupDelivery
        .finalFeeCents ?? 0;

    lines.push({
      text:
        finalFee > 0
          ? "Traslado grupal final: " +
            money(
              finalFee,
              order.currency,
            ) +
            " en efectivo al entregar."
          : "Traslado grupal final: $0.00 " +
            order.currency +
            " (envío gratis).",
      bold: true,
      gapAfter: 8,
    });
  } else if (
    order.groupDelivery
      .freeDeliveryUnlocked
  ) {
    lines.push({
      text:
        "Traslado grupal: estimado actual $0.00 " +
        order.currency +
        "; se confirma al cierre del grupo.",
      gapAfter: 8,
    });
  } else {
    const estimated =
      order.groupDelivery
        .estimatedDeliveryFeeCents;

    lines.push({
      text:
        estimated == null
          ? "Traslado grupal: pendiente de cálculo al cierre."
          : "Traslado grupal estimado: " +
            money(
              estimated,
              order.currency,
            ) +
            " en efectivo al entregar; el monto final se confirma al cierre.",
      gapAfter: 8,
    });
  }

  lines.push(
    {
      text: "ENTREGA",
      bold: true,
      size: 12,
    },
    {
      text:
        "Punto: " +
        order.pickup.pickupPoint
          .name,
    },
  );

  if (
    order.pickup.pickupPoint
      .address
  ) {
    lines.push({
      text:
        "Dirección: " +
        order.pickup.pickupPoint
          .address,
    });
  }

  lines.push(
    {
      text:
        "Fecha y hora: " +
        dateTime(
          order.pickup.startsAt,
          order.pickup.timezone,
        ),
      gapAfter: 10,
    },
    {
      text:
        "Conserva este comprobante y tu folio para aclaraciones.",
      size: 9,
    },
    {
      text:
        "Soporte: " +
        seller.supportPhone +
        " | " +
        seller.supportEmail,
      size: 9,
    },
  );

  return lines;
}

function normalizeText(
  value: string,
) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^ -ÿ]/g, "?");
}

function escapePdfText(
  value: string,
) {
  return normalizeText(value)
    .replace(/\/g, "\\")
    .replace(/(/g, "\(")
    .replace(/)/g, "\)");
}

function wrap(
  value: string,
  maxChars: number,
) {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    return [""];
  }

  const words =
    normalized.split(/s+/);
  const result: string[] = [];
  let current = "";

  for (const word of words) {
    if (
      !current ||
      current.length +
        word.length +
        1 <=
        maxChars
    ) {
      current = current
        ? current + " " + word
        : word;
      continue;
    }

    result.push(current);
    current = word;
  }

  if (current) {
    result.push(current);
  }

  return result;
}

function paginate(
  lines: ReceiptLine[],
) {
  const pages: Array<
    Array<{
      text: string;
      bold: boolean;
      size: number;
      y: number;
    }>
  > = [[]];

  let y = 748;

  for (const line of lines) {
    const size = line.size ?? 10;
    const maxChars =
      size >= 15
        ? 54
        : size >= 12
          ? 66
          : 86;

    for (const part of wrap(
      line.text,
      maxChars,
    )) {
      if (y < 54) {
        pages.push([]);
        y = 748;
      }

      pages[pages.length - 1]!.push({
        text: part,
        bold: line.bold ?? false,
        size,
        y,
      });

      y -= size + 5;
    }

    y -= line.gapAfter ?? 0;
  }

  return pages;
}

function contentStream(
  page: ReturnType<
    typeof paginate
  >[number],
) {
  return page
    .map(
      (line) =>
        "BT /" +
        (line.bold ? "F2" : "F1") +
        " " +
        line.size +
        " Tf 1 0 0 1 50 " +
        line.y +
        " Tm (" +
        escapePdfText(line.text) +
        ") Tj ET",
    )
    .join("
");
}

function assemblePdf(
  pages: ReturnType<
    typeof paginate
  >,
) {
  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 5;

  objects[1] =
    "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  for (const page of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    const stream =
      contentStream(page);
    const length =
      Buffer.byteLength(
        stream,
        "latin1",
      );

    pageIds.push(pageId);
    objects[pageId] =
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> " +
      "/Contents " +
      contentId +
      " 0 R >>";
    objects[contentId] =
      "<< /Length " +
      length +
      " >>\nstream\n" +
      stream +
      "\nendstream";
  }

  objects[2] =
    "<< /Type /Pages /Count " +
    pageIds.length +
    " /Kids [" +
    pageIds
      .map((id) => id + " 0 R")
      .join(" ") +
    "] >>";

  const header = Buffer.from(
    "%PDF-1.4\n%âãÏÓ\n",
    "latin1",
  );
  const chunks: Buffer[] = [header];
  const offsets: number[] = [0];
  let offset = header.length;

  for (
    let id = 1;
    id < objects.length;
    id++
  ) {
    const chunk = Buffer.from(
      id +
        " 0 obj\n" +
        objects[id] +
        "\nendobj\n",
      "latin1",
    );

    offsets[id] = offset;
    chunks.push(chunk);
    offset += chunk.length;
  }

  const xrefOffset = offset;
  let xref =
    "xref\n0 " +
    objects.length +
    "\n0000000000 65535 f \n";

  for (
    let id = 1;
    id < objects.length;
    id++
  ) {
    xref +=
      String(offsets[id])
        .padStart(10, "0") +
      " 00000 n \n";
  }

  xref +=
    "trailer\n<< /Size " +
    objects.length +
    " /Root 1 0 R >>\nstartxref\n" +
    xrefOffset +
    "\n%%EOF\n";

  chunks.push(
    Buffer.from(xref, "latin1"),
  );

  return Buffer.concat(chunks);
}

export function buildCustomerOrderReceiptPdf(
  order: ReceiptOrder,
  seller = receiptSellerFromEnv(),
) {
  return assemblePdf(
    paginate(
      buildLines(order, seller),
    ),
  );
}
