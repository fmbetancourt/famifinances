import type { CategoryKind } from '@famifinances/contracts';

export interface SystemCategorySeed {
  kind: CategoryKind;
  name: string;
}

/**
 * Curated default categories for Chilean households, seeded once (idempotently) so
 * every family has a usable income/expense set with zero setup (SC-001). Each is
 * upserted by { scope: 'system', kind, name } — safe to re-run on every boot.
 */
export const DEFAULT_SYSTEM_CATEGORIES: SystemCategorySeed[] = [
  { kind: 'income', name: 'Sueldo' },
  { kind: 'income', name: 'Honorarios' },
  { kind: 'income', name: 'Otros ingresos' },
  { kind: 'expense', name: 'Alimentación' },
  { kind: 'expense', name: 'Transporte' },
  { kind: 'expense', name: 'Vivienda' },
  { kind: 'expense', name: 'Servicios básicos' },
  { kind: 'expense', name: 'Salud' },
  { kind: 'expense', name: 'Educación' },
  { kind: 'expense', name: 'Entretenimiento' },
  { kind: 'expense', name: 'Otros gastos' },
];
