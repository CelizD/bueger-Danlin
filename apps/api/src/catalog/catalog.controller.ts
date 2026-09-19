import { Controller, Get } from "@nestjs/common";
import { CatalogService } from "./catalog.service.js";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list() {
    return this.catalogService.listActiveProducts();
  }
}
