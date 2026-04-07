/**
 * DEPRECATED: Use scripts/fix-apple-review-account.js for all Apple review credential updates.
 *
 * Create a fresh demo account for Apple reviewers and update ASC.
 * Uses a new email since we can't reset the old one's password.
 */
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const pk = fs.readFileSync(path.join(__dirname, 'AuthKey_X79F2H3QXT.p8'), 'utf8');
const now = Math.floor(Date.now() / 1000);
const token = jwt.sign(
  { iss: '3ddd637a-4279-41fa-8c12-672a3c557cba', iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
  pk,
  { algorithm: 'ES256', header: { alg: 'ES256', kid: 'X79F2H3QXT', typ: 'JWT' } }
);

const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';
const FIREBASE_API_KEY = 'AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0';

// New demo account
const DEMO_EMAIL = 'demo.reviewer@thespotapp.com';
const DEMO_PASSWORD = 'AppleReview2026!';

function ascApi(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.appstoreconnect.apple.com',
      path: apiPath,
      method,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
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

function firebaseApi(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'identitytoolkit.googleapis.com',
      path: '/v1/accounts:' + endpoint + '?key=' + FIREBASE_API_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== CREATE FRESH DEMO ACCOUNT ===\n');
  console.log('WARNING: This script is deprecated. Prefer: node scripts/fix-apple-review-account.js\n');

  // Step 1: Create account in Firebase
  console.log('1. Creating Firebase account:', DEMO_EMAIL);
  const createResult = await firebaseApi('signUp', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    returnSecureToken: true,
  });

  if (createResult.body.idToken) {
    console.log('   SUCCESS: Account created');
    console.log('   UID:', createResult.body.localId);
    
    // Write Firestore user doc
    console.log('\n2. Writing Firestore user document...');
    const uid = createResult.body.localId;
    const idToken = createResult.body.idToken;
    const firestoreBody = {
      fields: {
        email: { stringValue: DEMO_EMAIL },
        displayName: { stringValue: 'Apple Reviewer' },
        role: { stringValue: 'user' },
        active: { booleanValue: true },
        createdAt: { timestampValue: new Date().toISOString() },
        lastLogin: { timestampValue: new Date().toISOString() },
        platform: { stringValue: 'ios' },
      }
    };
    const fsResult = await new Promise((resolve, reject) => {
      const data = JSON.stringify(firestoreBody);
      const opts = {
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/spot-app-575e9/databases/(default)/documents/users/${uid}`,
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + idToken,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      };
      const req = https.request(opts, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, body: d }); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    console.log('   Firestore status:', fsResult.status);
    if (fsResult.status !== 200) {
      console.log('   Note:', JSON.stringify(fsResult.body).substring(0, 300));
    }
  } else if (createResult.body.error?.message === 'EMAIL_EXISTS') {
    console.log('   Account already exists, verifying sign-in...');
  } else {
    console.log('   FAILED:', createResult.body.error?.message);
    console.log('   ', JSON.stringify(createResult.body, null, 2).substring(0, 500));
    return;
  }

  // Step 2: Verify sign-in works
  console.log('\n3. Verifying sign-in...');
  const signInResult = await firebaseApi('signInWithPassword', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    returnSecureToken: true,
  });

  if (signInResult.body.idToken) {
    console.log('   SIGN-IN WORKS!');
    console.log('   UID:', signInResult.body.localId);
    console.log('   Email:', signInResult.body.email);
  } else {
    console.log('   SIGN-IN FAILED:', signInResult.body.error?.message);
    return;
  }

  // Step 3: Update ASC demo credentials
  console.log('\n4. Updating App Store Connect demo credentials...');
  const reviewDetailId = 'c59e8444-d09e-4f9e-becd-0c237abc1235';
  const updateResult = await ascApi('PATCH', `/v1/appStoreReviewDetails/${reviewDetailId}`, {
    data: {
      type: 'appStoreReviewDetails',
      id: reviewDetailId,
      attributes: {
        demoAccountName: DEMO_EMAIL,
        demoAccountPassword: DEMO_PASSWORD,
        demoAccountRequired: true,
        notes: 'Demo account: Sign in with the demo credentials provided above. The app is a sexual and reproductive health education app for young people in Africa. All content is managed from an admin dashboard connected to Firebase.\n\nTo test:\n1. Sign in with demo credentials (email + password)\n2. Browse the Home tab for health categories and daily tips\n3. Tap any category to read health articles\n4. Use Period Tracker tab to log cycles\n5. Use Journal tab to write entries\n6. Bookmark articles in the Library tab\n7. Check Profile tab for settings\n\nGuest mode is also available via "Continue as Guest" on the sign-in screen.\n\nRequires internet connection for content.',
      },
    },
  });
  console.log('   Update status:', updateResult.status);
  if (updateResult.status === 200) {
    console.log('   SUCCESS: ASC updated with working demo credentials');
    console.log('\n=== DEMO ACCOUNT READY ===');
    console.log('Email:', DEMO_EMAIL);
    console.log('Password:', DEMO_PASSWORD);
  } else {
    console.log('   Error:', JSON.stringify(updateResult.body, null, 2).substring(0, 500));
  }
}

main().catch(err => console.error('Error:', err));
