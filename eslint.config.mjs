// Flat ESLint config for the monorepo. Enforces named exports and no-explicit-any
// per the project constitution (Principle VI). Run at the repo root via `pnpm lint`
// (`eslint .`), covering the API and mobile TypeScript sources.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      '**/*.d.ts',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Prefer named exports over default exports (constitution Principle VI).',
        },
      ],
    },
  },
  {
    // Expo Router route files MUST be default exports — the framework requires it.
    files: ['apps/mobile/app/**/*.tsx', 'apps/mobile/app/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
);
