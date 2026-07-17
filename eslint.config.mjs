// Flat ESLint config for the monorepo. Enforces named exports and no-explicit-any
// per the project constitution (Principle VI). Kept dependency-light for the MVP.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/*.js'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
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
