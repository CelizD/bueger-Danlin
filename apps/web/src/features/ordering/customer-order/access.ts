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
