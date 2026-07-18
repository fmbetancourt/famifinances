import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export interface CategoryLite {
  categoryId: string;
  name: string;
  kind: string;
  scope: string;
  archived: boolean;
}

/** Creates a custom category for a member and returns the response. */
export async function createCategory(
  app: INestApplication,
  token: string,
  body: { name: string; kind: string },
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/api/v1/categories')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/** Lists categories (optionally with query) and returns the array body. */
export async function listCategories(
  app: INestApplication,
  token: string,
  query = '',
): Promise<CategoryLite[]> {
  const res = await request(app.getHttpServer())
    .get(`/api/v1/categories${query}`)
    .set('Authorization', `Bearer ${token}`);
  return res.body as CategoryLite[];
}

/** Returns the id of one system-default category (of the given kind, if provided). */
export async function aSystemCategoryId(
  app: INestApplication,
  token: string,
  kind?: string,
): Promise<string> {
  const all = await listCategories(app, token);
  const match = all.find((c) => c.scope === 'system' && (kind ? c.kind === kind : true));
  return match!.categoryId;
}
