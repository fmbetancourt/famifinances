import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { UniformErrorFilter } from '../src/common/filters/uniform-error.filter';
import { MAIL_PORT, MailMessage, MailPort } from '../src/mail/mail.port';

async function buildApp(builder: TestingModuleBuilder): Promise<INestApplication> {
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new UniformErrorFilter());
  await app.init();
  return app;
}

/** Builds a fully-configured Nest app for e2e tests (mirrors createApp in main.ts). */
export function createTestApp(): Promise<INestApplication> {
  return buildApp(Test.createTestingModule({ imports: [AppModule] }));
}

/** Test double for MailPort that captures messages so tests can read the OTP. */
export class MailCollector implements MailPort {
  readonly messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }

  /** Extracts the latest 6-digit code delivered to `email`, or null. */
  lastCodeFor(email: string): string | null {
    const message = [...this.messages].reverse().find((m) => m.to === email);
    return message?.body.match(/[0-9]{6}/)?.[0] ?? null;
  }
}

/** Builds the app with MailPort replaced by a collector (for OTP-driven tests). */
export async function createTestAppWithMail(): Promise<{
  app: INestApplication;
  mail: MailCollector;
}> {
  const mail = new MailCollector();
  const app = await buildApp(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL_PORT)
      .useValue(mail),
  );
  return { app, mail };
}
