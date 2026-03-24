/**
 * Seed initial safe deployment configuration in Firestore.
 *
 * Step 3 of the deployment pipeline:
 *   disableUpdates = true
 *   rolloutPercentage = 0
 *   forceUpdate = false
 *
 * Usage:
 *   node scripts/seed-safe-config.js
 *
 * This uses the Firebase Admin SDK via the client-side JS SDK
 * (no service account needed — relies on Firestore rules allowing
 * signed-in admin writes, but here we write to public-read docs).
 *
 * NOTE: app_config/* has `allow read: if true` so we can read,
 * but writes require admin. Run this AFTER signing in as admin
 * through the admin dashboard, or use the dashboard UI directly.
 */
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc, getDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0",
  authDomain: "spot-app-575e9.firebaseapp.com",
  projectId: "spot-app-575e9",
  storageBucket: "spot-app-575e9.firebasestorage.app",
  messagingSenderId: "200356116293",
  appId: "1:200356116293:web:53f01b90e1d4c4812db02c",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verifyConfig() {
  console.log("\n📖 Reading current Firestore config...\n");

  const versionSnap = await getDoc(doc(db, "app_config", "version"));
  const rolloutSnap = await getDoc(doc(db, "app_config", "rollout"));
  const featuresSnap = await getDoc(doc(db, "app_config", "features"));

  console.log("app_config/version:", versionSnap.exists() ? versionSnap.data() : "NOT SET");
  console.log("app_config/rollout:", rolloutSnap.exists() ? rolloutSnap.data() : "NOT SET");
  console.log("app_config/features:", featuresSnap.exists() ? featuresSnap.data() : "NOT SET");

  // Validation checks
  const issues = [];

  if (rolloutSnap.exists()) {
    const rollout = rolloutSnap.data();
    if (rollout.disableUpdates !== true) {
      issues.push("⚠️  disableUpdates is not true — updates are live!");
    }
    if (typeof rollout.rolloutPercentage === "number" && rollout.rolloutPercentage > 0) {
      issues.push(`⚠️  rolloutPercentage is ${rollout.rolloutPercentage}% — should be 0 before OTA is verified`);
    }
  } else {
    issues.push("ℹ️  app_config/rollout not set — defaults will be used (100% rollout, updates enabled)");
  }

  if (versionSnap.exists()) {
    const ver = versionSnap.data();
    if (ver.forceUpdate === true) {
      issues.push("⚠️  forceUpdate is ON — users below minimum version will be blocked");
    }
  } else {
    issues.push("ℹ️  app_config/version not set — no version gate active");
  }

  if (issues.length > 0) {
    console.log("\n🔍 Issues found:");
    issues.forEach((i) => console.log("  " + i));
  } else {
    console.log("\n✅ Configuration looks safe for initial deployment");
  }

  console.log("\n💡 To set safe initial config, use the admin dashboard:");
  console.log("   1. Open /dashboard/deployment");
  console.log("   2. Set Kill Switch = ON");
  console.log("   3. Set Rollout Percentage = 0%");
  console.log("   4. Set Force Update = OFF");
  console.log("   5. Click Save Rollout, then Save Config");
  console.log("");
}

verifyConfig()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
