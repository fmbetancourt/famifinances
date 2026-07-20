import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';
import { createCategory } from './category-helpers';
import { registerVerifiedUser, VerifiedUser } from './family-helpers';

/** Sets (creates/updates) a budget allocation and returns the response. */
export function setBudget(
  app: INestApplication,
  token: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/api/v1/budgets')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/** Gets the budget report for a period (default current month) and returns the response. */
export function getReport(
  app: INestApplication,
  token: string,
  period?: string,
): Promise<request.Response> {
  const query = period ? `?period=${period}` : '';
  return request(app.getHttpServer())
    .get(`/api/v1/budgets${query}`)
    .set('Authorization', `Bearer ${token}`);
}

/** Removes a budget allocation by id and returns the response. */
export function deleteBudget(
  app: INestApplication,
  token: string,
  budgetId: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .delete(`/api/v1/budgets/${budgetId}`)
    .set('Authorization', `Bearer ${token}`);
}

export interface OwnerSetup {
  owner: VerifiedUser;
  accountId: string;
  expenseCategoryId: string;
}

/** A verified Owner with a family, one active account, and one custom expense category. */
export async function ownerWithExpenseCategory(
  app: INestApplication,
  mail: MailCollector,
  email: string,
): Promise<OwnerSetup> {
  const owner = await verifiedMemberWithFamily(app, mail, email);
  const account = await createAccount(app, owner.accessToken, {
    name: 'Cuenta',
    type: 'bank',
    initialBalance: 500000,
    startDate: '2026-07-01',
  });
  const category = await createCategory(app, owner.accessToken, {
    name: 'Alimentación',
    kind: 'expense',
  });
  return {
    owner,
    accountId: account.body.accountId as string,
    expenseCategoryId: category.body.categoryId as string,
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
    .post('/api/v1/families/me/invites')
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .send();
  const member = await registerVerifiedUser(app, mail, `${prefix}-member@example.com`);
  await request(http)
    .post('/api/v1/families/join')
    .set('Authorization', `Bearer ${member.accessToken}`)
    .send({ code: invite.body.code });
  return { owner, member };
}
