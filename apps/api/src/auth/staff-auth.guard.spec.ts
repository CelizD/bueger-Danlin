import {
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { StaffAuthGuard } from "./staff-auth.guard.js";
import { credentialVersion } from "./credential-version.js";

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function sessionRecord(
  passwordHash: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "session-1",
    userId: "user-1",
    credentialVersion: credentialVersion(passwordHash),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user: {
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      role: "KITCHEN",
      active: true,
      passwordHash,
      mfaEnabled: false,
    },
    ...overrides,
  };
}

describe("StaffAuthGuard", () => {
  it("permite una sesión persistente activa", async () => {
    const passwordHash = "hash-value";
    const payload = {
      sid: "session-1",
      sub: "user-1",
      email: "staff@example.com",
      name: "Staff",
      role: "KITCHEN" as const,
      credentialVersion: credentialVersion(passwordHash),
    };
    const request = {
      cookies: {
        burger_staff_session: "signed-token",
      },
    };
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue(payload),
    } as unknown as JwtService;
    const prisma = {
      staffSession: {
        findUnique: vi
          .fn()
          .mockResolvedValue(sessionRecord(passwordHash)),
      },
    } as unknown as PrismaService;

    const guard = new StaffAuthGuard(jwt, prisma);

    await expect(
      guard.canActivate(context(request)),
    ).resolves.toBe(true);

    expect(request).toHaveProperty("user.sid", "session-1");
  });

  it("rechaza inmediatamente una sesión revocada aunque el JWT sea válido", async () => {
    const passwordHash = "hash-value";
    const payload = {
      sid: "session-1",
      sub: "user-1",
      email: "staff@example.com",
      name: "Staff",
      role: "KITCHEN" as const,
      credentialVersion: credentialVersion(passwordHash),
    };
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue(payload),
    } as unknown as JwtService;
    const prisma = {
      staffSession: {
        findUnique: vi.fn().mockResolvedValue(
          sessionRecord(passwordHash, {
            revokedAt: new Date(),
          }),
        ),
      },
    } as unknown as PrismaService;

    const guard = new StaffAuthGuard(jwt, prisma);

    await expect(
      guard.canActivate(
        context({
          cookies: {
            burger_staff_session: "stolen-token",
          },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rechaza JWT antiguos que no tengan sid", async () => {
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        credentialVersion: "version",
      }),
    } as unknown as JwtService;
    const prisma = {
      staffSession: {
        findUnique: vi.fn(),
      },
    } as unknown as PrismaService;

    const guard = new StaffAuthGuard(jwt, prisma);

    await expect(
      guard.canActivate(
        context({
          cookies: {
            burger_staff_session: "legacy-token",
          },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.staffSession.findUnique).not.toHaveBeenCalled();
  });
});
