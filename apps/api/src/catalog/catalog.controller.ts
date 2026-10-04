import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { CatalogService } from "./catalog.service.js";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list() {
    return this.catalogService.listActiveProducts();
  }

  @Get("products/:id/image")
  async productImage(
    @Param("id") id: string,
    @Res({ passthrough: true })
    response: any,
  ) {
    const image =
      await this.catalogService.productImage(id);

    response.setHeader(
      "content-type",
      image.mimeType,
    );
    response.setHeader(
      "content-length",
      String(image.data.length),
    );
    response.setHeader(
      "cache-control",
      "public, max-age=31536000, immutable",
    );
    response.setHeader(
      "x-content-type-options",
      "nosniff",
    );
    response.setHeader(
      "cross-origin-resource-policy",
      "cross-origin",
    );

    return new StreamableFile(image.data);
  }
}
