import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { STAFF_ROLES_KEY } from "./roles.decorator.js";
import type { StaffRequest, StaffRole } from "./auth.types.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<StaffRole[]>(
      STAFF_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<StaffRequest>();
    const role = request.user?.role;

    if (!role || !roles.includes(role)) {
      throw new ForbiddenException("No tienes acceso a esta operación.");
    }

    return true;
  }
}
