import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from '@famifinances/contracts';

const ACCESS_KEY = 'ff_access_token';
const REFRESH_KEY = 'ff_refresh_token';

/** Persists the token pair in the OS secure enclave (never plain AsyncStorage). */
export async function saveTokens(pair: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, pair.accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, pair.refreshToken);
}

export function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
