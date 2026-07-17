import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { FamilyDetail, FamilySummary, InviteCodeResponse } from '@famifinances/contracts';
import { AccountRepository } from '../accounts/account.repository';
import { MembershipRepository, isDuplicateKeyError } from '../memberships/membership.repository';
import { MembershipEventRepository } from '../memberships/membership-event.repository';
import { InvitationService } from '../invitations/invitation.service';
import { FamilyRepository } from './family.repository';
import { CurrentFamilyContext } from './types/current-family';

@Injectable()
export class FamiliesService {
  private readonly logger = new Logger('Families');

  constructor(
    private readonly families: FamilyRepository,
    private readonly memberships: MembershipRepository,
    private readonly events: MembershipEventRepository,
    private readonly invitations: InvitationService,
    private readonly accounts: AccountRepository,
  ) {}

  /**
   * US1 · Create a family; caller becomes Owner (FR-001). Rejects if the caller
   * already belongs to a family; the unique membership index is the atomic guard
   * for the concurrent create/join race (E11000 → non-committal 409).
   */
  async createFamily(accountId: string, name: string): Promise<FamilySummary> {
    const alreadyInFamily = new ConflictException('You already belong to a family.');
    if (await this.memberships.findByAccount(accountId)) {
      throw alreadyInFamily;
    }
    const family = await this.families.create(name, accountId);
    try {
      await this.memberships.create({ accountId, familyId: family.id, role: 'owner' });
    } catch (error) {
      // Lost the concurrent create/join race — clean up the orphan family.
      await this.families.deleteById(family.id);
      if (isDuplicateKeyError(error)) {
        throw alreadyInFamily;
      }
      throw error;
    }
    await this.events.append({
      familyId: family.id,
      accountId,
      actorId: accountId,
      type: 'created',
    });
    this.logger.log(`family.created id=${family.id} owner=${accountId}`);
    return { familyId: family.id, name: family.name, role: 'owner' };
  }

  /** US2 · Owner issues a single-use invite code (FR-004). */
  async issueInvite(family: CurrentFamilyContext, ownerId: string): Promise<InviteCodeResponse> {
    return this.invitations.issue(family.familyId, ownerId);
  }

  /**
   * US2 · Join a family by redeeming a code (FR-006). Rejects if already in a
   * family; consumes the code atomically; creates a member membership.
   */
  async joinFamily(accountId: string, code: string): Promise<FamilySummary> {
    const alreadyInFamily = new ConflictException('You already belong to a family.');
    if (await this.memberships.findByAccount(accountId)) {
      throw alreadyInFamily;
    }
    const redeemed = await this.invitations.redeem(code);
    if (!redeemed) {
      throw new BadRequestException('Invalid or expired invite code.');
    }
    try {
      await this.memberships.create({ accountId, familyId: redeemed.familyId, role: 'member' });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw alreadyInFamily;
      }
      throw error;
    }
    await this.events.append({
      familyId: redeemed.familyId,
      accountId,
      actorId: accountId,
      type: 'joined',
    });
    const family = await this.families.findById(redeemed.familyId);
    this.logger.log(`family.joined id=${redeemed.familyId} member=${accountId}`);
    return { familyId: redeemed.familyId, name: family?.name ?? '', role: 'member' };
  }

  /**
   * US4 · Owner removes a Member from the family (FR-015..FR-017). Owner-only is
   * enforced by the role guard; the Owner cannot be removed, and the target must
   * belong to the caller's family (isolation). Removal revokes access immediately.
   */
  async removeMember(
    family: CurrentFamilyContext,
    actorId: string,
    targetAccountId: string,
  ): Promise<void> {
    const target = await this.memberships.findInFamily(family.familyId, targetAccountId);
    if (!target) {
      throw new NotFoundException('Member not found in this family.');
    }
    if (target.role === 'owner') {
      throw new ForbiddenException('The Owner cannot be removed.');
    }
    await this.memberships.deleteByAccount(targetAccountId);
    await this.events.append({
      familyId: family.familyId,
      accountId: targetAccountId,
      actorId,
      type: 'removed',
    });
    this.logger.log(`family.member.removed family=${family.familyId} member=${targetAccountId}`);
  }

  /**
   * US5 · A Member leaves the family, freeing the account to join another
   * (FR-018). The Owner may not leave (ownership transfer is out of scope).
   */
  async leaveFamily(family: CurrentFamilyContext, accountId: string): Promise<void> {
    if (family.role === 'owner') {
      throw new ForbiddenException('The Owner cannot leave the family.');
    }
    await this.memberships.deleteByAccount(accountId);
    await this.events.append({
      familyId: family.familyId,
      accountId,
      actorId: accountId,
      type: 'left',
    });
    this.logger.log(`family.member.left family=${family.familyId} member=${accountId}`);
  }

  /** US3 · The caller's family + members, scoped from the session membership (FR-009). */
  async getMyFamily(family: CurrentFamilyContext): Promise<FamilyDetail> {
    const doc = await this.families.findById(family.familyId);
    const memberDocs = await this.memberships.findByFamily(family.familyId);
    const members = await Promise.all(
      memberDocs.map(async (m) => {
        const account = await this.accounts.findById(m.accountId.toString());
        return {
          accountId: m.accountId.toString(),
          email: account?.email ?? '',
          role: m.role,
        };
      }),
    );
    return { familyId: family.familyId, name: doc?.name ?? '', role: family.role, members };
  }
}
