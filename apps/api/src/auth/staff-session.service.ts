import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { STAFF_SESSION_SECONDS } from "./auth.constants.js";
import type {
  StaffRole,
  StaffSession,
} from "./auth.types.js";
import { credentialVersion } from "./credential-version.js";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
};

@Injectable()
export class StaffSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createSession(
    user: SessionUser,
    passwordHash: string,
  ) {
    const id = randomUUID();
    const version = credentialVersion(passwordHash);
    const expiresAt = new Date(
      Date.now() + STAFF_SESSION_SECONDS * 1000,
    );

    await this.prisma.staffSession.create({
      data: {
        id,
        userId: user.id,
        credentialVersion: version,
        expiresAt,
      },
    });

    const payload: StaffSession = {
      sid: id,
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      credentialVersion: version,
    };

    try {
      const token = await this.jwtService.signAsync(payload);

      return {
        token,
        sessionId: id,
        expiresAt,
      };
    } catch (error) {
      await this.prisma.staffSession.deleteMany({
        where: {
          id,
          userId: user.id,
        },
      });
      throw error;
    }
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ) {
    const result = await this.prisma.staffSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return result.count === 1;
  }

  async revokeAllForUser(userId: string) {
    return this.prisma.staffSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
