import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { BODY_LIMIT } from './config/security';

export async function createApp() {
  // Disable Nest's default body parser so we can apply the configurable size limit
  // (SEC-01 FR-003): an oversized JSON body is rejected with 413 before the handler.
  const app = await NestFactory.create(AppModule, { bufferLogs: false, bodyParser: false });
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));

  configureApp(app);
  return app;
}

async function bootstrap() {
  const app = await createApp();

  const config = new DocumentBuilder()
    .setTitle('FamiFinances Auth API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

// Only bootstrap when run directly (tests import createApp instead).
if (require.main === module) {
  void bootstrap();
}
