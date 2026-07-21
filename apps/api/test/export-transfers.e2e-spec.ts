import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { exportTransfers, ownerWithData, parseCsv } from './export-helpers';

const TRANSFER_HEADER = ['Fecha', 'Cuenta origen', 'Cuenta destino', 'Monto', 'Autor', 'Creado'];

/** US3 · Export transfers to CSV (FR-007). */
describe('Export transfers (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('exports the family transfers with origin/destination names and author email', async () => {
    const data = await ownerWithData(app, mail, 'exp-tra@example.com');
    const res = await exportTransfers(app, data.owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const rows = parseCsv(res.text);
    expect(rows[0]).toEqual(TRANSFER_HEADER);
    expect(rows).toHaveLength(2); // header + 1 transfer
    expect(rows[1]).toMatchObject({
      1: 'Efectivo', // origin
      2: 'Banco', // destination
      3: '50000',
      4: 'exp-tra@example.com',
    });
  });

  it('returns a header-only file when there are no transfers', async () => {
    const empty = await verifiedMemberWithFamily(app, mail, 'exp-tra-empty@example.com');
    const res = await exportTransfers(app, empty.accessToken);
    expect(parseCsv(res.text)).toEqual([TRANSFER_HEADER]);
  });
});
