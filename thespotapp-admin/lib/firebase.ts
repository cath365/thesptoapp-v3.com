import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0",
  authDomain: "spot-app-575e9.firebaseapp.com",
  projectId: "spot-app-575e9",
  storageBucket: "spot-app-575e9.firebasestorage.app",
  messagingSenderId: "200356116293",
  appId: "1:200356116293:web:53f01b90e1d4c4812db02c",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
