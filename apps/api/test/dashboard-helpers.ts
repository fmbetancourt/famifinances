import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** Gets the dashboard for a period (default current month) and returns the response. */
export function getDashboard(
  app: INestApplication,
  token: string,
  period?: string,
): Promise<request.Response> {
  const query = period ? `?period=${period}` : '';
  return request(app.getHttpServer())
    .get(`/api/v1/dashboard${query}`)
    .set('Authorization', `Bearer ${token}`);
}
