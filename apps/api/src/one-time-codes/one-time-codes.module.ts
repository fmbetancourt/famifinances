import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OneTimeCode, OneTimeCodeSchema } from './one-time-code.schema';
import { OneTimeCodeRepository } from './one-time-code.repository';
import { OneTimeCodeService } from './one-time-code.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: OneTimeCode.name, schema: OneTimeCodeSchema }]),
  ],
  providers: [OneTimeCodeRepository, OneTimeCodeService],
  exports: [OneTimeCodeService],
})
export class OneTimeCodesModule {}
