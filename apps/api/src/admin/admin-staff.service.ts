import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import {
  hashStaffPassword,
  staffPasswordPolicyIssue,
} from "../auth/password-security.js";
import { Prisma } from "../generated/prisma/client.js";
import { CreateStaffUserDto } from "./dto/create-staff-user.dto.js";
import { ResetStaffPasswordDto } from "./dto/reset-staff-password.dto.js";
import { UpdateStaffUserDto } from "./dto/update-staff-user.dto.js";

@Injectable()
export class AdminStaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.user.findMany({
      orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mfaEnabled: true,
        mfaEnrolledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(dto: CreateStaffUserDto, actorUserId: string) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException("El nombre no puede quedar vacío.");
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Ya existe una cuenta con ese correo.");
    }

    const passwordIssue = staffPasswordPolicyIssue(dto.password);

    if (passwordIssue) {
      throw new BadRequestException(passwordIssue);
    }

    const passwordHash = await hashStaffPassword(dto.password);

    const created = await this.prisma.user.create({
      data: {
        email,
        name,
        role: dto.role,
        active: true,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mfaEnabled: true,
        mfaEnrolledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: "STAFF_USER_CREATED",
        entityType: "User",
        entityId: created.id,
        after: {
          email: created.email,
          name: created.name,
          role: created.role,
          active: created.active,
        },
      },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateStaffUserDto,
    actorUserId: string,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
      },
    });

    if (!target) {
      throw new NotFoundException("La cuenta de personal no existe.");
    }

    if (target.id === actorUserId) {
      if (dto.active === false) {
        throw new ForbiddenException(
          "No puedes desactivar tu propia cuenta.",
        );
      }

      if (dto.role && dto.role !== "ADMIN") {
        throw new ForbiddenException(
          "No puedes quitarte a ti mismo el rol ADMIN.",
        );
      }
    }

    const email =
      dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined;
    const name = dto.name !== undefined ? dto.name.trim() : undefined;

    if (dto.name !== undefined && !name) {
      throw new BadRequestException("El nombre no puede quedar vacío.");
    }

    if (email && email !== target.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException("Ya existe una cuenta con ese correo.");
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email,
        name,
        role: dto.role,
        active: dto.active,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mfaEnabled: true,
        mfaEnrolledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: "STAFF_USER_UPDATED",
        entityType: "User",
        entityId: id,
        before: {
          email: target.email,
          name: target.name,
          role: target.role,
          active: target.active,
        },
        after: {
          email: updated.email,
          name: updated.name,
          role: updated.role,
          active: updated.active,
        },
      },
    });

    return updated;
  }

  async resetMfa(id: string, actorUserId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
      },
    });

    if (!target) {
      throw new NotFoundException("La cuenta de personal no existe.");
    }

    if (target.role !== "ADMIN") {
      throw new BadRequestException(
        "MFA obligatorio solo aplica a cuentas ADMIN.",
      );
    }

    if (target.id === actorUserId) {
      throw new ForbiddenException(
        "No puedes restablecer tu propio MFA desde una sesión activa. Usa un código de recuperación u otro administrador.",
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        mfaRecoveryCodeHashes: Prisma.DbNull,
        mfaLastUsedStep: null,
        mfaEnrolledAt: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: "STAFF_MFA_RESET",
        entityType: "User",
        entityId: id,
        before: {
          email: target.email,
          mfaEnabled: target.mfaEnabled,
        },
        after: {
          mfaEnabled: false,
        },
      },
    });

    return {
      id: target.id,
      email: target.email,
      mfaReset: true,
    };
  }

  async resetPassword(
    id: string,
    dto: ResetStaffPasswordDto,
    actorUserId: string,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
      },
    });

    if (!target) {
      throw new NotFoundException("La cuenta de personal no existe.");
    }

    const passwordIssue = staffPasswordPolicyIssue(dto.password);

    if (passwordIssue) {
      throw new BadRequestException(passwordIssue);
    }

    const passwordHash = await hashStaffPassword(dto.password);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: "STAFF_PASSWORD_RESET",
        entityType: "User",
        entityId: id,
        before: {
          email: target.email,
          role: target.role,
          active: target.active,
        },
        after: {
          passwordChanged: true,
        },
      },
    });

    return {
      id: target.id,
      email: target.email,
      passwordChanged: true,
    };
  }
}
