import { UnauthorizedException } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";

export function assertOrderVerificationToken(
  expectedHash: string,
  verificationToken: string,
) {
  const actualHash = createHash("sha256")
    .update(verificationToken)
    .digest("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");

  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    throw new UnauthorizedException("Token de pedido inválido.");
  }
}
