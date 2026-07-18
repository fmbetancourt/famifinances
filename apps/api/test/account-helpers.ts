import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailCollector } from './create-test-app';
import { registerVerifiedUser, VerifiedUser } from './family-helpers';

/**
 * Registers a verified user and creates a family, so the user is a verified
 * member with a family — the precondition for managing financial accounts.
 * Returns the member's access token + email (they are the family's Owner).
 */
export async function verifiedMemberWithFamily(
  app: INestApplication,
  mail: MailCollector,
  email: string,
  familyName = 'Test Family',
): Promise<VerifiedUser> {
  const member = await registerVerifiedUser(app, mail, email);
  await request(app.getHttpServer())
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${member.accessToken}`)
    .send({ name: familyName });
  return member;
}

/** Convenience: creates an account for a member and returns the response body. */
export async function createAccount(
  app: INestApplication,
  token: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/api/v1/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}
