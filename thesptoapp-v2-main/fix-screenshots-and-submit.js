// Delete stuck screenshots and resubmit for review
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';

// Stuck screenshot IDs from the error response
const STUCK_SCREENSHOTS = [
  '3587ee4b-ab43-4156-b710-fbb5ebefaad9',
  '6ebe6070-9f30-46ac-9c1b-df304fa753d8',
  '4e9dc2ed-235a-4d80-b937-5f9819acfcb3',
  'dc927fb0-11ed-44d8-9e23-609bc5b0f694',
  'a74cd182-6f2d-400c-8330-344582a8cee2',
];

function createToken() {
  const pk = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
    pk,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' } }
  );
}

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const token = createToken();
    const opts = {
      hostname: 'api.appstoreconnect.apple.com',
      path: urlPath,
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d || '{}') });
        } catch {
          resolve({ status: res.statusCode, body: d });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Delete all stuck screenshots
  console.log('=== Step 1: Delete stuck screenshots ===');
  for (const id of STUCK_SCREENSHOTS) {
    const res = await api('DELETE', `/v1/appScreenshots/${id}`);
    console.log(`  Screenshot ${id}: ${res.status === 204 ? 'DELETED' : 'status ' + res.status}`);
    if (res.status >= 400) {
      console.log('    Error:', JSON.stringify(res.body?.errors?.[0]?.detail || res.body, null, 2));
    }
  }

  // Step 2: Check version state after cleanup
  console.log('\n=== Step 2: Check version state ===');
  const ver = await api('GET', `/v1/appStoreVersions/${VERSION_ID}`);
  console.log('Version:', ver.body.data?.attributes?.versionString, '| State:', ver.body.data?.attributes?.appStoreState);

  // Step 3: Cancel any existing active submissions
  console.log('\n=== Step 3: Clean up existing submissions ===');
  const subs = await api('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=10`);
  for (const s of subs.body.data || []) {
    const state = s.attributes.state;
    console.log(`  Submission ${s.id}: ${state}`);
    if (state === 'READY_FOR_REVIEW' || state === 'WAITING_FOR_REVIEW' || state === 'UNRESOLVED_ISSUES') {
      console.log('    Cancelling...');
      const cancel = await api('PATCH', `/v1/reviewSubmissions/${s.id}`, {
        data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } },
      });
      console.log('    Cancel status:', cancel.status, '| New state:', cancel.body.data?.attributes?.state);
    }
  }

  // Step 4: Create new review submission
  console.log('\n=== Step 4: Create review submission ===');
  const newSub = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  console.log('Status:', newSub.status);
  if (newSub.status !== 201) {
    console.log('Error:', JSON.stringify(newSub.body, null, 2));
    return;
  }
  const subId = newSub.body.data.id;
  console.log('Submission ID:', subId, '| State:', newSub.body.data.attributes.state);

  // Step 5: Add version to submission
  console.log('\n=== Step 5: Add version to submission ===');
  const addItem = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } },
      },
    },
  });
  console.log('Status:', addItem.status);
  if (addItem.status !== 201) {
    console.log('Error:', JSON.stringify(addItem.body, null, 2));
    return;
  }
  console.log('Item state:', addItem.body.data.attributes.state);

  // Step 6: Submit for review
  console.log('\n=== Step 6: Submit for review ===');
  const submit = await api('PATCH', `/v1/reviewSubmissions/${subId}`, {
    data: {
      type: 'reviewSubmissions',
      id: subId,
      attributes: { submitted: true },
    },
  });
  console.log('Status:', submit.status);
  if (submit.status >= 400) {
    console.log('Error:', JSON.stringify(submit.body, null, 2));
    return;
  }
  console.log('State:', submit.body.data?.attributes?.state);
  console.log('\n✅ Successfully submitted for Apple review!');
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
