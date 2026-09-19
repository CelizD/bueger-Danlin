import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.API_PORT ?? 4000);
  const prefix = process.env.API_PREFIX ?? "api/v1";

  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: ["http://localhost:3000"],
    credentials: true,
  });

  await app.listen(port);
}

void bootstrap();
