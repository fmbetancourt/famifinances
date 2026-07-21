import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { exportMovements, exportTransfers, ownerWithData, parseCsv } from './export-helpers';

/** Polish · Family isolation — an export contains only the caller's family rows (Principle I, FR-004). */
describe('Export isolation (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never includes another family rows in movements or transfers', async () => {
    const f1 = await ownerWithData(app, mail, 'iso-f1@example.com');
    const f2 = await ownerWithData(app, mail, 'iso-f2@example.com');

    // F2's export has only F2's data — no F1 author email, no F1 amounts.
    const movements = await exportMovements(app, f2.owner.accessToken);
    expect(movements.text).not.toContain('iso-f1@example.com');
    expect(parseCsv(movements.text)).toHaveLength(3); // header + F2's 2 movements

    const transfers = await exportTransfers(app, f2.owner.accessToken);
    expect(transfers.text).not.toContain('iso-f1@example.com');
    expect(parseCsv(transfers.text)).toHaveLength(2); // header + F2's 1 transfer

    // Sanity: F1's own export still contains F1's email.
    const f1Movements = await exportMovements(app, f1.owner.accessToken);
    expect(f1Movements.text).toContain('iso-f1@example.com');
  });
});
