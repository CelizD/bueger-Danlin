import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../database/prisma.service.js";
import type { StaffSession } from "./auth.types.js";
import { credentialVersion } from "./credential-version.js";

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
      },
    });

    const hashToVerify = user?.passwordHash ?? (await this.dummyHashPromise);
    const passwordMatches = await argon2.verify(hashToVerify, password);

    if (!user || !user.active || !passwordMatches) {
      throw new UnauthorizedException("Correo o contraseña incorrectos.");
    }

    const session: StaffSession = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      credentialVersion: credentialVersion(user.passwordHash),
    };

    const token = await this.jwtService.signAsync(session);

    return {
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
