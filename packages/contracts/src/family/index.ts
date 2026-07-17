// Shared family DTO types, mirroring specs/003-family-membership/contracts/family.openapi.yaml.

export type FamilyRole = 'owner' | 'member';

export interface CreateFamilyRequest {
  name: string;
}

export interface JoinFamilyRequest {
  code: string;
}

export interface FamilySummary {
  familyId: string;
  name: string;
  role: FamilyRole;
}

export interface MemberSummary {
  accountId: string;
  email: string;
  role: FamilyRole;
}

export interface FamilyDetail {
  familyId: string;
  name: string;
  role: FamilyRole;
  members: MemberSummary[];
}

export interface InviteCodeResponse {
  code: string;
  expiresIn: number;
}
