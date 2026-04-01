import { initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
} from 'firebase/auth';
// @ts-expect-error getReactNativePersistence exists at runtime via Metro's react-native bundle resolution
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0",
  authDomain: "spot-app-575e9.firebaseapp.com",
  projectId: "spot-app-575e9",
  storageBucket: "spot-app-575e9.firebasestorage.app",
  messagingSenderId: "200356116293",
  appId: "1:200356116293:web:53f01b90e1d4c4812db02c",
  measurementId: "G-VKX5WNJ8XH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

/**
 * Build the best available persistence layer for React Native.
 * Returns null if none can be constructed (falls back to in-memory).
 */
function buildReactNativePersistence() {
  try {
    if (typeof getReactNativePersistence !== 'function') {
      console.warn('[Firebase] getReactNativePersistence is not available in this bundle');
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (!AsyncStorage) {
      console.warn('[Firebase] AsyncStorage could not be loaded');
      return null;
    }
    return getReactNativePersistence(AsyncStorage);
  } catch (e) {
    console.warn('[Firebase] Failed to build RN persistence:', e);
    return null;
  }
}

// Initialize Firebase Auth with platform-appropriate persistence
let auth: Auth;

function initAuth(): Auth {
  // ── Web ──
  if (Platform.OS === 'web') {
    try {
      return initializeAuth(app, { persistence: browserLocalPersistence });
    } catch (e: any) {
      if (e.code === 'auth/already-initialized') return getAuth(app);
      console.error('[Firebase] Web auth init failed, using getAuth:', e.message);
      return getAuth(app);
    }
  }

  // ── React Native (iOS / Android) ──
  // Step 1: Try with AsyncStorage persistence (ideal – sessions survive restarts)
  const rnPersistence = buildReactNativePersistence();
  if (rnPersistence) {
    try {
      return initializeAuth(app, { persistence: rnPersistence });
    } catch (e: any) {
      if (e.code === 'auth/already-initialized') return getAuth(app);
      // initializeAuth may have half-registered; fall through to Step 2
      console.warn('[Firebase] initializeAuth with RN persistence failed:', e.message);
    }
  }

  // Step 2: Try with in-memory persistence (sign-in works, state not persisted)
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch (e: any) {
    if (e.code === 'auth/already-initialized') return getAuth(app);
    console.warn('[Firebase] initializeAuth with inMemory persistence failed:', e.message);
  }

  // Step 3: Last-resort fallback
  console.warn('[Firebase] Using getAuth fallback');
  return getAuth(app);
}

try {
  auth = initAuth();
} catch (e) {
  // Absolute last resort — should never happen, but guarantees `auth` is never undefined
  console.error('[Firebase] All auth initialization paths failed:', e);
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app; 