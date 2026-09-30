import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { ArcoNotificationService } from "./arco-notification.service.js";
import type {
  ArcoRightInput,
  CreateArcoRequestDto,
} from "./dto/create-arco-request.dto.js";
import type { UpdateArcoRequestDto } from "./dto/update-arco-request.dto.js";

function cleanOptional(
  value: string | undefined,
) {
  const clean = value?.trim();
  return clean || null;
}

function createFolio() {
  const date =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

  return (
    "ARCO-" +
    date +
    "-" +
    randomBytes(4)
      .toString("hex")
      .toUpperCase()
  );
}

function requireConditionalDetails(
  dto: CreateArcoRequestDto,
) {
  const rights =
    new Set<ArcoRightInput>(
      dto.rights,
    );

  if (
    rights.has("RECTIFICATION") &&
    !dto.rectificationDetails?.trim()
  ) {
    throw new BadRequestException(
      "Indica qué datos deseas rectificar y cuál es la corrección solicitada.",
    );
  }

  if (
    rights.has("CANCELLATION") &&
    !dto.cancellationReason?.trim()
  ) {
    throw new BadRequestException(
      "Indica el motivo de la solicitud de cancelación.",
    );
  }

  if (
    rights.has("OPPOSITION") &&
    !dto.oppositionReason?.trim()
  ) {
    throw new BadRequestException(
      "Indica la causa o situación específica que motiva tu oposición.",
    );
  }
}

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: ArcoNotificationService,
  ) {}

  async createArcoRequest(
    dto: CreateArcoRequestDto,
  ) {
    requireConditionalDetails(dto);

    const folio =
      createFolio();
    const now =
      new Date();

    const request =
      await this.prisma.$transaction(
        async (tx) => {
          const created =
            await tx.arcoRequest.create({
              data: {
                folio,
                name:
                  dto.name.trim(),
                email:
                  dto.email
                    .trim()
                    .toLowerCase(),
                phone:
                  cleanOptional(
                    dto.phone,
                  ),
                rights:
                  dto.rights,
                description:
                  dto.description.trim(),
                locatorInfo:
                  cleanOptional(
                    dto.locatorInfo,
                  ),
                rectificationDetails:
                  cleanOptional(
                    dto.rectificationDetails,
                  ),
                cancellationReason:
                  cleanOptional(
                    dto.cancellationReason,
                  ),
                oppositionReason:
                  cleanOptional(
                    dto.oppositionReason,
                  ),
                status:
                  "IDENTITY_VERIFICATION_REQUIRED",
              },
              select: {
                id: true,
                folio: true,
                email: true,
                rights: true,
                status: true,
                createdAt: true,
              },
            });

          await tx.auditLog.create({
            data: {
              action:
                "ARCO_REQUEST_RECEIVED",
              entityType:
                "ArcoRequest",
              entityId:
                created.id,
              after: {
                folio:
                  created.folio,
                rights:
                  created.rights,
                status:
                  created.status,
                receivedAt:
                  now.toISOString(),
              },
            },
          });

          return created;
        },
      );

    void this.notifications
      .notifyReceived({
        folio:
          request.folio,
        requesterEmail:
          request.email,
        rights:
          request.rights,
      });

    return {
      folio:
        request.folio,
      status:
        request.status,
      receivedAt:
        request.createdAt,
      identityVerificationRequired:
        true,
      message:
        "Solicitud recibida. Conserva tu folio. Antes de hacer efectivo el derecho solicitado se verificará tu identidad.",
    };
  }

  listArcoRequests() {
    return this.prisma
      .arcoRequest.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });
  }

  async updateArcoRequest(
    folio: string,
    dto: UpdateArcoRequestDto,
    userId: string,
  ) {
    const existing =
      await this.prisma
        .arcoRequest
        .findUnique({
          where: { folio },
        });

    if (!existing) {
      throw new NotFoundException(
        "La solicitud ARCO no existe.",
      );
    }

    const now =
      new Date();
    const nextStatus =
      dto.status ??
      existing.status;

    const updated =
      await this.prisma
        .arcoRequest
        .update({
          where: { folio },
          data: {
            ...(dto.status
              ? {
                  status:
                    dto.status,
                }
              : {}),
            ...(dto.identityVerified ===
            true
              ? {
                  identityVerifiedAt:
                    existing.identityVerifiedAt ??
                    now,
                }
              : {}),
            ...(dto.adminNote !==
            undefined
              ? {
                  adminNote:
                    dto.adminNote
                      .trim() ||
                    null,
                }
              : {}),
            ...([
              "RESOLVED",
              "DENIED",
            ].includes(
              nextStatus,
            )
              ? {
                  resolvedAt:
                    existing.resolvedAt ??
                    now,
                }
              : {
                  resolvedAt:
                    null,
                }),
          },
        });

    await this.prisma
      .auditLog.create({
        data: {
          userId,
          action:
            "ARCO_REQUEST_UPDATED",
          entityType:
            "ArcoRequest",
          entityId:
            updated.id,
          before: {
            status:
              existing.status,
            identityVerified:
              !!existing
                .identityVerifiedAt,
          },
          after: {
            status:
              updated.status,
            identityVerified:
              !!updated
                .identityVerifiedAt,
          },
        },
      });

    return updated;
  }
}
