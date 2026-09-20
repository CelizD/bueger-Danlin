import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../database/prisma.service.js";
import {
  STAFF_JWT_ALGORITHM,
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
  STAFF_SESSION_COOKIE,
} from "./auth.constants.js";
import type {
  StaffRequest,
  StaffSession,
} from "./auth.types.js";
import { credentialVersion } from "./credential-version.js";

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request =
      context.switchToHttp().getRequest<StaffRequest>();
    const token =
      request.cookies?.[STAFF_SESSION_COOKIE];

    if (!token) {
      throw new UnauthorizedException(
        "Inicia sesión para continuar.",
      );
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<StaffSession>(
          token,
          {
            algorithms: [STAFF_JWT_ALGORITHM],
            issuer: STAFF_JWT_ISSUER,
            audience: STAFF_JWT_AUDIENCE,
          },
        );

      const user =
        await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            active: true,
            passwordHash: true,
            mfaEnabled: true,
          },
        });

      if (
        !user?.active ||
        !payload.credentialVersion ||
        payload.credentialVersion !==
          credentialVersion(user.passwordHash) ||
        (user.role === "ADMIN" &&
          !user.mfaEnabled)
      ) {
        throw new UnauthorizedException();
      }

      request.user = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        credentialVersion:
          payload.credentialVersion,
        iat: payload.iat,
        exp: payload.exp,
      };

      return true;
    } catch {
      throw new UnauthorizedException(
        "Sesión inválida o expirada.",
      );
    }
  }
}
