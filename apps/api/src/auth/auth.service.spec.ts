import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AccountRepository } from '../accounts/account.repository';
import { RefreshSessionRepository } from '../sessions/refresh-session.repository';
import { OneTimeCodeService } from '../one-time-codes/one-time-code.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import type { MailPort } from '../mail/mail.port';

describe('AuthService.register duplicate handling (US1)', () => {
  function buildService(createImpl: () => Promise<never>) {
    const accounts = {
      existsByEmail: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockImplementation(createImpl),
    } as unknown as AccountRepository;
    const sessions = {} as unknown as RefreshSessionRepository;
    const passwords = { hash: jest.fn().mockResolvedValue('hashed') } as unknown as PasswordService;
    const tokens = {} as unknown as TokenService;
    const codes = { issue: jest.fn().mockResolvedValue('123456') } as unknown as OneTimeCodeService;
    const mail: MailPort = { send: jest.fn().mockResolvedValue(undefined) };
    return new AuthService(accounts, sessions, passwords, tokens, codes, mail);
  }

  it('translates a Mongo duplicate-key error (E11000) into a non-committal 409', async () => {
    const service = buildService(() =>
      Promise.reject(Object.assign(new Error('E11000 duplicate key'), { code: 11000 })),
    );
    await expect(service.register('dup@example.com', 'strongpassword1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rethrows non-duplicate errors unchanged', async () => {
    const service = buildService(() => Promise.reject(new Error('connection lost')));
    await expect(service.register('x@example.com', 'strongpassword1')).rejects.toThrow(
      'connection lost',
    );
  });
});
