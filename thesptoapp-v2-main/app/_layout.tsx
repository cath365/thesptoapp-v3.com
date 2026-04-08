import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LogBox, View } from 'react-native';
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

function LoadingScreen() {
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: SpotColors.primary 
    }}>
      <ActivityIndicator size="large" color={SpotColors.textOnPrimary} />
    </View>
  );
}

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
  const { isAppReady, shouldShowOnboarding, shouldShowAuth, user, authError, retryAuthCheck } = useAppState();
  usePushNotifications(user?.uid ?? null);
  const router = useRouter();
  const segments = useSegments();
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
        const timeoutMessage = 'App initialization timed out after 8 seconds. Please retry.';
        console.error('[Init] Core app readiness timeout');
        setInitError(timeoutMessage);
        setInitLoading(false);
      }, 8000);

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
            throw new Error(`Startup API failed with status ${response.status}`);
          }

          console.log('[Init] Startup API check succeeded:', response.status);
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
        const message = getAppInitErrorMessage(error);
        console.error('[Init] Startup initialization failed:', error);
        setInitError(message);
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

  // Check for OTA updates only after the user is past auth/onboarding.
  // Running this on the sign-in screen causes the "Update Available" Alert to
  // appear over the form, which blocks credential entry during App Review.
  const updateChecked = useRef(false);
  useEffect(() => {
    if (!isAppReady || showSplash || shouldShowAuth || shouldShowOnboarding) return;
    if (updateChecked.current) return;
    updateChecked.current = true;
    checkForUpdates().catch((e) =>
      console.warn('[Layout] checkForUpdates failed:', e)
    );
  }, [isAppReady, showSplash, shouldShowAuth, shouldShowOnboarding]);

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

  useEffect(() => {
    if (!loaded || !isAppReady || showSplash) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (shouldShowOnboarding && !inOnboarding) {
      router.replace('/onboarding');
    } else if (shouldShowAuth && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (!shouldShowOnboarding && !shouldShowAuth && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)');
    }
    // Only react to actual auth/onboarding state changes, not intra-group navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, isAppReady, showSplash, shouldShowOnboarding, shouldShowAuth]);

  // Show plain loading until fonts + app state are ready
  if (initLoading) {
    return <LoadingScreen />;
  }

  if (initError) {
    return <AppInitErrorScreen message={initError} onRetry={handleRetryInit} />;
  }

  if (!initData) {
    return <AppInitErrorScreen message="Initialization failed unexpectedly. Please retry." onRetry={handleRetryInit} />;
  }

  if (authError) {
    return <AppInitErrorScreen message={authError} onRetry={handleRetryAuth} />;
  }

  // Show animated splash once everything is loaded
  if (showSplash) {
    return <AnimatedSplash onFinish={() => setShowSplash(false)} />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="information" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
