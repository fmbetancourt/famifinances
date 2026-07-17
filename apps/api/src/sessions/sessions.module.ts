import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RefreshSession, RefreshSessionSchema } from './refresh-session.schema';
import { RefreshSessionRepository } from './refresh-session.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RefreshSession.name, schema: RefreshSessionSchema }]),
  ],
  providers: [RefreshSessionRepository],
  exports: [RefreshSessionRepository],
})
export class SessionsModule {}
