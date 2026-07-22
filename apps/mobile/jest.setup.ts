// Global Jest setup (FAM-8). Provides in-memory mocks for the OS secure store and
// the Expo Router navigation surface so unit/component tests run without native modules.
import type { ReactNode } from 'react';

// In-memory SecureStore: mirrors the async API of `expo-secure-store`. Tests can
// reset it via `__resetSecureStore()`.
const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string): Promise<void> => {
    mockSecureStore.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string): Promise<string | null> =>
    mockSecureStore.has(key) ? (mockSecureStore.get(key) as string) : null,
  ),
  deleteItemAsync: jest.fn(async (key: string): Promise<void> => {
    mockSecureStore.delete(key);
  }),
}));

// Shared router spy so tests can assert navigation (e.g. redirect to sign-in).
const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
};

// `Redirect` is a spy so tests can assert the destination without a real navigator.
const mockRedirect = jest.fn(() => null);

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  Redirect: mockRedirect,
  Slot: ({ children }: { children?: ReactNode }) => children ?? null,
  Stack: Object.assign(() => null, { Screen: () => null }),
  Link: ({ children }: { children?: ReactNode }) => children ?? null,
}));

// Expose helpers on globalThis for tests that need to seed/inspect state.
(globalThis as unknown as { __mockSecureStore: Map<string, string> }).__mockSecureStore = mockSecureStore;
(globalThis as unknown as { __mockRouter: typeof mockRouter }).__mockRouter = mockRouter;
(globalThis as unknown as { __mockRedirect: typeof mockRedirect }).__mockRedirect = mockRedirect;

beforeEach(() => {
  mockSecureStore.clear();
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
  mockRouter.navigate.mockClear();
  mockRedirect.mockClear();
});
