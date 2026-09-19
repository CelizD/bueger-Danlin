import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../database/prisma.service.js";
import { STAFF_SESSION_COOKIE } from "./auth.constants.js";
import type { StaffRequest, StaffSession } from "./auth.types.js";

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const token = request.cookies?.[STAFF_SESSION_COOKIE];

    if (!token) {
      throw new UnauthorizedException("Inicia sesión para continuar.");
    }

    try {
      const payload = await this.jwtService.verifyAsync<StaffSession>(token);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
        },
      });

      if (!user?.active) {
        throw new UnauthorizedException();
      }

      request.user = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        iat: payload.iat,
        exp: payload.exp,
      };

      return true;
    } catch {
      throw new UnauthorizedException("Sesión inválida o expirada.");
    }
  }
}
