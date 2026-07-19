import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';
import { VerifiedUser } from './family-helpers';

export interface MemberWithAccount {
  member: VerifiedUser;
  accountId: string;
}

/** A verified member with a family and one active account (default balance 100000). */
export async function setupMemberWithAccount(
  app: INestApplication,
  mail: MailCollector,
  email: string,
  initialBalance = 100000,
): Promise<MemberWithAccount> {
  const member = await verifiedMemberWithFamily(app, mail, email);
  const created = await createAccount(app, member.accessToken, {
    name: 'Cuenta',
    type: 'bank',
    initialBalance,
    startDate: '2026-07-01',
  });
  return { member, accountId: created.body.accountId };
}

/** Records a movement and returns the response. */
export async function recordMovement(
  app: INestApplication,
  token: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/api/v1/movements')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/** The current derived balance of an account. */
export async function accountBalance(
  app: INestApplication,
  token: string,
  accountId: string,
): Promise<number> {
  const res = await request(app.getHttpServer())
    .get(`/api/v1/accounts/${accountId}`)
    .set('Authorization', `Bearer ${token}`);
  return res.body.balance as number;
}
