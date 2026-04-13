const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const key = fs.readFileSync(path.join(__dirname, 'AuthKey_X79F2H3QXT.p8'), 'utf8');
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';
const BUILD77_ID = '81752bdf-c06c-4d9a-bf04-68d597901ffd';
const APP_ID = '6755155637';

function makeToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const sig = crypto.sign('sha256', Buffer.from(header + '.' + payload), { key, dsaEncoding: 'ieee-p1363' });
  return header + '.' + payload + '.' + sig.toString('base64url');
}

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const token = makeToken();
    const opts = {
      hostname: 'api.appstoreconnect.apple.com',
      path: urlPath,
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(d ? JSON.parse(d) : {});
        else reject(new Error('HTTP ' + res.statusCode + ': ' + d));
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Step 1: Cancel current review
  console.log('Step 1: Cancelling current review...');
  try {
    // Try v1 appStoreVersionSubmission
    const sub = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '/appStoreVersionSubmission');
    console.log('  Found submission:', sub.data.id);
    await api('DELETE', '/v1/appStoreVersionSubmissions/' + sub.data.id);
    console.log('  Review cancelled via v1 API!');
  } catch (e) {
    console.log('  v1 approach failed:', e.message.substring(0, 150));
    // Try v2 reviewSubmissions
    console.log('  Trying v2 reviewSubmissions...');
    try {
      const reviews = await api('GET', '/v2/reviewSubmissions?filter[app]=' + APP_ID + '&filter[state]=WAITING_FOR_REVIEW,IN_REVIEW');
      if (reviews.data && reviews.data.length > 0) {
        const reviewId = reviews.data[0].id;
        console.log('  Found review submission:', reviewId, 'state:', reviews.data[0].attributes.state);
        await api('PATCH', '/v2/reviewSubmissions/' + reviewId, {
          data: { type: 'reviewSubmissions', id: reviewId, attributes: { canceled: true } },
        });
        console.log('  Review cancelled via v2 API!');
      } else {
        console.log('  No pending review submissions found');
      }
    } catch (e2) {
      console.error('  v2 also failed:', e2.message.substring(0, 200));
      process.exit(1);
    }
  }

  await sleep(3000);

  // Step 2: Check version state
  console.log('\nStep 2: Checking version state...');
  const ver = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '?fields[appStoreVersions]=versionString,appStoreState');
  console.log('  Version:', ver.data.attributes.versionString, 'State:', ver.data.attributes.appStoreState);

  // Step 3: Select Build 77
  console.log('\nStep 3: Selecting Build 77...');
  try {
    await api('PATCH', '/v1/appStoreVersions/' + VERSION_ID, {
      data: {
        type: 'appStoreVersions',
        id: VERSION_ID,
        relationships: {
          build: { data: { type: 'builds', id: BUILD77_ID } },
        },
      },
    });
    console.log('  Build 77 selected!');
  } catch (e) {
    console.error('  Failed to select build:', e.message.substring(0, 300));
    process.exit(1);
  }

  // Step 4: Submit for review
  console.log('\nStep 4: Submitting for review...');
  try {
    // Create review submission (v2)
    const submission = await api('POST', '/v2/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        relationships: {
          app: { data: { type: 'apps', id: APP_ID } },
        },
      },
    });
    console.log('  Review submission created:', submission.data.id);

    // Add version as item
    await api('POST', '/v2/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.data.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } },
        },
      },
    });
    console.log('  Version item added');

    // Confirm submission
    await api('PATCH', '/v2/reviewSubmissions/' + submission.data.id, {
      data: { type: 'reviewSubmissions', id: submission.data.id, attributes: { submitted: true } },
    });
    console.log('  Submitted for review!');
  } catch (e) {
    console.log('  v2 submit failed:', e.message.substring(0, 200));
    // Fallback v1
    try {
      await api('POST', '/v1/appStoreVersionSubmissions', {
        data: {
          type: 'appStoreVersionSubmissions',
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } },
          },
        },
      });
      console.log('  Submitted for review via v1!');
    } catch (e2) {
      console.error('  v1 submit also failed:', e2.message.substring(0, 300));
    }
  }

  // Step 5: Final check
  console.log('\nStep 5: Final state...');
  const final = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '?fields[appStoreVersions]=versionString,appStoreState&include=build&fields[builds]=version');
  console.log('  Version:', final.data.attributes.versionString, 'State:', final.data.attributes.appStoreState);
  if (final.included) final.included.forEach((b) => console.log('  Build:', b.attributes.version));
  console.log('\nDone!');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
