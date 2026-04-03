/**
 * Find build 25, attach it to version 2.1.0, and resubmit for review.
 */
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';

function createToken() {
  const pk = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }, pk, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' }
  });
}

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const token = createToken();
    const opts = {
      hostname: 'api.appstoreconnect.apple.com',
      path: urlPath,
      method,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }); }
        catch (e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== RESUBMIT WITH BUILD 25 ===\n');

  // 1. Check current version state
  console.log('1. Current version state...');
  const ver = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '?include=build');
  console.log('   Version:', ver.body.data?.attributes?.versionString);
  console.log('   State:', ver.body.data?.attributes?.appStoreState);
  if (ver.body.included && ver.body.included[0]) {
    console.log('   Current build #:', ver.body.included[0].attributes?.version);
    console.log('   Build ID:', ver.body.included[0].id);
  }

  // 2. Build 25 is VALID
  const BUILD_25_ID = 'ba6c1b6d-cbce-4895-834d-0fe4022d7924';
  console.log('\n2. Using build 25 (VALID)');
  console.log('   Build 25 ID:', BUILD_25_ID);

  // 3. Attach build 25 to version 2.1.0
  console.log('\n3. Attaching build 25 to version 2.1.0...');
  const attach = await api('PATCH', '/v1/appStoreVersions/' + VERSION_ID, {
    data: {
      type: 'appStoreVersions',
      id: VERSION_ID,
      relationships: {
        build: {
          data: {
            type: 'builds',
            id: BUILD_25_ID
          }
        }
      }
    }
  });
  console.log('   Status:', attach.status);
  if (attach.status === 200) {
    console.log('   ✓ Build 25 attached to version 2.1.0');
  } else {
    console.log('   ✗ Failed:', JSON.stringify(attach.body.errors || attach.body, null, 2));
    return;
  }

  // 4. Cancel any existing review submission
  console.log('\n4. Checking for existing review submissions...');
  const subs = await api('GET', '/v1/reviewSubmissions?filter[app]=' + APP_ID + '&filter[state]=WAITING_FOR_REVIEW,IN_REVIEW');
  if (subs.body.data && subs.body.data.length > 0) {
    for (const s of subs.body.data) {
      console.log('   Cancelling submission:', s.id, 'state:', s.attributes?.state);
      const cancel = await api('PATCH', '/v1/reviewSubmissions/' + s.id, {
        data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } }
      });
      console.log('   Cancel status:', cancel.status);
    }
  } else {
    console.log('   No active submissions to cancel');
  }

  // 5. Create new review submission
  console.log('\n5. Creating new review submission...');
  const newSub = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } }
    }
  });
  if (newSub.status !== 201) {
    console.log('   ✗ Failed to create submission:', JSON.stringify(newSub.body.errors || newSub.body, null, 2));
    return;
  }
  const SUB_ID = newSub.body.data.id;
  console.log('   ✓ Submission created:', SUB_ID);

  // 6. Add version to submission
  console.log('\n6. Adding version to submission...');
  const addItem = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: SUB_ID } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
      }
    }
  });
  if (addItem.status !== 201) {
    console.log('   ✗ Failed to add item:', JSON.stringify(addItem.body.errors || addItem.body, null, 2));
    return;
  }
  console.log('   ✓ Version added to submission');

  // 7. Submit for review
  console.log('\n7. Submitting for Apple review...');
  const submit = await api('PATCH', '/v1/reviewSubmissions/' + SUB_ID, {
    data: {
      type: 'reviewSubmissions',
      id: SUB_ID,
      attributes: { submitted: true }
    }
  });
  console.log('   Status:', submit.status);
  if (submit.status === 200) {
    console.log('   ✓ SUBMITTED FOR REVIEW!');
    console.log('   State:', submit.body.data?.attributes?.state);
  } else {
    console.log('   ✗ Failed:', JSON.stringify(submit.body.errors || submit.body, null, 2));
  }

  // 8. Final verification
  console.log('\n8. Final verification...');
  const finalVer = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '?include=build');
  console.log('   Version:', finalVer.body.data?.attributes?.versionString);
  console.log('   State:', finalVer.body.data?.attributes?.appStoreState);
  if (finalVer.body.included && finalVer.body.included[0]) {
    console.log('   Build #:', finalVer.body.included[0].attributes?.version);
  }
  
  console.log('\n=== DONE ===');
}

main().catch(console.error);
