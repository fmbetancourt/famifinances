import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createTestApp } from './create-test-app';

/**
 * OpenAPI ↔ implementation parity for the DASH-01 surface. The hand-written contract
 * (specs/009-dashboard/contracts/dashboard.openapi.yaml) and the generated document must
 * expose exactly the same set of `dashboard` endpoints.
 */
describe('Dashboard OpenAPI parity', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  function normalize(path: string): string {
    const idx = path.indexOf('dashboard');
    return idx === -1 ? path : path.slice(idx);
  }

  function contractEndpoints(): Set<string> {
    const file = resolve(__dirname, '../../../specs/009-dashboard/contracts/dashboard.openapi.yaml');
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
      if (!normalized.startsWith('dashboard')) {
        continue;
      }
      for (const method of Object.keys(item as Record<string, unknown>)) {
        endpoints.add(`${method.toUpperCase()} ${normalized}`);
      }
    }
    return endpoints;
  }

  it('exposes exactly the dashboard endpoints declared in the contract', () => {
    const contract = contractEndpoints();
    const generated = generatedEndpoints();

    expect(contract.size).toBe(1);

    const missing = [...contract].filter((e) => !generated.has(e));
    const undocumented = [...generated].filter((e) => !contract.has(e));

    expect(missing).toEqual([]);
    expect(undocumented).toEqual([]);
  });
});
