import { UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { AuthService } from "./auth.service.js";
import type { MfaService } from "./mfa.service.js";

let passwordHash: string;

const findUnique = vi.fn();
const update = vi.fn();
const auditCreate = vi.fn();
const signAsync = vi.fn();
const createChallenge = vi.fn();

const prisma = {
  user: {
    findUnique,
    update,
  },
  auditLog: {
    create: auditCreate,
  },
} as unknown as PrismaService;

const jwtService = {
  signAsync,
} as unknown as JwtService;

const mfaService = {
  createChallenge,
} as unknown as MfaService;

let service: AuthService;

function user(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "user-1",
    email: "staff@example.com",
    name: "Staff",
    role: "KITCHEN",
    active: true,
    passwordHash,
    failedLoginAttempts: 0,
    lockedUntil: null,
    mfaEnabled: false,
    ...overrides,
  };
}

beforeAll(async () => {
  passwordHash = await argon2.hash("correct-password", {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  service = new AuthService(
    prisma,
    jwtService,
    mfaService,
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue(undefined);
  auditCreate.mockResolvedValue(undefined);
  signAsync.mockResolvedValue("staff-session-token");
  createChallenge.mockResolvedValue("mfa-challenge-token");
});

describe("AuthService.login", () => {
  it("crea sesión para KITCHEN con credenciales válidas", async () => {
    findUnique.mockResolvedValue(user());

    const result = await service.login(
      " STAFF@EXAMPLE.COM ",
      "correct-password",
    );

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "staff@example.com" },
      }),
    );
    expect(signAsync).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STAFF_LOGIN_SUCCESS",
        }),
      }),
    );
    expect(result).toMatchObject({
      mfaRequired: false,
      token: "staff-session-token",
      user: {
        id: "user-1",
        role: "KITCHEN",
      },
    });
  });

  it("incrementa intentos fallidos sin revelar si la cuenta existe", async () => {
    findUnique.mockResolvedValue(user());

    await expect(
      service.login(
        "staff@example.com",
        "wrong-password",
      ),
    ).rejects.toThrow(
      new UnauthorizedException(
        "Correo o contraseña incorrectos.",
      ),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        failedLoginAttempts: 1,
        lockedUntil: null,
      },
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STAFF_LOGIN_FAILED",
        }),
      }),
    );
  });

  it("bloquea temporalmente la cuenta en el quinto fallo", async () => {
    findUnique.mockResolvedValue(
      user({ failedLoginAttempts: 4 }),
    );

    await expect(
      service.login(
        "staff@example.com",
        "wrong-password",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: expect.any(Date),
      },
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STAFF_LOGIN_LOCKED",
        }),
      }),
    );
  });

  it("exige MFA para ADMIN y no emite sesión antes del desafío", async () => {
    findUnique.mockResolvedValue(
      user({
        role: "ADMIN",
        mfaEnabled: true,
      }),
    );

    const result = await service.login(
      "staff@example.com",
      "correct-password",
    );

    expect(createChallenge).toHaveBeenCalledTimes(1);
    expect(signAsync).not.toHaveBeenCalled();
    expect(result).toEqual({
      mfaRequired: true,
      setupRequired: false,
      challengeToken: "mfa-challenge-token",
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STAFF_LOGIN_MFA_REQUIRED",
        }),
      }),
    );
  });
});
