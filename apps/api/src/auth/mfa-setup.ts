import { ConflictException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { PrismaService } from "../database/prisma.service.js";
import type { MfaChallenge } from "./auth.types.js";
import { assertMfaChallengeUser } from "./mfa-challenge-user.js";
import { encodeBase32 } from "./mfa-code-utils.js";
import { decryptMfaSecret, encryptMfaSecret } from "./mfa-secret-crypto.js";
export async function getMfaSetup(
  prisma: PrismaService,
  payload: MfaChallenge,
) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT "id" FROM "User" WHERE "id" = $1 FOR UPDATE`,
        payload.sub,
      );

      const user = await tx.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          active: true,
          passwordHash: true,
          mfaEnabled: true,
          mfaSecretEncrypted: true,
        },
      });

      assertMfaChallengeUser(user, payload);

      if (user!.mfaEnabled) {
        throw new ConflictException("MFA ya está configurado.");
      }

      let secret = user!.mfaSecretEncrypted
        ? decryptMfaSecret(user!.mfaSecretEncrypted)
        : null;

      if (!secret) {
        secret = encodeBase32(randomBytes(20));

        await tx.user.update({
          where: { id: user!.id },
          data: {
            mfaSecretEncrypted: encryptMfaSecret(secret),
          },
        });
      }

      const issuer = "Burger Danlin";
      const label = `${issuer}:${user!.email}`;
      const otpauthUri =
        `otpauth://totp/${encodeURIComponent(label)}` +
        `?secret=${secret}` +
        `&issuer=${encodeURIComponent(issuer)}` +
        "&algorithm=SHA1&digits=6&period=30";

      return {
        secret,
        otpauthUri,
        issuer,
        accountName: user!.email,
      };
    });
}
