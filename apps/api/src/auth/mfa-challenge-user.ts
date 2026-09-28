import { UnauthorizedException } from "@nestjs/common";
import type { MfaChallenge } from "./auth.types.js";
import { credentialVersion } from "./credential-version.js";

export function assertMfaChallengeUser(
  user:
    | {
        id: string;
        role: string;
        active: boolean;
        passwordHash: string;
      }
    | null,
  payload: MfaChallenge,
) {
  if (
    !user?.active ||
    user.role !== "ADMIN" ||
    credentialVersion(
      user.passwordHash,
    ) !==
      payload.credentialVersion
  ) {
    throw new UnauthorizedException(
      "El desafío MFA ya no es válido.",
    );
  }
}
