/// <reference types="expo/types" />

// Expo injects EXPO_PUBLIC_* variables at build time. Declare the ones the app
// reads so TypeScript recognizes `process.env` in the React Native context
// (without pulling in all of @types/node).
declare const process: {
  readonly env: {
    readonly EXPO_PUBLIC_API_BASE?: string;
  };
};
