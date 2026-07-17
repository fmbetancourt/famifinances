import { Module } from '@nestjs/common';
import { MAIL_PORT } from './mail.port';
import { StubMailAdapter } from './providers/stub-mail.adapter';

/**
 * Binds the MailPort to an adapter. Only the dev/MVP console stub is wired here.
 * A production adapter (Resend is the documented first choice — research R5) is a
 * pilot-launch task and can replace the stub without touching consumers.
 */
@Module({
  providers: [{ provide: MAIL_PORT, useClass: StubMailAdapter }],
  exports: [MAIL_PORT],
})
export class MailModule {}
