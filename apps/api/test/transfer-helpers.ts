import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';
import { VerifiedUser } from './family-helpers';

export interface TwoAccounts {
  member: VerifiedUser;
  accountA: string;
  accountB: string;
}

/** A verified member with a family and two active accounts (default balances A=100000, B=20000). */
export async function setupTwoAccounts(
  app: INestApplication,
  mail: MailCollector,
  email: string,
  balanceA = 100000,
  balanceB = 20000,
): Promise<TwoAccounts> {
  const member = await verifiedMemberWithFamily(app, mail, email);
  const a = await createAccount(app, member.accessToken, {
    name: 'Cuenta A',
    type: 'bank',
    initialBalance: balanceA,
    startDate: '2026-07-01',
  });
  const b = await createAccount(app, member.accessToken, {
    name: 'Cuenta B',
    type: 'cash',
    initialBalance: balanceB,
    startDate: '2026-07-01',
  });
  return { member, accountA: a.body.accountId, accountB: b.body.accountId };
}

/** Records a transfer and returns the response. */
export async function recordTransfer(
  app: INestApplication,
  token: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/api/v1/transfers')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}
