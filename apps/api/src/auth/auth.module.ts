import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AccountsModule } from '../accounts/accounts.module';
import { SessionsModule } from '../sessions/sessions.module';
import { OneTimeCodesModule } from '../one-time-codes/one-time-codes.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { GatedDemoController } from './gated-demo.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailVerifiedGuard } from './guards/email-verified.guard';

// The gated-demo route only exists to exercise EmailVerifiedGuard before FAM-01
// ships real gated routes; never register it in production.
const controllers =
  process.env.NODE_ENV === 'production'
    ? [AuthController]
    : [AuthController, GatedDemoController];

@Module({
  imports: [
    AccountsModule,
    SessionsModule,
    OneTimeCodesModule,
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  controllers,
  providers: [AuthService, PasswordService, TokenService, JwtStrategy, EmailVerifiedGuard],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
