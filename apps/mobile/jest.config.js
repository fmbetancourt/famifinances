// Jest configuration for the mobile app (FAM-8 · research D3).
// Uses the `jest-expo` preset so Expo/React Native modules transform correctly.
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // pnpm stores packages under `node_modules/.pnpm/<name>@<version>/…`, which the
  // preset's default (npm/yarn-flat) transformIgnorePatterns does not match — leaving
  // React Native / Expo Flow sources untransformed. Allow-list them in the `.pnpm` store.
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(expo|@expo|react-native|@react-native|@react-navigation|@unimodules|unimodules|sentry-expo|native-base|@sentry|react-native-svg|react-clone-referenced-element))',
  ],
};
