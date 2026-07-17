import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FamilyRole, Membership, MembershipDocument } from './membership.schema';

export interface CreateMembershipInput {
  accountId: string;
  familyId: string;
  role: FamilyRole;
}

/** True when an error is a MongoDB duplicate-key violation (one-family-per-user race). */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
  );
}

@Injectable()
export class MembershipRepository {
  constructor(
    @InjectModel(Membership.name) private readonly model: Model<MembershipDocument>,
  ) {}

  async create(input: CreateMembershipInput): Promise<MembershipDocument> {
    return this.model.create({
      accountId: new Types.ObjectId(input.accountId),
      familyId: new Types.ObjectId(input.familyId),
      role: input.role,
    });
  }

  async findByAccount(accountId: string): Promise<MembershipDocument | null> {
    return this.model.findOne({ accountId: new Types.ObjectId(accountId) }).exec();
  }

  async findByFamily(familyId: string): Promise<MembershipDocument[]> {
    return this.model.find({ familyId: new Types.ObjectId(familyId) }).exec();
  }

  async findInFamily(familyId: string, accountId: string): Promise<MembershipDocument | null> {
    return this.model
      .findOne({
        familyId: new Types.ObjectId(familyId),
        accountId: new Types.ObjectId(accountId),
      })
      .exec();
  }

  async deleteByAccount(accountId: string): Promise<void> {
    await this.model.deleteOne({ accountId: new Types.ObjectId(accountId) }).exec();
  }
}
