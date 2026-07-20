import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** Gets the movement history with a raw query string (e.g. `?from=2026-07-01&type=expense`). */
export function getHistory(
  app: INestApplication,
  token: string,
  query = '',
): Promise<request.Response> {
  return request(app.getHttpServer())
    .get(`/api/v1/history${query}`)
    .set('Authorization', `Bearer ${token}`);
}
