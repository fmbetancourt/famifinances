import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailMessage, MailPort } from '../mail.port';

/**
 * Development mail adapter: logs message metadata only (recipient, subject, body
 * length) — never the OTP (FR-027) — instead of sending. It is currently wired
 * unconditionally in MailModule; a production adapter selected by
 * MAIL_PROVIDER_API_KEY (Resend — research R5) is a pilot-launch task.
 *
 * DEV-ONLY escape hatch: when `MAIL_DEV_LOG_OTP=true`, it also logs the full body
 * (including the OTP) so a developer can complete email verification against the
 * stub locally. This deliberately overrides FR-027 for debugging and is hard-blocked
 * whenever `NODE_ENV=production`, so it can never leak an OTP in a real deployment.
 */
@Injectable()
export class StubMailAdapter implements MailPort {
  private readonly logger = new Logger('MailStub');

  constructor(private readonly config: ConfigService) {}

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      `stub mail → ${message.to} · "${message.subject}" (${message.body.length} chars)`,
    );

    if (this.shouldLogOtp()) {
      this.logger.warn(`[DEV OTP — do not enable in production] ${message.body}`);
    }
  }

  /** True only outside production and when the dev opt-in flag is explicitly 'true'. */
  private shouldLogOtp(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return this.config.get<string>('MAIL_DEV_LOG_OTP') === 'true';
  }
}
