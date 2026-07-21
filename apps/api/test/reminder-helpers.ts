import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { registerVerifiedUser, VerifiedUser } from './family-helpers';

const base = '/api/v1';

/** Creates a reminder and returns the response. */
export function createReminder(
  app: INestApplication,
  token: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post(`${base}/reminders`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/** Lists the caller's reminders and returns the response. */
export function listReminders(app: INestApplication, token: string): Promise<request.Response> {
  return request(app.getHttpServer())
    .get(`${base}/reminders`)
    .set('Authorization', `Bearer ${token}`);
}

/** Gets one reminder by id and returns the response. */
export function getReminder(
  app: INestApplication,
  token: string,
  reminderId: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .get(`${base}/reminders/${reminderId}`)
    .set('Authorization', `Bearer ${token}`);
}

/** Updates a reminder by id and returns the response. */
export function updateReminder(
  app: INestApplication,
  token: string,
  reminderId: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .patch(`${base}/reminders/${reminderId}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/** Deletes a reminder by id and returns the response. */
export function deleteReminder(
  app: INestApplication,
  token: string,
  reminderId: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .delete(`${base}/reminders/${reminderId}`)
    .set('Authorization', `Bearer ${token}`);
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
