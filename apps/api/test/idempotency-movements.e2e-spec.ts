import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { postMovement, countMovements, ownerWithData } from './idempotency-helpers';

/** US1/US2 · Idempotent movement capture (FR-001/002/005/007/011, SC-001/002). */
describe('Idempotent movement capture (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  function body(ctx: { accountId: string; categoryId: string }, amount = 12000): Record<string, unknown> {
    return { type: 'expense', amount, date: '2026-07-10', accountId: ctx.accountId, categoryId: ctx.categoryId };
  }

  it('replays the same movement on retry, never duplicating (SC-001)', async () => {
    const ctx = await ownerWithData(app, mail, 'idem-mov@example.com');
    const token = ctx.owner.accessToken;

    const first = await postMovement(app, token, body(ctx), 'k-mov-1');
    expect(first.status).toBe(201);
    const id = first.body.movementId as string;

    for (let i = 0; i < 3; i += 1) {
      const replay = await postMovement(app, token, body(ctx), 'k-mov-1');
      expect(replay.status).toBe(201);
      expect(replay.body.movementId).toBe(id);
      expect(replay.headers['idempotent-replayed']).toBe('true');
    }
    expect(await countMovements(app, token)).toBe(1);
  });

  it('creates M distinct movements for M distinct keys; replaying all leaves M (SC-002)', async () => {
    const ctx = await ownerWithData(app, mail, 'idem-batch@example.com');
    const token = ctx.owner.accessToken;
    const keys = ['b1', 'b2', 'b3'];

    for (const k of keys) {
      expect((await postMovement(app, token, body(ctx), k)).status).toBe(201);
    }
    // Replay every queued item.
    for (const k of keys) {
      expect((await postMovement(app, token, body(ctx), k)).status).toBe(201);
    }
    expect(await countMovements(app, token)).toBe(keys.length);
  });

  it('behaves as today without a key, and rejects a malformed key (FR-005/011)', async () => {
    const ctx = await ownerWithData(app, mail, 'idem-nokey@example.com');
    const token = ctx.owner.accessToken;

    expect((await postMovement(app, token, body(ctx))).status).toBe(201);
    expect((await postMovement(app, token, body(ctx))).status).toBe(201); // no key → two movements
    expect(await countMovements(app, token)).toBe(2);

    expect((await postMovement(app, token, body(ctx), '   ')).status).toBe(400);
    expect((await postMovement(app, token, body(ctx), 'x'.repeat(201))).status).toBe(400);
  });

  it('creates exactly one movement under concurrent identical requests (FR-007)', async () => {
    const ctx = await ownerWithData(app, mail, 'idem-conc@example.com');
    const token = ctx.owner.accessToken;

    const [a, b] = await Promise.all([
      postMovement(app, token, body(ctx), 'k-conc-1'),
      postMovement(app, token, body(ctx), 'k-conc-1'),
    ]);
    // One create (201); the other is a replay (201) or a 409 in-progress — never a second movement.
    expect([a.status, b.status].every((s) => s === 201 || s === 409)).toBe(true);
    expect([a.status, b.status]).toContain(201);
    expect(await countMovements(app, token)).toBe(1);
  });
});
