const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, getDoc } = require("firebase/firestore");

const app = initializeApp({
  apiKey: "AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0",
  authDomain: "spot-app-575e9.firebaseapp.com",
  projectId: "spot-app-575e9",
  storageBucket: "spot-app-575e9.firebasestorage.app",
  messagingSenderId: "200356116293",
  appId: "1:200356116293:web:53f01b90e1d4c4812db02c",
});

const db = getFirestore(app);

async function test() {
  console.log("Testing Firestore rules for project: spot-app-575e9\n");

  // Test 1: app_config (should be public read)
  try {
    const snap = await getDoc(doc(db, "app_config", "version"));
    console.log("✅ app_config/version READ:", snap.exists() ? "EXISTS" : "EMPTY (but accessible)");
  } catch (e) {
    console.log("❌ app_config/version FAIL:", e.code);
  }

  // Test 2: articles (should be public read)
  try {
    const snap = await getDocs(collection(db, "articles"));
    console.log("✅ articles READ:", snap.size, "docs");
  } catch (e) {
    console.log("❌ articles FAIL:", e.code);
  }

  // Test 3: health_tips (should be public read)
  try {
    const snap = await getDocs(collection(db, "health_tips"));
    console.log("✅ health_tips READ:", snap.size, "docs");
  } catch (e) {
    console.log("❌ health_tips FAIL:", e.code);
  }

  // Test 4: users (should NOT be public read)
  try {
    const snap = await getDocs(collection(db, "users"));
    console.log("⚠️  users READ:", snap.size, "docs (should be denied!)");
  } catch (e) {
    console.log("✅ users DENIED as expected:", e.code);
  }
}

test().then(() => process.exit(0)).catch((e) => {
  console.log("ERR:", e.message);
  process.exit(1);
});
