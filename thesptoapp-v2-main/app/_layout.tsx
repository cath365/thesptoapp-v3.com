import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LogBox, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import AnimatedSplash from '@/components/AnimatedSplash';
import AppInitErrorScreen from '@/components/AppInitErrorScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SpotColors } from '@/constants/Colors';
import { useAppState } from '@/hooks/useAppState';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { checkForUpdates } from '@/lib/checkForUpdates';
import { parseDeepLink } from '@/lib/deepLink';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import '@/lib/i18n';

// Prevent unhandled promise rejections from crashing the app
if (typeof global !== 'undefined') {
  const originalHandler = (global as any).onunhandledrejection;
  (global as any).onunhandledrejection = (event: any) => {
    console.warn('[App] Unhandled promise rejection:', event?.reason ?? event);
    // Prevent the default crash behaviour
    if (event?.preventDefault) event.preventDefault();
    // Chain to any existing handler
    if (typeof originalHandler === 'function') originalHandler(event);
  };
}

// Suppress noisy logs that are not actionable
LogBox.ignoreLogs([
  'Setting a timer',
  'AsyncStorage has been extracted',
  'Require cycle:',
]);

interface AppInitData {
  attempt: number;
  checkedAt: string;
  startupApiChecked: boolean;
  startupApiStatus: number | null;
}

function getAppInitErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Initialization failed. Please check your connection and try again.';
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAppReady, shouldShowOnboarding, shouldShowAuth, isGuest, user, authError, retryAuthCheck, setGuestMode } = useAppState();
  usePushNotifications(user?.uid ?? null);
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const [showSplash, setShowSplash] = useState(true);
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [initData, setInitData] = useState<AppInitData | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    let canceled = false;
    setInitLoading(true);
    setInitError(null);
    setInitData(null);

    const attemptNumber = initAttempt + 1;
    console.log(`[Init] Startup attempt ${attemptNumber} started`);

    if (!loaded || !isAppReady) {
      const waitTimer = setTimeout(() => {
        if (canceled) return;
        // Timeout is no longer fatal — proceed with whatever state we have.
        // This prevents the app from being permanently stuck on a loading screen.
        console.warn('[Init] Core app readiness timeout — proceeding anyway');
        setInitData({
          attempt: attemptNumber,
          checkedAt: new Date().toISOString(),
          startupApiChecked: false,
          startupApiStatus: null,
        });
        setInitLoading(false);
      }, 12000);

      return () => {
        canceled = true;
        clearTimeout(waitTimer);
      };
    }

    const verifyStartup = async () => {
      try {
        const startupApiUrl = process.env.EXPO_PUBLIC_INIT_API_URL?.trim();
        let startupApiStatus: number | null = null;

        if (startupApiUrl) {
          console.log('[Init] Checking startup API:', startupApiUrl);
          const response = await fetchWithTimeout(
            startupApiUrl,
            {
              method: 'GET',
              headers: {
                Accept: 'application/json, text/plain, */*',
              },
              cache: 'no-store',
            },
            8000
          );

          startupApiStatus = response.status;

          if (!response.ok) {
            // Non-fatal — log but proceed with app launch
            console.warn(`[Init] Startup API returned status ${response.status} — continuing anyway`);
          } else {
            console.log('[Init] Startup API check succeeded:', response.status);
          }
        } else {
          console.log('[Init] EXPO_PUBLIC_INIT_API_URL is not configured. Skipping startup API check.');
        }

        if (canceled) return;

        setInitData({
          attempt: attemptNumber,
          checkedAt: new Date().toISOString(),
          startupApiChecked: !!startupApiUrl,
          startupApiStatus,
        });
        setInitLoading(false);
        console.log('[Init] Startup initialization complete');
      } catch (error) {
        if (canceled) return;
        // Startup API failure is non-fatal — log and proceed
        console.warn('[Init] Startup check failed (non-fatal):', error);
        setInitData({
          attempt: attemptNumber,
          checkedAt: new Date().toISOString(),
          startupApiChecked: false,
          startupApiStatus: null,
        });
        setInitLoading(false);
      }
    };

    void verifyStartup();

    return () => {
      canceled = true;
    };
  }, [loaded, isAppReady, initAttempt]);

  const handleRetryInit = () => {
    console.log('[Init] Retry requested');
    setInitAttempt((prev) => prev + 1);
  };

  const handleRetryAuth = () => {
    console.log('[Init] Auth retry requested');
    retryAuthCheck();
  };

  const handleSkipToGuest = useCallback(async () => {
    try {
      console.log('[Init] User skipping to guest mode');
      await setGuestMode(true);
      // Clear any blocking error state
      setInitError(null);
      if (!initData) {
        setInitData({
          attempt: initAttempt + 1,
          checkedAt: new Date().toISOString(),
          startupApiChecked: false,
          startupApiStatus: null,
        });
      }
      setInitLoading(false);
    } catch (e) {
      console.warn('[Init] Failed to set guest mode:', e);
      // Force through anyway
      setInitError(null);
      setInitLoading(false);
    }
  }, [setGuestMode, initData, initAttempt]);

  // Determine if the app is fully ready for user interaction
  const appFullyReady = !initLoading && !initError && !!initData && !authError && !showSplash;

  // Check for OTA updates only after the user is past auth/onboarding.
  const updateChecked = useRef(false);
  useEffect(() => {
    if (!appFullyReady || shouldShowAuth || shouldShowOnboarding) return;
    if (updateChecked.current) return;
    updateChecked.current = true;
    checkForUpdates().catch((e) =>
      console.warn('[Layout] checkForUpdates failed:', e)
    );
  }, [appFullyReady, shouldShowAuth, shouldShowOnboarding]);

  // Handle deep links (thespotapp://article/{id})
  useEffect(() => {
    function handleDeepLink(event: { url: string }) {
      try {
        const articleId = parseDeepLink(event.url);
        if (articleId) {
          router.push(`/information/article/${articleId}` as any);
        }
      } catch (e) {
        console.warn('[Layout] Deep link error:', e);
      }
    }

    // Handle link that opened the app
    Linking.getInitialURL()
      .then((url) => {
        if (url) handleDeepLink({ url });
      })
      .catch((e) => console.warn('[Layout] getInitialURL error:', e));

    // Handle links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, [router]);

  // Navigate to the correct route once the app is ready
  useEffect(() => {
    if (!appFullyReady) return;

    // Wait until the root navigator is fully mounted and has a valid state.
    // Without this guard, router.replace() can throw
    // "Attempted to navigate before mounting the Root Layout component"
    // which crashes the app (especially on iPad / iPadOS 26).
    if (!rootNavigationState?.key) {
      // This is a critical guard for iPadOS 26+. The navigator can take multiple
      // render cycles to mount, and attempting to navigate before its key is
      // available will cause a native crash.
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    try {
      if (shouldShowOnboarding && !inOnboarding) {
        // User hasn't seen onboarding yet, redirect there.
        router.replace('/onboarding');
      } else if (shouldShowAuth && !inAuthGroup && !isGuest) {
        // User needs to sign in, is not a guest, and is not in the auth flow.
        router.replace('/(auth)/sign-in');
      } else if (!shouldShowOnboarding && !shouldShowAuth && (inAuthGroup || inOnboarding)) {
        // User is authenticated (or a guest) and has seen onboarding.
        // If they are on an auth or onboarding screen, send them to the main app.
        router.replace('/(tabs)');
      }
    } catch (e) {
      console.warn('[Layout] Navigation error (will retry on next state change):', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appFullyReady, rootNavigationState?.key, shouldShowOnboarding, shouldShowAuth, isGuest]);

  // Determine which overlay to show (if any).
  // IMPORTANT: The Stack is ALWAYS rendered below to keep expo-router's
  // navigation state alive. We overlay blocking UI on top instead of
  // conditionally returning early, which would unmount the Stack and
  // corrupt the navigation state when it re-mounts.
  let overlay: React.ReactNode = null;

  if (initLoading) {
    overlay = (
      <View style={[styles.overlay, { backgroundColor: SpotColors.primary }]}>
        <ActivityIndicator size="large" color={SpotColors.textOnPrimary} />
      </View>
    );
  } else if (initError) {
    overlay = (
      <View style={styles.overlay}>
        <AppInitErrorScreen message={initError} onRetry={handleRetryInit} onSkipToGuest={handleSkipToGuest} />
      </View>
    );
  } else if (!initData) {
    overlay = (
      <View style={styles.overlay}>
        <AppInitErrorScreen message="Initialization failed unexpectedly. Please retry." onRetry={handleRetryInit} onSkipToGuest={handleSkipToGuest} />
      </View>
    );
  } else if (authError) {
    overlay = (
      <View style={styles.overlay}>
        <AppInitErrorScreen message={authError} onRetry={handleRetryAuth} onSkipToGuest={handleSkipToGuest} />
      </View>
    );
  } else if (showSplash) {
    overlay = (
      <View style={styles.overlay}>
        <AnimatedSplash onFinish={() => setShowSplash(false)} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={styles.root}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="information" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
          {overlay}
        </View>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
});
