import { createHash, createHmac } from "node:crypto";

export function createOrderVerificationToken(
  qrSecret: string,
  orderId: string,
) {
  return createHmac("sha256", qrSecret)
    .update(orderId)
    .digest("base64url");
}

export function hashOrderVerificationToken(
  verificationToken: string,
) {
  return createHash("sha256")
    .update(verificationToken)
    .digest("hex");
}
