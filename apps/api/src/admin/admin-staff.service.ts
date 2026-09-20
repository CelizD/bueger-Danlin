import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../database/prisma.service.js";
import { CreateStaffUserDto } from "./dto/create-staff-user.dto.js";
import { ResetStaffPasswordDto } from "./dto/reset-staff-password.dto.js";
import { UpdateStaffUserDto } from "./dto/update-staff-user.dto.js";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

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

    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTIONS);

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

    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTIONS);

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
