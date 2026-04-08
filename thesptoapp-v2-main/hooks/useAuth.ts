import { auth, db } from '@/lib/firebase';
import { appendAuthDiagnostic } from '@/lib/authDiagnostics';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  retryAuthCheck: () => void;
}

const AUTH_RESOLVE_TIMEOUT_MS = 5000;
const PROFILE_CHECK_TIMEOUT_MS = 5000;

// Module-level callback: allows lib/auth.ts to manually inject a user when
// the Firebase SDK is completely broken (iOS 26+) but REST API verified creds.
let _injectUserFn: ((user: User) => void) | null = null;

// Flag: set to true when a REST-fallback user has been injected.
// Prevents onAuthStateChanged(null) from overwriting the injected user.
let _hasInjectedUser = false;

/**
 * Push an externally-authenticated user into the useAuth hook's state.
 * Called from signInWithRestFallback when all SDK sign-in paths fail
 * but the REST API has proven the credentials are valid.
 */
export function injectAuthUser(user: User): void {
  _hasInjectedUser = true;
  if (_injectUserFn) {
    _injectUserFn(user);
  }
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const userRef = useRef<User | null>(null);

  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);

  const setUserState = useCallback((nextUser: User | null) => {
    userRef.current = nextUser;
    setUser(nextUser);
  }, []);

  const getFriendlyErrorMessage = useCallback((value: unknown): string => {
    const raw = value instanceof Error ? value.message : String(value ?? 'Unknown error');
    const normalized = raw.toLowerCase();

    if (normalized.includes('timed out')) {
      return 'Authentication timed out. Please retry.';
    }
    if (normalized.includes('network') || normalized.includes('offline')) {
      return 'Network unavailable. Please check your connection and retry.';
    }
    if (normalized.includes('unavailable')) {
      return 'Authentication service is temporarily unavailable. Please retry.';
    }

    return 'Unable to verify your session. Please retry.';
  }, []);

  const retryAuthCheck = useCallback(() => {
    console.log('[useAuth] Retry requested');
    setRetryCount((prev) => {
      const next = prev + 1;
      void appendAuthDiagnostic('useAuth:retry:requested', { retryCount: next });
      return next;
    });
  }, []);

  useEffect(() => {
    let isActive = true;
    let resolved = false;
    let unsubscribe: (() => void) | undefined;
    let safetyTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackCheckTimer: ReturnType<typeof setTimeout> | undefined;

    const finalize = (nextUser: User | null | undefined, nextError: string | null) => {
      if (resolved || !isActive) return;
      resolved = true;
      if (safetyTimer) clearTimeout(safetyTimer);
      if (fallbackCheckTimer) clearTimeout(fallbackCheckTimer);
      if (nextUser !== undefined) {
        setUserState(nextUser);
      }
      setError(nextError);
      setIsLoading(false);
    };

    const resolveAuthUser = async (firebaseUser: User | null, source: string) => {
      if (resolved || !isActive) return;

      void appendAuthDiagnostic('useAuth:resolve:start', {
        source,
        hasUser: !!firebaseUser,
        uid: firebaseUser?.uid,
        hasInjectedUser: _hasInjectedUser,
      });

      if (!firebaseUser && _hasInjectedUser && userRef.current) {
        finalize(undefined, null);
        return;
      }

      if (!firebaseUser) {
        finalize(null, null);
        return;
      }

      _hasInjectedUser = false;

      try {
        if (!db) {
          console.error('[useAuth] Firestore instance is unavailable during auth verification');
          void appendAuthDiagnostic('useAuth:resolve:firestore-missing', { uid: firebaseUser.uid });
          finalize(firebaseUser, null);
          return;
        }

        const userDoc = await withTimeout(
          getDoc(doc(db, 'users', firebaseUser.uid)),
          PROFILE_CHECK_TIMEOUT_MS,
          'Auth profile check'
        );

        if (userDoc.exists() && userDoc.data()?.active === false) {
          await signOut(auth);
          void appendAuthDiagnostic('useAuth:resolve:deactivated-user', {
            uid: firebaseUser.uid,
            source,
          });
          Alert.alert(
            'Account Deactivated',
            'Your account has been deactivated. Please contact support for assistance.'
          );
          finalize(null, 'Your account has been deactivated.');
          return;
        }

        finalize(firebaseUser, null);
      } catch (profileError) {
        console.error('[useAuth] Profile verification failed:', profileError);
        void appendAuthDiagnostic('useAuth:resolve:profile-check-failed', {
          uid: firebaseUser.uid,
          source,
          message: profileError instanceof Error ? profileError.message : String(profileError),
        });
        finalize(firebaseUser, null);
      }
    };

    setIsLoading(true);
    setError(null);

    // Register the injection callback so lib/auth.ts can push a REST-fallback user
    _injectUserFn = (injectedUser: User) => {
      console.log('[useAuth] Manually injected REST-fallback user, uid:', injectedUser.uid);
      void appendAuthDiagnostic('useAuth:inject:restFallbackUser', { uid: injectedUser.uid });
      _hasInjectedUser = true;
      userRef.current = injectedUser;
      finalize(injectedUser, null);
    };

    void appendAuthDiagnostic('useAuth:subscribe:start', { retryCount });

    if (!auth) {
      console.error('[useAuth] Firebase auth instance is unavailable');
      void appendAuthDiagnostic('useAuth:subscribe:auth-missing');
      finalize(null, 'Authentication service is unavailable. Please try again.');
      return () => {
        _injectUserFn = null;
        _hasInjectedUser = false;
      };
    }

    // Hard fail-safe: never allow loading to run longer than 5s.
    safetyTimer = setTimeout(() => {
      if (_hasInjectedUser) return;
      console.warn('[useAuth] Auth state timed out after 5s (fail-safe)');
      void appendAuthDiagnostic('useAuth:subscribe:timeout', {
        timeoutMs: AUTH_RESOLVE_TIMEOUT_MS,
        retryCount,
      });
      finalize(null, 'Unable to verify your session. Please retry.');
    }, AUTH_RESOLVE_TIMEOUT_MS);

    // Fallback path: do not rely solely on callback delivery.
    fallbackCheckTimer = setTimeout(() => {
      if (resolved || !isActive) return;
      void appendAuthDiagnostic('useAuth:fallback:current-user-check', {
        hasCurrentUser: !!auth.currentUser,
      });
      if (auth.currentUser) {
        void resolveAuthUser(auth.currentUser, 'currentUserFallback');
      }
    }, 2000);

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          if (!isActive) return;

          // Firebase auth responded — clear the safety / fallback timers
          // immediately.  The profile-check inside resolveAuthUser has its
          // own timeout (PROFILE_CHECK_TIMEOUT_MS), so we no longer need
          // the blunt 5-second fail-safe.
          if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = undefined; }
          if (fallbackCheckTimer) { clearTimeout(fallbackCheckTimer); fallbackCheckTimer = undefined; }

          // After initial resolution, handle subsequent auth changes (e.g. sign-out)
          // directly without going through the full resolveAuthUser flow.
          if (resolved) {
            void appendAuthDiagnostic('useAuth:state:subsequent', {
              hasUser: !!firebaseUser,
              uid: firebaseUser?.uid,
            });
            // If user signed out, clear state immediately
            if (!firebaseUser) {
              if (_hasInjectedUser && userRef.current) {
                // REST-fallback user is active; ignore SDK null
                return;
              }
              setUserState(null);
              setError(null);
              return;
            }
            // If a different user signed in, update state
            setUserState(firebaseUser);
            setError(null);
            return;
          }
          void resolveAuthUser(firebaseUser, 'onAuthStateChanged');
        },
        (error) => {
          console.error('[useAuth] onAuthStateChanged error:', error);
          void appendAuthDiagnostic('useAuth:state:error', {
            message: error?.message,
            code: (error as any)?.code,
          });
          finalize(null, getFriendlyErrorMessage(error));
        }
      );
    } catch (e) {
      console.error('[useAuth] Failed to subscribe to auth state:', e);
      void appendAuthDiagnostic('useAuth:subscribe:error', {
        message: e instanceof Error ? e.message : String(e),
      });
      finalize(null, getFriendlyErrorMessage(e));
    }

    return () => {
      isActive = false;
      clearTimeout(safetyTimer);
      clearTimeout(fallbackCheckTimer);
      _injectUserFn = null;
      _hasInjectedUser = false;
      void appendAuthDiagnostic('useAuth:subscribe:cleanup');
      unsubscribe?.();
    };
  }, [getFriendlyErrorMessage, retryCount, setUserState]);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    retryAuthCheck,
  };
} 