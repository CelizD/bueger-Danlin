export function hasRefundRequest(metadata: unknown) {
  return !!(
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "refundRequestedAt" in metadata
  );
}

function metadataRecord(metadata: unknown) {
  return metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

export function withRefundMetadata(
  metadata: unknown,
  now: Date,
  status: "requested" | "completed",
) {
  const base = metadataRecord(metadata);

  return {
    ...base,
    refundRequestedAt:
      typeof base.refundRequestedAt === "string"
        ? base.refundRequestedAt
        : now.toISOString(),
    refundStatus: status,
    refundLastAttemptAt: now.toISOString(),
    ...(status === "completed"
      ? {
          refundCompletedAt: now.toISOString(),
          refundLastError: null,
        }
      : {}),
    refundReason: "customer_cancelled_before_cutoff",
  };
}

export function withRefundFailureMetadata(
  metadata: unknown,
  now: Date,
  error: unknown,
) {
  const base = metadataRecord(metadata);
  const previousAttempts =
    typeof base.refundAttemptCount === "number"
      ? base.refundAttemptCount
      : 0;
  const message =
    error instanceof Error
      ? error.message.slice(0, 180)
      : "Refund provider call failed";

  return {
    ...base,
    refundStatus: "requested",
    refundLastAttemptAt: now.toISOString(),
    refundAttemptCount: previousAttempts + 1,
    refundLastError: message,
    refundReason: "customer_cancelled_before_cutoff",
  };
}
