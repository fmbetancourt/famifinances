import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StubMailAdapter } from './stub-mail.adapter';
import type { MailMessage } from '../mail.port';

/**
 * Guards the dev-only OTP escape hatch: the stub must never surface the OTP unless the
 * operator explicitly opts in via MAIL_DEV_LOG_OTP, and must hard-refuse in production
 * even then (FR-027).
 */
describe('StubMailAdapter', () => {
  const message: MailMessage = {
    to: 'user@example.com',
    subject: 'Verify your FamiFinances email',
    body: 'Your FamiFinances verification code is 123456. It expires shortly.',
  };
  const originalNodeEnv = process.env.NODE_ENV;

  function makeAdapter(flag: string | undefined): StubMailAdapter {
    const config = { get: jest.fn().mockReturnValue(flag) } as unknown as ConfigService;
    return new StubMailAdapter(config);
  }

  let warn: jest.SpyInstance;
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('always logs metadata without the OTP body', async () => {
    process.env.NODE_ENV = 'development';
    await makeAdapter('false').send(message);

    expect(log).toHaveBeenCalledWith(expect.stringContaining('stub mail → user@example.com'));
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('123456'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not log the OTP when the flag is absent (secure default)', async () => {
    process.env.NODE_ENV = 'development';
    await makeAdapter(undefined).send(message);

    expect(warn).not.toHaveBeenCalled();
  });

  it('logs the OTP body when MAIL_DEV_LOG_OTP=true outside production', async () => {
    process.env.NODE_ENV = 'development';
    await makeAdapter('true').send(message);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('123456'));
  });

  it('never logs the OTP in production even when the flag is true', async () => {
    process.env.NODE_ENV = 'production';
    await makeAdapter('true').send(message);

    expect(warn).not.toHaveBeenCalled();
  });
});
