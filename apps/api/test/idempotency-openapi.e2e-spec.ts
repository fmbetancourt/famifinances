import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createTestApp } from './create-test-app';

/** Polish · FR-010 — the served OpenAPI documents the Idempotency-Key header on both creates. */
describe('Idempotency OpenAPI (Polish)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  function headerNamesFor(path: string): string[] {
    const config = new DocumentBuilder().setTitle('idem').setVersion('1.0.0').build();
    const doc = SwaggerModule.createDocument(app, config);
    const entry = Object.entries(doc.paths).find(([p]) => p.endsWith(path));
    const post = entry?.[1]?.post as { parameters?: { in: string; name: string }[] } | undefined;
    return (post?.parameters ?? []).filter((p) => p.in === 'header').map((p) => p.name);
  }

  it('documents Idempotency-Key on POST /movements and POST /transfers', () => {
    expect(headerNamesFor('/movements')).toContain('Idempotency-Key');
    expect(headerNamesFor('/transfers')).toContain('Idempotency-Key');
  });
});
