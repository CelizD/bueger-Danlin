import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import {
  MFA_CHALLENGE_SECONDS,
  STAFF_JWT_ALGORITHM,
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
} from "./auth.constants.js";
import type { MfaChallenge } from "./auth.types.js";
import { StaffSessionService } from "./staff-session.service.js";
import { credentialVersion } from "./credential-version.js";

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 8;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(input: Buffer) {
  let bits = "";
  let output = "";

  for (const byte of input) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }

  return output;
}

function decodeBase32(input: string) {
  const normalized = input
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");

  let bits = "";

  for (const character of normalized) {
    const value = BASE32_ALPHABET.indexOf(character);

    if (value < 0) {
      throw new UnauthorizedException("Secreto MFA inválido.");
    }

    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function totpAt(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counter)
    .digest();

  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function findValidTotpStep(
  code: string,
  secret: string,
  lastUsedStep: number | null,
) {
  if (!/^\d{6}$/.test(code)) return null;

  const currentStep = Math.floor(
    Date.now() / 1000 / TOTP_PERIOD_SECONDS,
  );

  for (const offset of [0, -1, 1]) {
    const step = currentStep + offset;

    if (lastUsedStep !== null && step <= lastUsedStep) continue;

    if (totpAt(secret, step) === code) {
      return step;
    }
  }

  return null;
}

function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-F0-9]/g, "");
}

function hashRecoveryCode(code: string) {
  return createHash("sha256")
    .update(normalizeRecoveryCode(code))
    .digest("hex");
}

function safeEqualHex(leftHex: string, rightHex: string) {
  if (
    !/^[a-f0-9]+$/i.test(leftHex) ||
    !/^[a-f0-9]+$/i.test(rightHex)
  ) {
    return false;
  }

  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");

  return (
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
}

function generateRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly staffSessionService: StaffSessionService,
  ) {}

  async createChallenge(user: {
    id: string;
    passwordHash: string;
  }) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        purpose: "staff-mfa",
        credentialVersion: credentialVersion(user.passwordHash),
      } satisfies MfaChallenge,
      {
        expiresIn: MFA_CHALLENGE_SECONDS,
      },
    );
  }

  async getSetup(challengeToken: string) {
    const payload = await this.verifyChallengeToken(challengeToken);

    return this.prisma.$transaction(async (tx) => {
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

      this.assertChallengeUser(user, payload);

      if (user!.mfaEnabled) {
        throw new ConflictException("MFA ya está configurado.");
      }

      let secret = user!.mfaSecretEncrypted
        ? this.decryptSecret(user!.mfaSecretEncrypted)
        : null;

      if (!secret) {
        secret = encodeBase32(randomBytes(20));

        await tx.user.update({
          where: { id: user!.id },
          data: {
            mfaSecretEncrypted: this.encryptSecret(secret),
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

  async verifyAndCreateSession(
    challengeToken: string,
    codeInput: string,
  ) {
    const payload = await this.verifyChallengeToken(challengeToken);
    const code = codeInput.trim();

    const result = await this.prisma.$transaction(async (tx) => {
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

      this.assertChallengeUser(user, payload);

      const isTotp = /^\d{6}$/.test(code);
      let recoveryCodes: string[] | undefined;
      let auditAction = "STAFF_MFA_VERIFIED";

      if (isTotp) {
        if (!user!.mfaSecretEncrypted) {
          throw new UnauthorizedException(
            "MFA todavía no está configurado.",
          );
        }

        const secret = this.decryptSecret(
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

    const createdSession =
      await this.staffSessionService.createSession(
        result.user,
        result.passwordHash,
      );

    await this.prisma.auditLog.create({
      data: {
        userId: result.user.id,
        action: "STAFF_LOGIN_SUCCESS",
        entityType: "StaffSession",
        entityId: createdSession.sessionId,
        after: {
          role: result.user.role,
          mfa: true,
        },
      },
    });

    return {
      token: createdSession.token,
      user: result.user,
      recoveryCodes: result.recoveryCodes,
    };
  }

  private async verifyChallengeToken(token: string) {
    try {
      const payload =
        await this.jwtService.verifyAsync<MfaChallenge>(token, {
          algorithms: [STAFF_JWT_ALGORITHM],
          issuer: STAFF_JWT_ISSUER,
          audience: STAFF_JWT_AUDIENCE,
        });

      if (payload.purpose !== "staff-mfa") {
        throw new UnauthorizedException();
      }

      return payload;
    } catch {
      throw new UnauthorizedException(
        "El desafío MFA expiró. Inicia sesión nuevamente.",
      );
    }
  }

  private assertChallengeUser(
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
      credentialVersion(user.passwordHash) !==
        payload.credentialVersion
    ) {
      throw new UnauthorizedException(
        "El desafío MFA ya no es válido.",
      );
    }
  }

  private encryptionKey() {
    const encoded =
      process.env.MFA_ENCRYPTION_KEY?.trim() ?? "";

    try {
      const key = Buffer.from(encoded, "base64url");

      if (key.length !== 32) {
        throw new Error();
      }

      return key;
    } catch {
      throw new InternalServerErrorException(
        "MFA_ENCRYPTION_KEY debe ser una clave base64url de 32 bytes.",
      );
    }
  }

  private encryptSecret(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      this.encryptionKey(),
      iv,
    );

    const ciphertext = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      "v1",
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  private decryptSecret(value: string) {
    const [version, ivValue, tagValue, ciphertextValue] =
      value.split(".");

    if (
      version !== "v1" ||
      !ivValue ||
      !tagValue ||
      !ciphertextValue
    ) {
      throw new InternalServerErrorException(
        "El secreto MFA almacenado es inválido.",
      );
    }

    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey(),
        Buffer.from(ivValue, "base64url"),
        { authTagLength: 16 },
      );
      decipher.setAuthTag(
        Buffer.from(tagValue, "base64url"),
      );

      return Buffer.concat([
        decipher.update(
          Buffer.from(ciphertextValue, "base64url"),
        ),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new InternalServerErrorException(
        "No fue posible descifrar el secreto MFA.",
      );
    }
  }
}
