import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invitation, InvitationSchema } from './invitation.schema';
import { InvitationService } from './invitation.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Invitation.name, schema: InvitationSchema }])],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationsModule {}
