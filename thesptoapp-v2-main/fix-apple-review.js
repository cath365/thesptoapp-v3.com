/**
 * fix-apple-review.js
 * Authoritative script to fix the Apple reviewer demo account.
 * Supersedes fix-demo-account.js and create-demo-account.js.
 *
 * Run: node fix-apple-review.js
 */
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────────
const KEY_ID     = 'X79F2H3QXT';
const ISSUER_ID  = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID     = '6755155637';
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';

const FIREBASE_API_KEY  = 'AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0';
const FIREBASE_PROJECT  = 'spot-app-575e9';

// The canonical Apple review demo account — freshly recreated 2026-03-31.
const DEMO_EMAIL    = 'apple.review@thespotapp.com';
// Canonical password — must match what is set in ASC.
const DEMO_PASSWORD = 'AppleReview2026!';

// Passwords used by previous (conflicting) scripts — test these first.
const LEGACY_PASSWORDS = ['SpotReview2026!', 'Review2026!'];

// ── ASC JWT ────────────────────────────────────────────────────────────────
const pk  = fs.readFileSync(path.join(__dirname, 'AuthKey_X79F2H3QXT.p8'), 'utf8');
const now = Math.floor(Date.now() / 1000);
const ascToken = jwt.sign(
  { iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
  pk,
  { algorithm: 'ES256', header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' } }
);

// ── HTTP helpers ───────────────────────────────────────────────────────────
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    if (data) opts.headers = { ...opts.headers, 'Content-Length': Buffer.byteLength(data) };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function ascApi(method, apiPath, body) {
  return request(
    {
      hostname: 'api.appstoreconnect.apple.com',
      path: apiPath,
      method,
      headers: { Authorization: 'Bearer ' + ascToken, 'Content-Type': 'application/json' },
    },
    body
  );
}

function firebaseAuth(endpoint, body) {
  return request(
    {
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:${endpoint}?key=${FIREBASE_API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    body
  );
}

function firestoreWrite(uid, idToken) {
  return request(
    {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${uid}`,
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json' },
    },
    {
      fields: {
        email:       { stringValue:  DEMO_EMAIL },
        displayName: { stringValue:  'Apple Reviewer' },
        role:        { stringValue:  'user' },
        active:      { booleanValue: true },
        createdAt:   { timestampValue: new Date().toISOString() },
        lastLogin:   { timestampValue: new Date().toISOString() },
        platform:    { stringValue:  'ios' },
      },
    }
  );
}

function firestoreRead(uid, idToken) {
  return request({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${uid}`,
    method: 'GET',
    headers: { Authorization: 'Bearer ' + idToken },
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   fix-apple-review.js                    ║');
  console.log('║   Demo account: ' + DEMO_EMAIL.padEnd(25) + '║');
  console.log('╚══════════════════════════════════════════╝\n');

  const results = {
    firebaseSignIn: false,
    firestoreActive: false,
    ascUpdated: false,
    ascVerified: false,
  };

  // ── Step 1: Fetch the real reviewDetailId from ASC ──────────────────────
  console.log('── Step 1: Fetch ASC review detail ──────────────────────────');
  const reviewDetailRes = await ascApi(
    'GET',
    `/v1/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`
  );

  let reviewDetailId = null;
  if (reviewDetailRes.status === 200 && reviewDetailRes.body.data) {
    reviewDetailId = reviewDetailRes.body.data.id;
    const attrs = reviewDetailRes.body.data.attributes;
    console.log('  reviewDetailId :', reviewDetailId);
    console.log('  demoAccountName:', attrs.demoAccountName || '(not set)');
    console.log('  demoPassword   :', attrs.demoAccountPassword ? '(set)' : '(NOT set)');
  } else {
    console.log('  No review detail found yet (will create later). Status:', reviewDetailRes.status);
  }

  // ── Step 2: Try signing in with known passwords ──────────────────────────
  console.log('\n── Step 2: Test Firebase sign-in ────────────────────────────');
  let workingToken = null;
  let workingUid   = null;

  const passwordsToTry = [...LEGACY_PASSWORDS, DEMO_PASSWORD];
  for (const pwd of passwordsToTry) {
    process.stdout.write(`  Trying password "${pwd}" ... `);
    const res = await firebaseAuth('signInWithPassword', {
      email: DEMO_EMAIL,
      password: pwd,
      returnSecureToken: true,
    });
    if (res.body.idToken) {
      console.log('SUCCESS');
      workingToken = res.body.idToken;
      workingUid   = res.body.localId;
      break;
    } else {
      console.log('failed (' + (res.body.error?.message || 'unknown') + ')');
    }
  }

  // ── Step 3a: Found a working password → update to canonical password ────
  if (workingToken) {
    console.log('\n── Step 3a: Update password to canonical value ──────────────');
    // Check if we're already on the canonical password
    const alreadyCanonical = passwordsToTry[passwordsToTry.indexOf(DEMO_PASSWORD) - (passwordsToTry.length - 1)] === undefined;
    // Always set to canonical to ensure ASC and Firebase are in sync
    const updateRes = await firebaseAuth('update', {
      idToken: workingToken,
      password: DEMO_PASSWORD,
      returnSecureToken: true,
    });
    if (updateRes.body.idToken) {
      workingToken = updateRes.body.idToken; // refresh token after password change
      console.log('  Password updated to canonical value — OK');
    } else {
      console.log('  Warning: could not update password:', updateRes.body.error?.message);
      console.log('  Continuing with existing token.');
    }
  }

  // ── Step 3b: No working password — try to create or handle EMAIL_EXISTS ──
  if (!workingToken) {
    console.log('\n── Step 3b: Attempt account creation ────────────────────────');
    const createRes = await firebaseAuth('signUp', {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      returnSecureToken: true,
    });

    if (createRes.body.idToken) {
      console.log('  Account created successfully.');
      workingToken = createRes.body.idToken;
      workingUid   = createRes.body.localId;
    } else if (createRes.body.error?.message === 'EMAIL_EXISTS') {
      console.log('\n  ┌─────────────────────────────────────────────────────────┐');
      console.log('  │ MANUAL ACTION REQUIRED                                  │');
      console.log('  │                                                         │');
      console.log('  │ The account exists in Firebase but its password is      │');
      console.log('  │ unknown and could not be changed.                       │');
      console.log('  │                                                         │');
      console.log('  │ Steps:                                                  │');
      console.log('  │  1. Open https://console.firebase.google.com            │');
      console.log('  │  2. Go to Authentication > Users                        │');
      console.log('  │  3. Find: ' + DEMO_EMAIL.padEnd(45) + '│');
      console.log('  │  4. Click the three-dot menu > Delete user              │');
      console.log('  │  5. Re-run this script                                  │');
      console.log('  └─────────────────────────────────────────────────────────┘');
      process.exit(1);
    } else {
      console.log('  FAILED to create account:', createRes.body.error?.message);
      console.log('  Full response:', JSON.stringify(createRes.body, null, 2));
      process.exit(1);
    }
  }

  // At this point we always have workingToken and workingUid.
  if (!workingUid) {
    // Fetch UID if we only refreshed a token (update path above)
    const meRes = await firebaseAuth('lookup', { idToken: workingToken });
    workingUid = meRes.body.users?.[0]?.localId;
  }

  results.firebaseSignIn = true;
  console.log('  Firebase UID:', workingUid);

  // ── Step 4: Write Firestore document ────────────────────────────────────
  console.log('\n── Step 4: Write Firestore user document ────────────────────');
  const fsWriteRes = await firestoreWrite(workingUid, workingToken);
  if (fsWriteRes.status === 200) {
    console.log('  Firestore write — OK');
  } else {
    console.log('  Firestore write FAILED (status ' + fsWriteRes.status + ')');
    console.log('  This may be a security rules issue. Error:');
    console.log(' ', JSON.stringify(fsWriteRes.body).substring(0, 400));
    console.log('  Check Firestore rules: users/{uid} must allow write when request.auth.uid == uid');
  }

  // ── Step 5: Verify Firestore active: true ────────────────────────────────
  console.log('\n── Step 5: Verify Firestore document ────────────────────────');
  const fsReadRes = await firestoreRead(workingUid, workingToken);
  if (fsReadRes.status === 200) {
    const activeField = fsReadRes.body.fields?.active;
    if (activeField?.booleanValue === true) {
      console.log('  active: true — OK');
      results.firestoreActive = true;
    } else {
      console.log('  WARNING: active field is:', JSON.stringify(activeField));
      console.log('  The user may be signed out immediately after login.');
    }
  } else {
    console.log('  Could not read Firestore document (status ' + fsReadRes.status + ')');
  }

  // ── Step 6: Update ASC review detail ────────────────────────────────────
  console.log('\n── Step 6: Update App Store Connect demo credentials ─────────');
  const ascNotes =
    'Sign in with the demo credentials provided above.\n\n' +
    'The Spot App is a sexual and reproductive health education platform ' +
    'for young women and girls in Africa, built by the Sistah Sistah Foundation.\n\n' +
    'To test the app:\n' +
    '1. Enter the demo email and password on the Sign In screen, then tap Sign In.\n' +
    '2. Home tab: Browse 9 health categories and read articles.\n' +
    '3. Period Tracker tab: Log a menstrual cycle.\n' +
    '4. Journal tab: Write a private journal entry.\n' +
    '5. Library tab: Bookmark an article and view your reading history.\n' +
    '6. Profile tab: View account settings and preferences.\n\n' +
    'Guest mode (no account required) is also available via the ' +
    '"Continue as Guest" button on the sign-in screen.\n\n' +
    'An active internet connection is required for content loading.';

  const ascBody = {
    data: {
      type: 'appStoreReviewDetails',
      attributes: {
        demoAccountName:     DEMO_EMAIL,
        demoAccountPassword: DEMO_PASSWORD,
        demoAccountRequired: true,
        notes:               ascNotes,
      },
    },
  };

  let ascUpdateRes;
  if (reviewDetailId) {
    // Update existing review detail
    ascBody.data.id = reviewDetailId;
    ascUpdateRes = await ascApi(
      'PATCH',
      `/v1/appStoreReviewDetails/${reviewDetailId}`,
      ascBody
    );
  } else {
    // Create new review detail linked to this version
    ascBody.data.relationships = {
      appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } },
    };
    ascUpdateRes = await ascApi('POST', '/v1/appStoreReviewDetails', ascBody);
  }

  if (ascUpdateRes.status === 200 || ascUpdateRes.status === 201) {
    console.log('  ASC demo credentials updated — OK');
    results.ascUpdated = true;
    reviewDetailId = reviewDetailId || ascUpdateRes.body.data?.id;
  } else {
    console.log('  ASC update FAILED (status ' + ascUpdateRes.status + ')');
    console.log('  Error:', JSON.stringify(ascUpdateRes.body, null, 2).substring(0, 600));
  }

  // ── Step 7: Verify ASC update ────────────────────────────────────────────
  console.log('\n── Step 7: Verify ASC demo credentials ──────────────────────');
  if (reviewDetailId) {
    const verifyRes = await ascApi(
      'GET',
      `/v1/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`
    );
    if (verifyRes.status === 200) {
      const attrs = verifyRes.body.data?.attributes;
      const emailOk = attrs?.demoAccountName === DEMO_EMAIL;
      const pwdSet  = !!attrs?.demoAccountPassword;
      console.log('  demoAccountName:', attrs?.demoAccountName, emailOk ? '✓' : '✗ MISMATCH');
      console.log('  demoPassword   :', pwdSet ? '(set) ✓' : '(NOT set) ✗');
      results.ascVerified = emailOk && pwdSet;
    } else {
      console.log('  Could not verify ASC (status ' + verifyRes.status + ')');
    }
  } else {
    console.log('  Skipped — no reviewDetailId available.');
  }

  // ── Step 8: Final summary ────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   RESULTS                                ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  ' + (results.firebaseSignIn  ? '[PASS]' : '[FAIL]') + ' Firebase sign-in works          ║');
  console.log('║  ' + (results.firestoreActive ? '[PASS]' : '[FAIL]') + ' Firestore document active: true ║');
  console.log('║  ' + (results.ascUpdated      ? '[PASS]' : '[FAIL]') + ' ASC credentials updated         ║');
  console.log('║  ' + (results.ascVerified     ? '[PASS]' : '[FAIL]') + ' ASC update verified             ║');
  console.log('╠══════════════════════════════════════════╣');

  const allPass = Object.values(results).every(Boolean);
  if (allPass) {
    console.log('║                                          ║');
    console.log('║  All checks passed.                      ║');
    console.log('║                                          ║');
    console.log('║  Demo account:                           ║');
    console.log('║    Email   : ' + DEMO_EMAIL.padEnd(29) + '║');
    console.log('║    Password: ' + DEMO_PASSWORD.padEnd(29) + '║');
    console.log('║                                          ║');
    console.log('║  Next: run node submit-review.js         ║');
  } else {
    console.log('║                                          ║');
    console.log('║  Some checks FAILED. See errors above.   ║');
    console.log('║  Fix the failures before resubmitting.   ║');
  }
  console.log('╚══════════════════════════════════════════╝');

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
