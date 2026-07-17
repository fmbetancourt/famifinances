import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createTestApp } from './create-test-app';

/**
 * Polish · OpenAPI ↔ implementation parity for the AUTH-01 surface. The
 * hand-written contract (specs/001-user-auth/contracts/auth.openapi.yaml) and the
 * generated document must expose the same set of `auth/` endpoints. Other modules
 * (e.g. families) own their own contract + parity test, so the comparison is
 * scoped to auth routes here. The test-only gated-demo route is excluded via
 * @ApiExcludeController, so it must not appear.
 */
describe('OpenAPI parity (Polish)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  /** Normalizes any path to its `auth/...` suffix so prefixes/versions don't matter. */
  function normalize(path: string): string {
    const idx = path.indexOf('auth/');
    return idx === -1 ? path : path.slice(idx);
  }

  function contractEndpoints(): Set<string> {
    const file = resolve(
      __dirname,
      '../../../specs/001-user-auth/contracts/auth.openapi.yaml',
    );
    const lines = readFileSync(file, 'utf8').split('\n');
    const endpoints = new Set<string>();
    let currentPath: string | null = null;
    for (const line of lines) {
      const pathMatch = line.match(/^ {2}(\/\S+):\s*$/);
      if (pathMatch) {
        currentPath = pathMatch[1];
        continue;
      }
      const methodMatch = line.match(/^ {4}(get|post|put|patch|delete):\s*$/);
      if (methodMatch && currentPath) {
        endpoints.add(`${methodMatch[1].toUpperCase()} ${normalize(currentPath)}`);
      }
    }
    return endpoints;
  }

  function generatedEndpoints(): Set<string> {
    const config = new DocumentBuilder().setTitle('parity').setVersion('1.0.0').build();
    const doc = SwaggerModule.createDocument(app, config);
    const endpoints = new Set<string>();
    for (const [path, item] of Object.entries(doc.paths)) {
      const normalized = normalize(path);
      // Scope parity to the auth surface; other modules own their own contract.
      if (!normalized.startsWith('auth/')) {
        continue;
      }
      for (const method of Object.keys(item as Record<string, unknown>)) {
        endpoints.add(`${method.toUpperCase()} ${normalized}`);
      }
    }
    return endpoints;
  }

  it('exposes exactly the endpoints declared in the contract', () => {
    const contract = contractEndpoints();
    const generated = generatedEndpoints();

    expect(contract.size).toBeGreaterThan(0);

    const missing = [...contract].filter((e) => !generated.has(e));
    const undocumented = [...generated].filter((e) => !contract.has(e));

    expect(missing).toEqual([]);
    expect(undocumented).toEqual([]);
    // The excluded test-only route must not surface.
    expect([...generated]).not.toContain('GET auth/gated-demo');
  });
});
