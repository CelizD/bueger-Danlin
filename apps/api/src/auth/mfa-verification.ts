import { UnauthorizedException } from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service.js";
import type { MfaChallenge } from "./auth.types.js";
import { assertMfaChallengeUser } from "./mfa-challenge-user.js";
import {
  findValidTotpStep,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  safeEqualHex,
} from "./mfa-code-utils.js";
import { decryptMfaSecret } from "./mfa-secret-crypto.js";
export async function verifyMfaUser(
  prisma: PrismaService,
  payload: MfaChallenge,
  codeInput: string,
) {    const code = codeInput.trim();

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT "id" FROM "User" WHERE "id" = $1 FOR UPDATE`,
        payload.sub,
      );

      const user = await tx.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          passwordHash: true,
          mfaEnabled: true,
          mfaSecretEncrypted: true,
          mfaRecoveryCodeHashes: true,
          mfaLastUsedStep: true,
        },
      });

      assertMfaChallengeUser(user, payload);

      const isTotp = /^\d{6}$/.test(code);
      let recoveryCodes: string[] | undefined;
      let auditAction = "STAFF_MFA_VERIFIED";

      if (isTotp) {
        if (!user!.mfaSecretEncrypted) {
          throw new UnauthorizedException(
            "MFA todavía no está configurado.",
          );
        }

        const secret = decryptMfaSecret(
          user!.mfaSecretEncrypted,
        );
        const matchedStep = findValidTotpStep(
          code,
          secret,
          user!.mfaLastUsedStep,
        );

        if (matchedStep === null) {
          throw new UnauthorizedException(
            "Código de verificación incorrecto o expirado.",
          );
        }

        if (!user!.mfaEnabled) {
          recoveryCodes = generateRecoveryCodes();
          const hashes = recoveryCodes.map(hashRecoveryCode);

          await tx.user.update({
            where: { id: user!.id },
            data: {
              mfaEnabled: true,
              mfaRecoveryCodeHashes: hashes,
              mfaLastUsedStep: matchedStep,
              mfaEnrolledAt: new Date(),
              lastLoginAt: new Date(),
              failedLoginAttempts: 0,
              lockedUntil: null,
            },
          });

          auditAction = "STAFF_MFA_ENROLLED";
        } else {
          await tx.user.update({
            where: { id: user!.id },
            data: {
              mfaLastUsedStep: matchedStep,
              lastLoginAt: new Date(),
              failedLoginAttempts: 0,
              lockedUntil: null,
            },
          });
        }
      } else {
        if (!user!.mfaEnabled) {
          throw new UnauthorizedException(
            "Completa primero la configuración MFA.",
          );
        }

        const normalized = normalizeRecoveryCode(code);

        if (!/^[A-F0-9]{10}$/.test(normalized)) {
          throw new UnauthorizedException(
            "Código de recuperación inválido.",
          );
        }

        const storedHashes = Array.isArray(
          user!.mfaRecoveryCodeHashes,
        )
          ? user!.mfaRecoveryCodeHashes.filter(
              (value): value is string =>
                typeof value === "string",
            )
          : [];

        const candidateHash = hashRecoveryCode(normalized);
        const matchIndex = storedHashes.findIndex((hash) =>
          safeEqualHex(hash, candidateHash),
        );

        if (matchIndex < 0) {
          throw new UnauthorizedException(
            "Código de recuperación inválido o ya utilizado.",
          );
        }

        const remainingHashes = storedHashes.filter(
          (_, index) => index !== matchIndex,
        );

        await tx.user.update({
          where: { id: user!.id },
          data: {
            mfaRecoveryCodeHashes: remainingHashes,
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });

        auditAction = "STAFF_MFA_RECOVERY_USED";
      }

      await tx.auditLog.create({
        data: {
          userId: user!.id,
          action: auditAction,
          entityType: "User",
          entityId: user!.id,
          after: {
            mfaEnabled: true,
          },
        },
      });

      return {
        user: {
          id: user!.id,
          email: user!.email,
          name: user!.name,
          role: user!.role,
        },
        passwordHash: user!.passwordHash,
        recoveryCodes,
      };
    });

  return result;
}
