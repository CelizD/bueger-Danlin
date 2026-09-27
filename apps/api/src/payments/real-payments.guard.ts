export function realPaymentsEnabled() {
  return process.env.ENABLE_REAL_PAYMENTS?.trim().toLowerCase() === "true";
}

export function assertRealPaymentsEnabled() {
  if (!realPaymentsEnabled()) {
    throw new Error(
      "Real payment calls are disabled. Set ENABLE_REAL_PAYMENTS=true only when intentionally enabling provider traffic.",
    );
  }
}
