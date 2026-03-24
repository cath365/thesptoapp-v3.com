import { initializeApp } from 'firebase/app';
import { Auth, browserLocalPersistence, getAuth, initializeAuth } from 'firebase/auth';
// @ts-expect-error getReactNativePersistence exists at runtime via Metro's react-native bundle resolution
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Your Firebase configuration
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

// Initialize Firebase Auth with platform-appropriate persistence
let auth: Auth;
try {
  if (Platform.OS === 'web') {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch (e: any) {
  if (e.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw e;
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app; 