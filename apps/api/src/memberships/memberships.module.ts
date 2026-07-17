import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Membership, MembershipSchema } from './membership.schema';
import { MembershipEvent, MembershipEventSchema } from './membership-event.schema';
import { MembershipRepository } from './membership.repository';
import { MembershipEventRepository } from './membership-event.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Membership.name, schema: MembershipSchema },
      { name: MembershipEvent.name, schema: MembershipEventSchema },
    ]),
  ],
  providers: [MembershipRepository, MembershipEventRepository],
  exports: [MembershipRepository, MembershipEventRepository],
})
export class MembershipsModule {}
