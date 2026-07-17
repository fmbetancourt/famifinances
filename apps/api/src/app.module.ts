import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { THROTTLE } from './config/security';
import { DatabaseModule } from './database/database.module';
import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { FamiliesModule } from './families/families.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Baseline rate limiting (FR-013/FR-026); per-route overrides added per story.
    // @nestjs/throttler v6 expects `ttl` in milliseconds, matching THROTTLE.ttlMs.
    ThrottlerModule.forRoot([{ ttl: THROTTLE.ttlMs, limit: THROTTLE.limit }]),
    DatabaseModule,
    AccountsModule,
    MailModule,
    AuthModule,
    FamiliesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
