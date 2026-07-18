// Shared category DTO types, mirroring specs/005-categories/contracts/categories.openapi.yaml.

export type CategoryKind = 'income' | 'expense';

export type CategoryScope = 'system' | 'family';

/** Which custom categories a list request returns (default `active`). System defaults are always
 * included unless `archived`. */
export type CategoryStatusFilter = 'active' | 'archived' | 'all';

export interface CreateCategoryRequest {
  name: string;
  kind: CategoryKind;
}

export interface UpdateCategoryRequest {
  /** Only the name may change; kind and scope are immutable. */
  name: string;
}

export interface CategorySummary {
  categoryId: string;
  name: string;
  kind: CategoryKind;
  scope: CategoryScope;
  /** Always false for system defaults. */
  archived: boolean;
}
