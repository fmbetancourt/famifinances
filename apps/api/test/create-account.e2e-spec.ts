import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';

/** US1 · Create a family-scoped financial account (FR-001, FR-011, FR-012, FR-013). */
describe('Create account (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  const valid = {
    name: 'Cuenta Santander',
    type: 'bank',
    institution: 'Santander',
    initialBalance: 150000,
    startDate: '2026-07-01',
  };

  it('creates an account for a verified member (201) with a derived balance', async () => {
    const member = await verifiedMemberWithFamily(app, mail, 'acc-owner@example.com');

    const res = await createAccount(app, member.accessToken, valid);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Cuenta Santander',
      type: 'bank',
      institution: 'Santander',
      initialBalance: 150000,
      balance: 150000, // derived == initial (no movements yet)
      currency: 'CLP',
      startDate: '2026-07-01',
      archived: false,
    });
    expect(typeof res.body.accountId).toBe('string');
  });

  it('accepts a negative initial balance (credit card debt)', async () => {
    const member = await verifiedMemberWithFamily(app, mail, 'acc-neg@example.com');

    const res = await createAccount(app, member.accessToken, {
      name: 'Tarjeta',
      type: 'credit_card',
      initialBalance: -80000,
      startDate: '2026-07-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.initialBalance).toBe(-80000);
    expect(res.body.balance).toBe(-80000);
  });

  it('blocks an unverified account from creating an account (403 soft gate)', async () => {
    const email = 'acc-unverified@example.com';
    const http = app.getHttpServer();
    await request(http).post('/api/v1/auth/register').send({ email, password: 'strongpassword1' });
    const token = (
      await request(http).post('/api/v1/auth/login').send({ email, password: 'strongpassword1' })
    ).body.accessToken as string;

    const res = await createAccount(app, token, valid);
    expect(res.status).toBe(403);
  });

  it('rejects a verified member who belongs to no family (404)', async () => {
    const member = await registerVerifiedUser(app, mail, 'acc-nofamily@example.com');

    const res = await createAccount(app, member.accessToken, valid);
    expect(res.status).toBe(404);
  });

  it('rejects invalid input: unknown type, empty name, fractional amount (400)', async () => {
    const member = await verifiedMemberWithFamily(app, mail, 'acc-invalid@example.com');

    for (const bad of [
      { ...valid, type: 'crypto' },
      { ...valid, name: '' },
      { ...valid, initialBalance: 1000.5 },
    ]) {
      const res = await createAccount(app, member.accessToken, bad);
      expect(res.status).toBe(400);
    }
  });

  it('rejects a client-supplied balance or currency field (400, whitelist guards SC-004/FR-004)', async () => {
    const member = await verifiedMemberWithFamily(app, mail, 'acc-whitelist@example.com');

    const withBalance = await createAccount(app, member.accessToken, { ...valid, balance: 999999 });
    expect(withBalance.status).toBe(400);

    const withCurrency = await createAccount(app, member.accessToken, { ...valid, currency: 'USD' });
    expect(withCurrency.status).toBe(400);
  });
});
