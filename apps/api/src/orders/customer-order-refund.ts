export function hasRefundRequest(metadata: unknown) {
  return !!(
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "refundRequestedAt" in metadata
  );
}

export function withRefundMetadata(
  metadata: unknown,
  now: Date,
  status: "requested" | "completed",
) {
  const base =
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  return {
    ...base,
    refundRequestedAt: now.toISOString(),
    refundStatus: status,
    ...(status === "completed"
      ? { refundCompletedAt: now.toISOString() }
      : {}),
    refundReason: "customer_cancelled_before_cutoff",
  };
}
