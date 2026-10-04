import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

export const MAX_PRODUCT_IMAGE_BYTES =
  2 * 1024 * 1024;

export type ProductImageUpload = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function detectedImageMime(
  buffer: Buffer,
) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
      ]),
    )
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") ===
      "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") ===
      "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function productImagePath(
  id: string,
  updatedAt: Date,
  hasImage: boolean,
) {
  if (!hasImage) return null;

  return `/catalog/products/${encodeURIComponent(
    id,
  )}/image?v=${updatedAt.getTime()}`;
}

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async list() {
    const products =
      await this.prisma.product.findMany({
        orderBy: [
          { type: "asc" },
          { createdAt: "asc" },
        ],
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          type: true,
          priceCents: true,
          active: true,
          imageMimeType: true,
          updatedAt: true,
        },
      });

    return products.map((product) => ({
      ...product,
      imagePath: productImagePath(
        product.id,
        product.updatedAt,
        Boolean(product.imageMimeType),
      ),
    }));
  }

  async uploadImage(
    id: string,
    file: ProductImageUpload | undefined,
    actorUserId: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        "Selecciona una imagen.",
      );
    }

    if (
      file.size <= 0 ||
      file.size > MAX_PRODUCT_IMAGE_BYTES
    ) {
      throw new BadRequestException(
        "La imagen debe pesar como máximo 2 MB.",
      );
    }

    const detected =
      detectedImageMime(file.buffer);

    if (
      !detected ||
      !ALLOWED_MIME_TYPES.has(file.mimetype) ||
      detected !== file.mimetype
    ) {
      throw new BadRequestException(
        "Solo se permiten imágenes JPEG, PNG o WebP válidas.",
      );
    }

    const existing =
      await this.prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          imageMimeType: true,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        "El producto no existe.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          imageData: Uint8Array.from(
            file.buffer,
          ),
          imageMimeType: detected,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "PRODUCT_IMAGE_UPDATED",
          entityType: "Product",
          entityId: id,
          before: {
            hasImage:
              Boolean(
                existing.imageMimeType,
              ),
            imageMimeType:
              existing.imageMimeType,
          },
          after: {
            hasImage: true,
            imageMimeType: detected,
            sizeBytes: file.size,
          },
        },
      });
    });

    return {
      ok: true,
      productId: id,
      name: existing.name,
    };
  }

  async removeImage(
    id: string,
    actorUserId: string,
  ) {
    const existing =
      await this.prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          imageMimeType: true,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        "El producto no existe.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          imageData: null,
          imageMimeType: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "PRODUCT_IMAGE_REMOVED",
          entityType: "Product",
          entityId: id,
          before: {
            hasImage:
              Boolean(
                existing.imageMimeType,
              ),
            imageMimeType:
              existing.imageMimeType,
          },
          after: {
            hasImage: false,
            imageMimeType: null,
          },
        },
      });
    });

    return {
      ok: true,
      productId: id,
      name: existing.name,
    };
  }
}
