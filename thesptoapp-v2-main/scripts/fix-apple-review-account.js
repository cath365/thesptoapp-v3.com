#!/usr/bin/env node
/**
 * fix-apple-review-account.js
 *
 * Deletes the broken apple.review@thespotapp.com account in Firebase,
 * recreates it with the canonical password, writes the Firestore user doc,
 * and verifies sign-in works.
 *
 * REQUIRES: Firebase Admin service account JSON at
 *   configs/TheSpotApp-Firebase-Service-Account.json
 *
 * If the file is missing, download it from:
 *   https://console.firebase.google.com → Project Settings → Service Accounts
 *   → Generate New Private Key
 * Save it to configs/TheSpotApp-Firebase-Service-Account.json
 *
 * Run: node scripts/fix-apple-review-account.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const FIREBASE_API_KEY = 'AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0';
const FIREBASE_PROJECT = 'spot-app-575e9';

// The email Apple reviewers see in App Store Connect
const APPLE_REVIEW_EMAIL = 'apple.review@thespotapp.com';
const CANONICAL_PASSWORD = 'AppleReview2026!';

// Also ensure the backup demo account stays healthy
const BACKUP_EMAIL = 'demo.reviewer@thespotapp.com';

// ── Firebase REST helper ──────────────────────────────────────────────────
function firebaseAuth(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'identitytoolkit.googleapis.com',
        path: `/v1/accounts:${endpoint}?key=${FIREBASE_API_KEY}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, body: d }); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

function firestoreWrite(uid, idToken, email) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      fields: {
        email:       { stringValue: email },
        displayName: { stringValue: 'Apple Reviewer' },
        role:        { stringValue: 'user' },
        active:      { booleanValue: true },
        createdAt:   { timestampValue: new Date().toISOString() },
        lastLogin:   { timestampValue: new Date().toISOString() },
        platform:    { stringValue: 'ios' },
      },
    });
    const req = https.request(
      {
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${uid}`,
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, body: d }); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║ FIX APPLE REVIEW ACCOUNT                         ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  // ── Step 1: Try to load Firebase Admin SDK ──────────────────────────────
  const saPath = path.join(__dirname, '..', 'configs', 'TheSpotApp-Firebase-Service-Account.json');
  let admin = null;

  if (fs.existsSync(saPath)) {
    console.log('── Step 1: Firebase Admin SDK ─────────────────────────');
    try {
      const adminModule = require('firebase-admin');
      const sa = require(saPath);
      adminModule.initializeApp({ credential: adminModule.credential.cert(sa) });
      admin = adminModule;
      console.log('  Admin SDK initialised ✓\n');
    } catch (e) {
      console.log('  Admin SDK init failed:', e.message);
      console.log('  Falling back to REST-only mode.\n');
    }
  } else {
    console.log('── Step 1: Firebase Admin SDK ─────────────────────────');
    console.log('  Service account file NOT FOUND at:');
    console.log('  ' + saPath);
    console.log('  → Download from Firebase Console → Project Settings → Service Accounts');
    console.log('  → Save as configs/TheSpotApp-Firebase-Service-Account.json');
    console.log('  Falling back to REST-only mode.\n');
  }

  // ── Step 2: Check current state of apple.review account ─────────────────
  console.log('── Step 2: Check apple.review account ─────────────────');
  const signInTest = await firebaseAuth('signInWithPassword', {
    email: APPLE_REVIEW_EMAIL,
    password: CANONICAL_PASSWORD,
    returnSecureToken: true,
  });

  if (signInTest.body.idToken) {
    console.log('  ✓ apple.review already works with canonical password!');
    console.log('  UID:', signInTest.body.localId);
    console.log('  No deletion needed.\n');

    // Just ensure Firestore doc is correct
    await ensureFirestoreDoc(signInTest.body.localId, signInTest.body.idToken, APPLE_REVIEW_EMAIL);
    await verifyBothAccounts();
    return;
  }

  const errMsg = signInTest.body.error?.message;
  console.log('  Sign-in failed:', errMsg);

  // ── Step 3: Delete the broken account using Admin SDK ───────────────────
  if (admin) {
    console.log('\n── Step 3: Delete broken account via Admin SDK ────────');
    try {
      const userRecord = await admin.auth().getUserByEmail(APPLE_REVIEW_EMAIL);
      console.log('  Found user:', userRecord.uid);
      await admin.auth().deleteUser(userRecord.uid);
      console.log('  ✓ Deleted from Firebase Auth');

      // Also clean up Firestore doc
      try {
        await admin.firestore().doc(`users/${userRecord.uid}`).delete();
        console.log('  ✓ Deleted Firestore doc');
      } catch {
        console.log('  (No Firestore doc to delete)');
      }
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log('  Account does not exist (already deleted)');
      } else {
        console.log('  Delete failed:', e.message);
        console.log('  Please delete manually in Firebase Console.');
        process.exit(1);
      }
    }
  } else {
    console.log('\n── Step 3: Cannot delete account (no Admin SDK) ──────');
    console.log('  ┌───────────────────────────────────────────────────────────┐');
    console.log('  │ MANUAL ACTION REQUIRED                                    │');
    console.log('  │                                                           │');
    console.log('  │ Open: https://console.firebase.google.com                 │');
    console.log('  │ → Project: spot-app-575e9                                 │');
    console.log('  │ → Build → Authentication → Users                         │');
    console.log('  │ → Find: apple.review@thespotapp.com                       │');
    console.log('  │ → Click ⋮ menu → Delete account                          │');
    console.log('  │                                                           │');
    console.log('  │ ALTERNATIVE: Download the service account key:            │');
    console.log('  │ → Project Settings → Service Accounts                     │');
    console.log('  │ → Generate New Private Key                                │');
    console.log('  │ → Save to configs/TheSpotApp-Firebase-Service-Account.json│');
    console.log('  │ → Re-run this script                                      │');
    console.log('  └───────────────────────────────────────────────────────────┘');
    console.log('\n  After deleting, re-run: node scripts/fix-apple-review-account.js');
    process.exit(1);
  }

  // ── Step 4: Recreate the account ────────────────────────────────────────
  console.log('\n── Step 4: Create apple.review account ────────────────');
  const createRes = await firebaseAuth('signUp', {
    email: APPLE_REVIEW_EMAIL,
    password: CANONICAL_PASSWORD,
    returnSecureToken: true,
  });

  if (!createRes.body.idToken) {
    console.log('  ✗ Account creation failed:', createRes.body.error?.message);
    process.exit(1);
  }

  const uid = createRes.body.localId;
  const idToken = createRes.body.idToken;
  console.log('  ✓ Account created, UID:', uid);

  // ── Step 5: Write Firestore user document ───────────────────────────────
  await ensureFirestoreDoc(uid, idToken, APPLE_REVIEW_EMAIL);

  // ── Step 6: Verify both accounts work ───────────────────────────────────
  await verifyBothAccounts();
}

async function ensureFirestoreDoc(uid, idToken, email) {
  console.log('\n── Firestore user document ─────────────────────────');
  const fsRes = await firestoreWrite(uid, idToken, email);
  if (fsRes.status === 200) {
    console.log('  ✓ Firestore doc written (active: true, role: user)');
  } else {
    console.log('  ✗ Firestore write failed (status', fsRes.status + ')');
    console.log('  ', JSON.stringify(fsRes.body).substring(0, 300));
  }
}

async function verifyBothAccounts() {
  console.log('\n── Verify both demo accounts ───────────────────────');

  for (const email of [APPLE_REVIEW_EMAIL, BACKUP_EMAIL]) {
    process.stdout.write(`  ${email} ... `);
    const res = await firebaseAuth('signInWithPassword', {
      email,
      password: CANONICAL_PASSWORD,
      returnSecureToken: true,
    });
    if (res.body.idToken) {
      console.log('✓ OK (uid:', res.body.localId + ')');
    } else {
      console.log('✗ FAILED:', res.body.error?.message);
    }
  }

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║ NEXT STEPS                                        ║');
  console.log('║                                                    ║');
  console.log('║ 1. Run: node scripts/verify-login-flow.js          ║');
  console.log('║ 2. Update ASC: node fix-apple-review.js            ║');
  console.log('║ 3. Resubmit for review                             ║');
  console.log('╚═══════════════════════════════════════════════════╝');
}

main().catch((e) => {
  console.error('Script crashed:', e);
  process.exit(2);
});
