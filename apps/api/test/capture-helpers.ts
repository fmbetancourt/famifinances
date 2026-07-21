import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';
import { createCategory } from './category-helpers';
import { registerVerifiedUser, VerifiedUser } from './family-helpers';

const base = '/api/v1';

/** Creates a movement template and returns the response. */
export function createTemplate(
  app: INestApplication,
  token: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post(`${base}/capture-templates`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/** Lists the family's templates and returns the response. */
export function listTemplates(app: INestApplication, token: string): Promise<request.Response> {
  return request(app.getHttpServer())
    .get(`${base}/capture-templates`)
    .set('Authorization', `Bearer ${token}`);
}

/** Gets one template by id and returns the response. */
export function getTemplate(
  app: INestApplication,
  token: string,
  templateId: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .get(`${base}/capture-templates/${templateId}`)
    .set('Authorization', `Bearer ${token}`);
}

/** Updates a template by id and returns the response. */
export function updateTemplate(
  app: INestApplication,
  token: string,
  templateId: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .patch(`${base}/capture-templates/${templateId}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/** Deletes a template by id and returns the response. */
export function deleteTemplate(
  app: INestApplication,
  token: string,
  templateId: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .delete(`${base}/capture-templates/${templateId}`)
    .set('Authorization', `Bearer ${token}`);
}

/** Gets the caller's capture defaults and returns the response. */
export function getCaptureDefaults(app: INestApplication, token: string): Promise<request.Response> {
  return request(app.getHttpServer())
    .get(`${base}/capture-defaults`)
    .set('Authorization', `Bearer ${token}`);
}

/** Archives an account (to test broken-reference degradation). */
export function archiveAccount(
  app: INestApplication,
  token: string,
  accountId: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post(`${base}/accounts/${accountId}/archive`)
    .set('Authorization', `Bearer ${token}`);
}

/** Archives a custom category (to test broken-reference degradation). */
export function archiveCategory(
  app: INestApplication,
  token: string,
  categoryId: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post(`${base}/categories/${categoryId}/archive`)
    .set('Authorization', `Bearer ${token}`);
}

export interface CaptureSetup {
  owner: VerifiedUser;
  accountId: string;
  expenseCategoryId: string;
  incomeCategoryId: string;
}

/** A verified Owner with a family, one active account, and one expense + one income category. */
export async function ownerWithAccountAndCategories(
  app: INestApplication,
  mail: MailCollector,
  email: string,
): Promise<CaptureSetup> {
  const owner = await verifiedMemberWithFamily(app, mail, email);
  const account = await createAccount(app, owner.accessToken, {
    name: 'Efectivo',
    type: 'cash',
    initialBalance: 50000,
    startDate: '2026-07-01',
  });
  const expense = await createCategory(app, owner.accessToken, {
    name: 'Alimentación',
    kind: 'expense',
  });
  const income = await createCategory(app, owner.accessToken, {
    name: 'Sueldo',
    kind: 'income',
  });
  return {
    owner,
    accountId: account.body.accountId as string,
    expenseCategoryId: expense.body.categoryId as string,
    incomeCategoryId: income.body.categoryId as string,
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
