import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';

/**
 * Polish (T029) · FR-005: a plaintext invite code must never appear in logs.
 * Captures stdout/stderr while an Owner issues a code and an invitee redeems it,
 * then asserts the code does not leak.
 */
describe('No invite codes in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes an invite code to stdout/stderr across issue + join', async () => {
    const server = app.getHttpServer();
    const owner = await registerVerifiedUser(app, mail, 'log-owner@example.com');
    const joiner = await registerVerifiedUser(app, mail, 'log-joiner@example.com');
    await request(server)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Private Family' });

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);

    let code = '';
    try {
      const invite = await request(server)
        .post('/api/v1/families/me/invites')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send();
      code = invite.body.code as string;

      await request(server)
        .post('/api/v1/families/join')
        .set('Authorization', `Bearer ${joiner.accessToken}`)
        .send({ code });
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    const logged = chunks.join('');
    expect(code.length).toBeGreaterThan(0);
    expect(logged).not.toContain(code);
  });
});
