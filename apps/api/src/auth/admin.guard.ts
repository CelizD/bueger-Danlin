import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { StaffRequest } from "./auth.types.js";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<StaffRequest>();

    if (request.user?.role !== "ADMIN") {
      throw new ForbiddenException("Solo un administrador puede acceder.");
    }

    return true;
  }
}
