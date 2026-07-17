import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { UniformErrorFilter } from './common/filters/uniform-error.filter';
import { LoggingInterceptor } from './common/logging/logging.interceptor';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Server-side validation for every request (FR-017): reject unknown fields.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new UniformErrorFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

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
