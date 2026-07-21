import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';
import { createCategory } from './category-helpers';
import { registerVerifiedUser, VerifiedUser } from './family-helpers';

const base = '/api/v1';

/** POST a movement, optionally with an `Idempotency-Key` header. */
export function postMovement(
  app: INestApplication,
  token: string,
  body: Record<string, unknown>,
  key?: string,
): request.Test {
  const req = request(app.getHttpServer())
    .post(`${base}/movements`)
    .set('Authorization', `Bearer ${token}`);
  if (key !== undefined) {
    req.set('Idempotency-Key', key);
  }
  return req.send(body);
}

/** POST a transfer, optionally with an `Idempotency-Key` header. */
export function postTransfer(
  app: INestApplication,
  token: string,
  body: Record<string, unknown>,
  key?: string,
): request.Test {
  const req = request(app.getHttpServer())
    .post(`${base}/transfers`)
    .set('Authorization', `Bearer ${token}`);
  if (key !== undefined) {
    req.set('Idempotency-Key', key);
  }
  return req.send(body);
}

/** Count the family's movements. */
export async function countMovements(app: INestApplication, token: string): Promise<number> {
  const res = await request(app.getHttpServer())
    .get(`${base}/movements`)
    .set('Authorization', `Bearer ${token}`);
  return (res.body as unknown[]).length;
}

export interface MovementSetup {
  owner: VerifiedUser;
  accountId: string;
  accountBId: string;
  categoryId: string;
}

/** A verified Owner with two accounts and one expense category (for movements + transfers). */
export async function ownerWithData(
  app: INestApplication,
  mail: MailCollector,
  email: string,
): Promise<MovementSetup> {
  const owner = await verifiedMemberWithFamily(app, mail, email);
  const token = owner.accessToken;
  const a = await createAccount(app, token, {
    name: 'Efectivo',
    type: 'cash',
    initialBalance: 500000,
    startDate: '2026-07-01',
  });
  const b = await createAccount(app, token, {
    name: 'Banco',
    type: 'bank',
    initialBalance: 500000,
    startDate: '2026-07-01',
  });
  const category = await createCategory(app, token, { name: 'Alimentación', kind: 'expense' });
  return {
    owner,
    accountId: a.body.accountId as string,
    accountBId: b.body.accountId as string,
    categoryId: category.body.categoryId as string,
  };
}

/** An Owner (verified, with family) plus one joined non-owner Member of the same family. */
export async function familyWithMember(
  app: INestApplication,
  mail: MailCollector,
  prefix: string,
): Promise<{ owner: VerifiedUser; member: VerifiedUser }> {
  const http = app.getHttpServer();
  const owner = await verifiedMemberWithFamily(app, mail, `${prefix}-owner@example.com`);
  const invite = await request(http)
    .post(`${base}/families/me/invites`)
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .send();
  const member = await registerVerifiedUser(app, mail, `${prefix}-member@example.com`);
  await request(http)
    .post(`${base}/families/join`)
    .set('Authorization', `Bearer ${member.accessToken}`)
    .send({ code: invite.body.code as string });
  return { owner, member };
}
