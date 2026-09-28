import type { ProviderPaymentStatus } from "./domain/payment-provider.types.js";

const STATUS_RANK: Record<ProviderPaymentStatus, number> = {
  PENDING: 0,
  PROCESSING: 1,
  FAILED: 2,
  CANCELLED: 2,
  PAID: 3,
  PARTIALLY_REFUNDED: 4,
  REFUNDED: 5,
};

export function shouldApplyPaymentStatus(
  current: ProviderPaymentStatus,
  incoming: ProviderPaymentStatus,
) {
  if (current === incoming) return false;

  if (current === "REFUNDED") return false;

  if (
    current === "PARTIALLY_REFUNDED" &&
    incoming !== "REFUNDED"
  ) {
    return false;
  }

  if (
    current === "PAID" &&
    !["PARTIALLY_REFUNDED", "REFUNDED"].includes(incoming)
  ) {
    return false;
  }

  return STATUS_RANK[incoming] > STATUS_RANK[current];
}
