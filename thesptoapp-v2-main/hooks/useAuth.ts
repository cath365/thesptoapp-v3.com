import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Safety timeout: if onAuthStateChanged never fires (broken auth instance),
    // stop loading after 10 s so the app doesn't hang on a blank screen.
    const safetyTimer = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) {
          console.warn('[useAuth] Auth state not received after 10 s — stopping loader');
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
          if (firebaseUser) {
            // Check if user has been deactivated by an admin
            try {
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists() && userDoc.data()?.active === false) {
                await signOut(auth);
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
          setUser(null);
          setIsLoading(false);
        }
      );
    } catch (e) {
      // If auth is broken, onAuthStateChanged itself throws
      clearTimeout(safetyTimer);
      console.error('[useAuth] Failed to subscribe to auth state:', e);
      setUser(null);
      setIsLoading(false);
    }

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe?.();
    };
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
} 