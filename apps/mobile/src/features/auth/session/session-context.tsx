import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import type { AccountSummary, TokenPair } from '@famifinances/contracts';
import { saveTokens } from '../storage/secure-token-store';
import { bootstrapSession } from './session-bootstrap';
import type { SessionReason } from './session-bootstrap';
import { revokeSession } from './sign-out';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * In-memory session state (data-model INV-1): identity + membership + a coarse status.
 * Access/refresh tokens are intentionally absent — they live only in SecureStore and are
 * read on demand by the API client (FR-006, Principle II). `reason` explains an
 * unauthenticated status so screens can react (e.g. show "session expired" or an offline
 * notice — spec Edge Cases).
 */
export interface SessionState {
  readonly status: SessionStatus;
  readonly user: AccountSummary | null;
  readonly familyId: string | null;
  readonly reason: SessionReason;
}

export interface SessionApi extends SessionState {
  /** Persist tokens then (re)resolve identity + family membership. */
  establishSession(tokens: TokenPair): Promise<void>;
  /** Re-run identity + membership resolution against the API. */
  reload(): Promise<void>;
  /** Best-effort server revoke, clear SecureStore, → unauthenticated. */
  signOut(): Promise<void>;
}

const LOADING: SessionState = { status: 'loading', user: null, familyId: null, reason: 'none' };

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, setState] = useState<SessionState>(LOADING);

  // Mirror the latest reason for the AppState listener without re-subscribing.
  const reasonRef = useRef<SessionReason>(state.reason);
  useEffect(() => {
    reasonRef.current = state.reason;
  }, [state.reason]);

  const load = useCallback(async (): Promise<void> => {
    const resolved = await bootstrapSession();
    setState({
      status: resolved.status,
      user: resolved.user,
      familyId: resolved.familyId,
      reason: resolved.reason,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Pending-offline reattempt (spec Edge Case): when restoration failed on connectivity,
  // retry as soon as the app returns to the foreground. This is a dependency-free proxy
  // for "connectivity restored" (no NetInfo — Principle V/YAGNI); tokens were kept, so a
  // successful retry silently restores the session.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && reasonRef.current === 'offline') {
        void load();
      }
    });
    return () => subscription.remove();
  }, [load]);

  const establishSession = useCallback(
    async (tokens: TokenPair): Promise<void> => {
      await saveTokens(tokens);
      setState(LOADING);
      await load();
    },
    [load],
  );

  const reload = useCallback(async (): Promise<void> => {
    setState(LOADING);
    await load();
  }, [load]);

  const signOut = useCallback(async (): Promise<void> => {
    await revokeSession();
    setState({ status: 'unauthenticated', user: null, familyId: null, reason: 'none' });
  }, []);

  const value = useMemo<SessionApi>(
    () => ({ ...state, establishSession, reload, signOut }),
    [state, establishSession, reload, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Access the session; throws if used outside a `<SessionProvider>`. */
export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
