import { orderTokenStorageKey } from "./config";

export function resolveOrderAccessToken(
  orderCode: string,
) {
  const hash = window.location.hash;
  const hashToken =
    hash.startsWith("#token=")
      ? decodeURIComponent(
          hash.slice(
            "#token=".length,
          ),
        )
      : "";

  const storageKey =
    orderTokenStorageKey(orderCode);

  const savedToken =
    window.sessionStorage.getItem(
      storageKey,
    ) ?? "";

  const resolvedToken =
    hashToken || savedToken;

  if (hashToken) {
    window.sessionStorage.setItem(
      storageKey,
      hashToken,
    );

    window.history.replaceState(
      null,
      "",
      window.location.pathname,
    );
  }

  return resolvedToken;
}

export function cancellationNotice(
  refundStatus:
    | "PENDING"
    | "REFUNDED"
    | null,
) {
  if (
    refundStatus === "REFUNDED"
  ) {
    return "Pedido cancelado. El reembolso ya fue completado.";
  }

  if (refundStatus === "PENDING") {
    return "Pedido cancelado. Tu reembolso sigue en proceso.";
  }

  return "Pedido cancelado. El cupo fue liberado.";
}
