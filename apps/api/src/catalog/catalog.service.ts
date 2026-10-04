import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

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
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveProducts() {
    const products =
      await this.prisma.product.findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          type: true,
          priceCents: true,
          active: true,
          trackStock: true,
          stockQuantity: true,
          createdAt: true,
          updatedAt: true,
          imageMimeType: true,
          modifierGroups: {
            orderBy: {
              sortOrder: "asc",
            },
            include: {
              modifierGroup: {
                include: {
                  options: {
                    where: {
                      active: true,
                    },
                    orderBy: {
                      sortOrder:
                        "asc",
                    },
                  },
                },
              },
            },
          },
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

  async productImage(id: string) {
    const product =
      await this.prisma.product.findUnique({
        where: { id },
        select: {
          imageData: true,
          imageMimeType: true,
        },
      });

    if (
      !product?.imageData ||
      !product.imageMimeType
    ) {
      throw new NotFoundException(
        "El producto no tiene imagen.",
      );
    }

    return {
      data: Buffer.from(
        product.imageData,
      ),
      mimeType:
        product.imageMimeType,
    };
  }
}
