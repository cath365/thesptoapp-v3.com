import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { useAuth } from './useAuth';
import { useOnboarding } from './useOnboarding';

const GUEST_MODE_KEY = '@guest_mode';

// Shared listener set so all useAppState instances stay in sync for guest mode
const _guestListeners = new Set<(val: boolean) => void>();

export interface AppState {
  isAppReady: boolean;
  shouldShowOnboarding: boolean;
  shouldShowAuth: boolean;
  isGuest: boolean;
  user: User | null;
  authError: string | null;
  retryAuthCheck: () => void;
  setGuestMode: (enabled: boolean) => Promise<void>;
}

export function useAppState(): AppState {
  const [isAppReady, setIsAppReady] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(true);
  const { hasCompletedOnboarding, isLoading: isOnboardingLoading } = useOnboarding();
  const { user, isAuthenticated, isLoading: isAuthLoading, error: authError, retryAuthCheck } = useAuth();

  useEffect(() => {
    initializeApp();

    // Subscribe so other instances can notify us of guest mode changes
    const listener = (val: boolean) => setIsGuest(val);
    _guestListeners.add(listener);
    return () => { _guestListeners.delete(listener); };
  }, []);

  useEffect(() => {
    // When user authenticates, clear guest mode
    if (isAuthenticated && isGuest) {
      setIsGuest(false);
      AsyncStorage.removeItem(GUEST_MODE_KEY);
    }
  }, [isAuthenticated, isGuest]);

  useEffect(() => {
    // Once all states are loaded, we can hide the splash screen
    if (!isOnboardingLoading && !isAuthLoading && !isGuestLoading && hasCompletedOnboarding !== null) {
      finishInitialization();
    }
  }, [isOnboardingLoading, isAuthLoading, isGuestLoading, hasCompletedOnboarding]);

  const initializeApp = async () => {
    try {
      await SplashScreen.preventAutoHideAsync();
      // Load guest mode state
      const guestMode = await AsyncStorage.getItem(GUEST_MODE_KEY);
      setIsGuest(guestMode === 'true');
    } catch {
      // SplashScreen may already have been hidden
    } finally {
      setIsGuestLoading(false);
    }
  };

  const finishInitialization = async () => {
    try {
      // Small delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setIsAppReady(true);
      await SplashScreen.hideAsync();
    } catch {
      setIsAppReady(true);
      try {
        await SplashScreen.hideAsync();
      } catch {
        // SplashScreen may already be hidden
      }
    }
  };

  // Determine what to show based on auth and onboarding state
  const shouldShowOnboarding = hasCompletedOnboarding === false;
  const shouldShowAuth = !shouldShowOnboarding && !isAuthenticated && !isGuest;

  const setGuestMode = async (enabled: boolean) => {
    setIsGuest(enabled);
    // Notify every other hook instance
    _guestListeners.forEach(fn => fn(enabled));
    if (enabled) {
      await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
    }
  };

  return {
    isAppReady,
    shouldShowOnboarding,
    shouldShowAuth,
    isGuest,
    user,
    authError,
    retryAuthCheck,
    setGuestMode,
  };
} 