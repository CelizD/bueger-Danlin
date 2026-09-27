import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import type { StaffSession } from "./auth.types.js";
import { StaffSessionService } from "./staff-session.service.js";
import { MfaService } from "./mfa.service.js";
import {
  hashStaffPassword,
  verifyStaffPassword,
} from "./password-security.js";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly dummyHashPromise = hashStaffPassword(
    "invalid-login-sentinel-value",
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly mfaService: MfaService,
    private readonly staffSessionService: StaffSessionService,
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
    const passwordMatches = await verifyStaffPassword(
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

    const createdSession =
      await this.staffSessionService.createSession(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        user.passwordHash,
      );

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "STAFF_LOGIN_SUCCESS",
        entityType: "User",
        entityId: user.id,
        after: {
          role: user.role,
          sessionId: createdSession.sessionId,
        },
      },
    });

    return {
      mfaRequired: false as const,
      token: createdSession.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async logout(session: StaffSession) {
    const revoked =
      await this.staffSessionService.revokeSession(
        session.sub,
        session.sid,
      );

    await this.prisma.auditLog.create({
      data: {
        userId: session.sub,
        action: "STAFF_LOGOUT",
        entityType: "StaffSession",
        entityId: session.sid,
        after: {
          revoked,
        },
      },
    });

    return revoked;
  }
}
