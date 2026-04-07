/**
 * DEPRECATED: Use scripts/fix-apple-review-account.js for all Apple review credential updates.
 *
 * Fix the demo account for Apple reviewers:
 * 1. Check what demo credentials are set in App Store Connect
 * 2. Create the demo account in Firebase if it doesn't exist
 * 3. Verify sign-in works
 * 4. Update ASC with correct demo credentials if needed
 */
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

// --- ASC API setup ---
const pk = fs.readFileSync(path.join(__dirname, 'AuthKey_X79F2H3QXT.p8'), 'utf8');
const now = Math.floor(Date.now() / 1000);
const token = jwt.sign(
  { iss: '3ddd637a-4279-41fa-8c12-672a3c557cba', iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
  pk,
  { algorithm: 'ES256', header: { alg: 'ES256', kid: 'X79F2H3QXT', typ: 'JWT' } }
);

const APP_ID = '6755155637';
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';
const FIREBASE_API_KEY = 'AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0';

// Demo account credentials
const DEMO_EMAIL = 'apple.review@thespotapp.com';
const DEMO_PASSWORD = 'AppleReview2026!';

function ascApi(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.appstoreconnect.apple.com',
      path: apiPath,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
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
  console.log('=== FIX DEMO ACCOUNT FOR APPLE REVIEW ===\n');
  console.log('WARNING: This script is deprecated. Prefer: node scripts/fix-apple-review-account.js\n');

  // Step 1: Check current ASC review detail
  console.log('1. Checking App Store Connect review detail...');
  const reviewDetail = await ascApi('GET', `/v1/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
  if (reviewDetail.status === 200 && reviewDetail.body.data) {
    const attrs = reviewDetail.body.data.attributes;
    console.log('   Demo email:', attrs.demoAccountName || 'NOT SET');
    console.log('   Demo password:', attrs.demoAccountPassword ? '****' : 'NOT SET');
    console.log('   Demo required:', attrs.demoAccountRequired);
    console.log('   Contact name:', attrs.contactFirstName, attrs.contactLastName);
    console.log('   Contact email:', attrs.contactEmail);
    console.log('   Contact phone:', attrs.contactPhone);
    console.log('   Notes:', attrs.notes || 'none');
    console.log('   Review Detail ID:', reviewDetail.body.data.id);
  } else {
    console.log('   No review detail found, status:', reviewDetail.status);
    console.log('   Response:', JSON.stringify(reviewDetail.body, null, 2).substring(0, 500));
  }

  // Step 2: Try signing in with demo credentials
  console.log('\n2. Testing Firebase sign-in with demo credentials...');
  const signInResult = await firebaseApi('signInWithPassword', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    returnSecureToken: true,
  });
  
  if (signInResult.body.idToken) {
    console.log('   SUCCESS: Demo account sign-in works!');
    console.log('   UID:', signInResult.body.localId);
    console.log('   Email:', signInResult.body.email);
  } else {
    const errorMsg = signInResult.body.error?.message || 'unknown';
    console.log('   Sign-in failed:', errorMsg);
    
    if (errorMsg === 'EMAIL_NOT_FOUND' || errorMsg === 'INVALID_LOGIN_CREDENTIALS') {
      // Step 3: Create the demo account
      console.log('\n3. Creating demo account in Firebase...');
      const createResult = await firebaseApi('signUp', {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        returnSecureToken: true,
      });
      
      if (createResult.body.idToken) {
        console.log('   SUCCESS: Demo account created!');
        console.log('   UID:', createResult.body.localId);
        console.log('   Email:', createResult.body.email);
        
        // Also write user document to Firestore via REST API
        console.log('\n   Writing user doc to Firestore...');
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
        const uid = createResult.body.localId;
        const fsResult = await new Promise((resolve, reject) => {
          const data = JSON.stringify(firestoreBody);
          const opts = {
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/spot-app-575e9/databases/(default)/documents/users/${uid}`,
            method: 'PATCH',
            headers: {
              'Authorization': 'Bearer ' + createResult.body.idToken,
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
        console.log('   Firestore write status:', fsResult.status);
        if (fsResult.status !== 200) {
          console.log('   Firestore error:', JSON.stringify(fsResult.body).substring(0, 300));
        }

        // Verify sign-in now works
        console.log('\n   Verifying sign-in...');
        const verifyResult = await firebaseApi('signInWithPassword', {
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          returnSecureToken: true,
        });
        if (verifyResult.body.idToken) {
          console.log('   VERIFIED: Sign-in works!');
        } else {
          console.log('   PROBLEM: Still can\'t sign in:', verifyResult.body.error?.message);
        }
      } else {
        console.log('   FAILED to create demo account:', createResult.body.error?.message);
        console.log('   Full error:', JSON.stringify(createResult.body, null, 2).substring(0, 500));
      }
    } else if (errorMsg === 'USER_DISABLED') {
      console.log('   CRITICAL: Demo account is DISABLED! Need to enable it in Firebase Console.');
    } else {
      console.log('   Unexpected error. Full response:', JSON.stringify(signInResult.body, null, 2).substring(0, 500));
    }
  }

  // Step 4: Update ASC with demo credentials
  console.log('\n4. Updating App Store Connect demo credentials...');
  const reviewDetailId = reviewDetail.body?.data?.id;
  if (reviewDetailId) {
    const updateResult = await ascApi('PATCH', `/v1/appStoreReviewDetails/${reviewDetailId}`, {
      data: {
        type: 'appStoreReviewDetails',
        id: reviewDetailId,
        attributes: {
          demoAccountName: DEMO_EMAIL,
          demoAccountPassword: DEMO_PASSWORD,
          demoAccountRequired: true,
          notes: 'Demo account: Sign in with the demo credentials provided. The app is a sexual and reproductive health education app for young people in Africa. All content is managed from an admin dashboard. You can browse all 9 health categories, read articles, use the period tracker, write journal entries, and manage bookmarks. Guest mode is also available via "Continue as Guest" on the sign-in screen.',
        },
      },
    });
    console.log('   Update status:', updateResult.status);
    if (updateResult.status === 200) {
      console.log('   SUCCESS: Demo credentials updated in App Store Connect');
    } else {
      console.log('   Error:', JSON.stringify(updateResult.body, null, 2).substring(0, 500));
    }
  } else {
    console.log('   No review detail ID found, creating new review detail...');
    const createReview = await ascApi('POST', '/v1/appStoreReviewDetails', {
      data: {
        type: 'appStoreReviewDetails',
        attributes: {
          demoAccountName: DEMO_EMAIL,
          demoAccountPassword: DEMO_PASSWORD,
          demoAccountRequired: true,
          contactFirstName: 'Kazhinga',
          contactLastName: 'Holland',
          contactEmail: 'feministspotapp@gmail.com',
          contactPhone: '+27000000000',
          notes: 'Demo account: Sign in with the demo credentials provided. The app is a sexual and reproductive health education app for young people in Africa. All content is managed from an admin dashboard. You can browse all 9 health categories, read articles, use the period tracker, write journal entries, and manage bookmarks. Guest mode is also available via "Continue as Guest" on the sign-in screen.',
        },
        relationships: {
          appStoreVersion: {
            data: { type: 'appStoreVersions', id: VERSION_ID },
          },
        },
      },
    });
    console.log('   Create status:', createReview.status);
    if (createReview.status === 201) {
      console.log('   SUCCESS: Review detail created with demo credentials');
    } else {
      console.log('   Error:', JSON.stringify(createReview.body, null, 2).substring(0, 500));
    }
  }

  // Step 5: Check current version state
  console.log('\n5. Current version state...');
  const version = await ascApi('GET', `/v1/appStoreVersions/${VERSION_ID}?include=build`);
  if (version.status === 200) {
    console.log('   Version:', version.body.data.attributes.versionString);
    console.log('   State:', version.body.data.attributes.appStoreState);
    if (version.body.included && version.body.included[0]) {
      console.log('   Build #:', version.body.included[0].attributes.version);
      console.log('   Processing:', version.body.included[0].attributes.processingState);
    }
  }

  console.log('\n=== DONE ===');
}

main().catch(err => console.error('Error:', err));
