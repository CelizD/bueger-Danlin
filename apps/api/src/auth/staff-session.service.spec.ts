import type { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { StaffSessionService } from "./staff-session.service.js";

describe("StaffSessionService", () => {
  it("crea una sesión persistente y firma un JWT con sid", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const signAsync = vi.fn().mockResolvedValue("signed-token");

    const prisma = {
      staffSession: {
        create,
        deleteMany,
        updateMany,
      },
    } as unknown as PrismaService;

    const jwt = {
      signAsync,
    } as unknown as JwtService;

    const service = new StaffSessionService(prisma, jwt);
    const result = await service.createSession(
      {
        id: "user-1",
        email: "staff@example.com",
        name: "Staff",
        role: "KITCHEN",
      },
      "$argon2id$test",
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        userId: "user-1",
        credentialVersion: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });

    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sid: expect.any(String),
        sub: "user-1",
        role: "KITCHEN",
        credentialVersion: expect.any(String),
      }),
    );

    expect(result).toMatchObject({
      token: "signed-token",
      sessionId: expect.any(String),
      expiresAt: expect.any(Date),
    });
  });

  it("revoca una sesión concreta", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });

    const prisma = {
      staffSession: {
        updateMany,
      },
    } as unknown as PrismaService;

    const service = new StaffSessionService(
      prisma,
      {} as JwtService,
    );

    await expect(
      service.revokeSession("user-1", "session-1"),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });
});
