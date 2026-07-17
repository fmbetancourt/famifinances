import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailCollector } from './create-test-app';

export interface VerifiedUser {
  email: string;
  accessToken: string;
}

/**
 * Registers an account, reads its OTP from the mail collector, verifies the
 * email, and returns a fresh (email-verified) access token. Family/join routes
 * require a verified session, so tests need this end-to-end setup.
 */
export async function registerVerifiedUser(
  app: INestApplication,
  mail: MailCollector,
  email: string,
  password = 'strongpassword1',
): Promise<VerifiedUser> {
  const http = app.getHttpServer();
  await request(http).post('/api/v1/auth/register').send({ email, password });
  const code = mail.lastCodeFor(email) as string;

  const accessToken = (
    await request(http).post('/api/v1/auth/login').send({ email, password })
  ).body.accessToken as string;

  // EmailVerifiedGuard reads emailVerified from a fresh account read on every
  // request, so this same token is authoritative once the email is verified.
  await request(http)
    .post('/api/v1/auth/email/verify')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ code });

  return { email, accessToken };
}
