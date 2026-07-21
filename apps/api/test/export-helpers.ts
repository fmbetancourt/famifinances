import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';
import { createCategory } from './category-helpers';
import { recordMovement } from './movement-helpers';
import { recordTransfer } from './transfer-helpers';
import { registerVerifiedUser, VerifiedUser } from './family-helpers';

const base = '/api/v1';

/** GET the movements CSV (optional query string, e.g. "?from=2026-07-01"). */
export function exportMovements(
  app: INestApplication,
  token: string,
  query = '',
): Promise<request.Response> {
  return request(app.getHttpServer())
    .get(`${base}/export/movements${query}`)
    .set('Authorization', `Bearer ${token}`);
}

/** GET the transfers CSV. */
export function exportTransfers(app: INestApplication, token: string): Promise<request.Response> {
  return request(app.getHttpServer())
    .get(`${base}/export/transfers`)
    .set('Authorization', `Bearer ${token}`);
}

export interface FamilyData {
  owner: VerifiedUser;
  accountAId: string;
  accountBId: string;
  expenseCategoryId: string;
  incomeCategoryId: string;
}

/** A verified Owner with two accounts, an expense + income category, two movements, one transfer. */
export async function ownerWithData(
  app: INestApplication,
  mail: MailCollector,
  email: string,
): Promise<FamilyData> {
  const owner = await verifiedMemberWithFamily(app, mail, email);
  const token = owner.accessToken;
  const accountA = await createAccount(app, token, {
    name: 'Efectivo',
    type: 'cash',
    initialBalance: 100000,
    startDate: '2026-07-01',
  });
  const accountB = await createAccount(app, token, {
    name: 'Banco',
    type: 'bank',
    initialBalance: 200000,
    startDate: '2026-07-01',
  });
  const expense = await createCategory(app, token, { name: 'Alimentación', kind: 'expense' });
  const income = await createCategory(app, token, { name: 'Sueldo', kind: 'income' });
  const data: FamilyData = {
    owner,
    accountAId: accountA.body.accountId as string,
    accountBId: accountB.body.accountId as string,
    expenseCategoryId: expense.body.categoryId as string,
    incomeCategoryId: income.body.categoryId as string,
  };

  await recordMovement(app, token, {
    type: 'expense',
    amount: 12000,
    date: '2026-07-10',
    accountId: data.accountAId,
    categoryId: data.expenseCategoryId,
    note: 'Feria',
  });
  await recordMovement(app, token, {
    type: 'income',
    amount: 900000,
    date: '2026-07-05',
    accountId: data.accountAId,
    categoryId: data.incomeCategoryId,
  });
  await recordTransfer(app, token, {
    amount: 50000,
    date: '2026-07-11',
    fromAccountId: data.accountAId,
    toAccountId: data.accountBId,
  });

  return data;
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

/** RFC-4180 CSV parser (strips the BOM). Returns rows of fields, header included. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i += 1) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
