import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsModule } from '../accounts/accounts.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { Family, FamilySchema } from './family.schema';
import { FamilyRepository } from './family.repository';
import { FamiliesService } from './families.service';
import { FamiliesController } from './families.controller';
import { FamilyScopeGuard } from './guards/family-scope.guard';
import { FamilyRoleGuard } from './guards/family-role.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Family.name, schema: FamilySchema }]),
    AccountsModule,
    MembershipsModule,
    InvitationsModule,
  ],
  controllers: [FamiliesController],
  providers: [FamilyRepository, FamiliesService, FamilyScopeGuard, FamilyRoleGuard],
  // Export the Principle-I scope guard (+ its MembershipsModule dep) so downstream
  // feature modules (ACC-01, TXN-01, …) reuse the family boundary rather than re-derive it.
  // FamilyRoleGuard is exported for owner-only writes (BUD-01 is its first external consumer).
  exports: [FamilyScopeGuard, FamilyRoleGuard, MembershipsModule],
})
export class FamiliesModule {}
