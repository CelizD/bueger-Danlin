import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../database/prisma.service.js";
import type { StaffSession } from "./auth.types.js";
import { credentialVersion } from "./credential-version.js";
import { MfaService } from "./mfa.service.js";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class AuthService {
  private readonly dummyHashPromise = argon2.hash(
    "invalid-login-sentinel-value",
    ARGON2_OPTIONS,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mfaService: MfaService,
  ) {}

  async login(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        passwordHash: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        mfaEnabled: true,
      },
    });

    const hashToVerify =
      user?.passwordHash ?? (await this.dummyHashPromise);
    const passwordMatches = await argon2.verify(
      hashToVerify,
      password,
    );
    const now = new Date();
    const accountLocked =
      !!user?.lockedUntil &&
      user.lockedUntil.getTime() > now.getTime();

    if (
      !user ||
      !user.active ||
      !passwordMatches ||
      accountLocked
    ) {
      if (user?.active && !accountLocked) {
        const nextAttempts = user.failedLoginAttempts + 1;
        const shouldLock =
          nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
        const lockedUntil = shouldLock
          ? new Date(
              now.getTime() + LOGIN_LOCK_MINUTES * 60_000,
            )
          : null;

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: shouldLock
              ? 0
              : nextAttempts,
            lockedUntil,
          },
        });

        await this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: shouldLock
              ? "STAFF_LOGIN_LOCKED"
              : "STAFF_LOGIN_FAILED",
            entityType: "User",
            entityId: user.id,
            after: {
              failedAttempt: true,
              ...(lockedUntil
                ? {
                    lockedUntil:
                      lockedUntil.toISOString(),
                  }
                : {}),
            },
          },
        });
      }

      throw new UnauthorizedException(
        "Correo o contraseña incorrectos.",
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(user.role === "ADMIN"
          ? {}
          : { lastLoginAt: now }),
      },
    });

    if (user.role === "ADMIN") {
      const challengeToken =
        await this.mfaService.createChallenge(user);

      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "STAFF_LOGIN_MFA_REQUIRED",
          entityType: "User",
          entityId: user.id,
          after: {
            setupRequired: !user.mfaEnabled,
          },
        },
      });

      return {
        mfaRequired: true as const,
        setupRequired: !user.mfaEnabled,
        challengeToken,
      };
    }

    const session: StaffSession = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      credentialVersion: credentialVersion(
        user.passwordHash,
      ),
    };

    const token = await this.jwtService.signAsync(session);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "STAFF_LOGIN_SUCCESS",
        entityType: "User",
        entityId: user.id,
        after: {
          role: user.role,
        },
      },
    });

    return {
      mfaRequired: false as const,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
