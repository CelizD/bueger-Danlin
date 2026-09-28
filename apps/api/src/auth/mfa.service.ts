import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../database/prisma.service.js";
import {
  MFA_CHALLENGE_SECONDS,
  STAFF_JWT_ALGORITHM,
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
} from "./auth.constants.js";
import type { MfaChallenge } from "./auth.types.js";
import { credentialVersion } from "./credential-version.js";
import { getMfaSetup } from "./mfa-setup.js";
import { verifyMfaUser } from "./mfa-verification.js";
import { StaffSessionService } from "./staff-session.service.js";

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
        credentialVersion:
          credentialVersion(
            user.passwordHash,
          ),
      } satisfies MfaChallenge,
      {
        expiresIn:
          MFA_CHALLENGE_SECONDS,
      },
    );
  }

  async getSetup(
    challengeToken: string,
  ) {
    const payload =
      await this.verifyChallengeToken(
        challengeToken,
      );

    return getMfaSetup(
      this.prisma,
      payload,
    );
  }

  async verifyAndCreateSession(
    challengeToken: string,
    codeInput: string,
  ) {
    const payload =
      await this.verifyChallengeToken(
        challengeToken,
      );

    const result =
      await verifyMfaUser(
        this.prisma,
        payload,
        codeInput,
      );

    const createdSession =
      await this.staffSessionService.createSession(
        result.user,
        result.passwordHash,
      );

    await this.prisma.auditLog.create({
      data: {
        userId: result.user.id,
        action:
          "STAFF_LOGIN_SUCCESS",
        entityType:
          "StaffSession",
        entityId:
          createdSession.sessionId,
        after: {
          role: result.user.role,
          mfa: true,
        },
      },
    });

    return {
      token: createdSession.token,
      user: result.user,
      recoveryCodes:
        result.recoveryCodes,
    };
  }

  private async verifyChallengeToken(
    token: string,
  ) {
    try {
      const payload =
        await this.jwtService.verifyAsync<MfaChallenge>(
          token,
          {
            algorithms: [
              STAFF_JWT_ALGORITHM,
            ],
            issuer:
              STAFF_JWT_ISSUER,
            audience:
              STAFF_JWT_AUDIENCE,
          },
        );

      if (
        payload.purpose !==
        "staff-mfa"
      ) {
        throw new UnauthorizedException();
      }

      return payload;
    } catch {
      throw new UnauthorizedException(
        "El desafío MFA expiró. Inicia sesión nuevamente.",
      );
    }
  }
}
