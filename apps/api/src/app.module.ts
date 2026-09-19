import { Module } from "@nestjs/common";
import { CatalogModule } from "./catalog/catalog.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  imports: [DatabaseModule, CatalogModule],
  controllers: [HealthController],
})
export class AppModule {}
