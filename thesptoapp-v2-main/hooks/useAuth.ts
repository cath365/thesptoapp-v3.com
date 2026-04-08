import { auth, db } from '@/lib/firebase';
import { appendAuthDiagnostic } from '@/lib/authDiagnostics';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Module-level callback: allows lib/auth.ts to manually inject a user when
// the Firebase SDK is completely broken (iOS 26+) but REST API verified creds.
let _injectUserFn: ((user: User) => void) | null = null;

/**
 * Push an externally-authenticated user into the useAuth hook's state.
 * Called from signInWithRestFallback when all SDK sign-in paths fail
 * but the REST API has proven the credentials are valid.
 */
export function injectAuthUser(user: User): void {
  if (_injectUserFn) {
    _injectUserFn(user);
  }
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Register the injection callback so lib/auth.ts can push a REST-fallback user
    _injectUserFn = (injectedUser: User) => {
      console.log('[useAuth] Manually injected REST-fallback user, uid:', injectedUser.uid);
      void appendAuthDiagnostic('useAuth:inject:restFallbackUser', { uid: injectedUser.uid });
      setUser(injectedUser);
      setIsLoading(false);
    };

    void appendAuthDiagnostic('useAuth:subscribe:start');

    // Safety timeout: if onAuthStateChanged never fires (broken auth instance),
    // stop loading after 10 s so the app doesn't hang on a blank screen.
    const safetyTimer = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) {
          console.warn('[useAuth] Auth state not received after 10 s — stopping loader');
          void appendAuthDiagnostic('useAuth:subscribe:timeout', { timeoutMs: 10000 });
        }
        return false;
      });
    }, 10000);

    let unsubscribe: (() => void) | undefined;

    try {
      // Firebase auth persistence is handled natively via initializeAuth + AsyncStorage
      // in lib/firebase.ts — no need for manual session caching
      unsubscribe = onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          clearTimeout(safetyTimer);
          void appendAuthDiagnostic('useAuth:state:received', {
            hasUser: !!firebaseUser,
            uid: firebaseUser?.uid,
          });
          if (firebaseUser) {
            // Check if user has been deactivated by an admin
            try {
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists() && userDoc.data()?.active === false) {
                await signOut(auth);
                void appendAuthDiagnostic('useAuth:state:deactivated-user', {
                  uid: firebaseUser.uid,
                });
                Alert.alert(
                  'Account Deactivated',
                  'Your account has been deactivated. Please contact support for assistance.'
                );
                setUser(null);
                setIsLoading(false);
                return;
              }
            } catch {
              // Don't block auth on Firestore check failure
            }
          }
          setUser(firebaseUser);
          setIsLoading(false);
        },
        (error) => {
          clearTimeout(safetyTimer);
          console.error('[useAuth] onAuthStateChanged error:', error);
          void appendAuthDiagnostic('useAuth:state:error', {
            message: error?.message,
            code: (error as any)?.code,
          });
          setUser(null);
          setIsLoading(false);
        }
      );
    } catch (e) {
      // If auth is broken, onAuthStateChanged itself throws
      clearTimeout(safetyTimer);
      console.error('[useAuth] Failed to subscribe to auth state:', e);
      void appendAuthDiagnostic('useAuth:subscribe:error', {
        message: e instanceof Error ? e.message : String(e),
      });
      setUser(null);
      setIsLoading(false);
    }

    return () => {
      clearTimeout(safetyTimer);
      _injectUserFn = null;
      void appendAuthDiagnostic('useAuth:subscribe:cleanup');
      unsubscribe?.();
    };
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
} 