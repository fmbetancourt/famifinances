import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { Invitation, InvitationDocument } from './invitation.schema';

export interface IssuedInvite {
  code: string;
  expiresIn: number;
}

/**
 * Issues and redeems single-use family invite codes. Codes are high-entropy and
 * persisted only as a SHA-256 hash (indexable → O(1) redemption without knowing
 * the family). Redemption consumes the code atomically (single-use). Reuses the
 * OTP TTL config for the expiry window.
 */
@Injectable()
export class InvitationService {
  constructor(
    @InjectModel(Invitation.name) private readonly model: Model<InvitationDocument>,
    private readonly config: ConfigService,
  ) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private ttlSeconds(): number {
    return Number(this.config.getOrThrow<string>('OTP_TTL'));
  }

  /** Issues a code for a family; returns the plaintext code (shown once) + TTL. */
  async issue(familyId: string, issuedBy: string): Promise<IssuedInvite> {
    const code = randomBytes(8).toString('hex'); // 64-bit, single-use, short-lived
    const expiresIn = this.ttlSeconds();
    await this.model.create({
      familyId: new Types.ObjectId(familyId),
      issuedBy: new Types.ObjectId(issuedBy),
      codeHash: this.hash(code),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      consumedAt: null,
    });
    return { code, expiresIn };
  }

  /**
   * Atomically consumes a valid, non-expired, unconsumed code and returns the
   * family it grants access to, or null if the code is invalid/expired/used.
   */
  async redeem(code: string): Promise<{ familyId: string } | null> {
    const invitation = await this.model
      .findOneAndUpdate(
        { codeHash: this.hash(code), consumedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { consumedAt: new Date() } },
      )
      .exec();
    return invitation ? { familyId: invitation.familyId.toString() } : null;
  }
}
