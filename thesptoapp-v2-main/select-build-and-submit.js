// Select build 39 for version 2.1.0 and submit for Apple review
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
        } catch (e) {
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
  // Step 1: Check version state
  console.log('=== Step 1: Check current version state ===');
  const ver = await api('GET', `/v1/appStoreVersions/${VERSION_ID}?include=build`);
  console.log('Version status:', ver.status);
  const attrs = ver.body.data?.attributes;
  console.log('Version:', attrs?.versionString, '| State:', attrs?.appStoreState);
  if (ver.body.data?.relationships?.build?.data) {
    console.log('Current build ID:', ver.body.data.relationships.build.data.id);
  } else {
    console.log('No build currently selected');
  }

  // Step 2: List builds to find build 39
  console.log('\n=== Step 2: Find build 39 ===');
  const builds = await api(
    'GET',
    `/v1/builds?filter[app]=${APP_ID}&filter[version]=39&limit=5&sort=-uploadedDate`
  );
  console.log('Builds status:', builds.status);

  let buildId = null;
  if (builds.body.data && builds.body.data.length > 0) {
    for (const b of builds.body.data) {
      console.log(
        '  Build ID:', b.id,
        '| Version:', b.attributes.version,
        '| Processing:', b.attributes.processingState,
        '| Expired:', b.attributes.expired
      );
      if (b.attributes.version === '39') {
        buildId = b.id;
      }
    }
  }

  if (!buildId) {
    console.log('Build 39 not found. Listing recent builds...');
    const recent = await api(
      'GET',
      `/v1/builds?filter[app]=${APP_ID}&limit=5&sort=-uploadedDate`
    );
    for (const b of (recent.body.data || [])) {
      console.log(
        '  Build ID:', b.id,
        '| Version:', b.attributes.version,
        '| Processing:', b.attributes.processingState
      );
      // Pick the first valid (non-expired) one with highest version
      if (!buildId && b.attributes.version === '39') {
        buildId = b.id;
      }
    }
  }

  if (!buildId) {
    // If still not found, it may still be processing. List all recent.
    console.log('\nBuild 39 may still be processing. Trying all recent builds...');
    const all = await api(
      'GET',
      `/v1/builds?filter[app]=${APP_ID}&limit=10&sort=-uploadedDate`
    );
    for (const b of (all.body.data || [])) {
      console.log(
        '  Build ID:', b.id,
        '| Number:', b.attributes.version,
        '| Processing:', b.attributes.processingState
      );
    }
    // Use the latest build
    if (all.body.data && all.body.data.length > 0) {
      buildId = all.body.data[0].id;
      console.log('Using latest build:', buildId);
    } else {
      console.log('ERROR: No builds found');
      return;
    }
  }

  console.log('\nSelected build ID:', buildId);

  // Step 3: Check if build is processed
  console.log('\n=== Step 3: Check build processing state ===');
  const buildInfo = await api('GET', `/v1/builds/${buildId}`);
  const pState = buildInfo.body.data?.attributes?.processingState;
  console.log('Processing state:', pState);

  if (pState === 'PROCESSING') {
    console.log('Build is still processing by Apple. Please wait and retry.');
    console.log('Run this script again in a few minutes.');
    return;
  }

  // Step 4: Select the build for the version
  console.log('\n=== Step 4: Select build for version ===');
  const selectBuild = await api(
    'PATCH',
    `/v1/appStoreVersions/${VERSION_ID}/relationships/build`,
    {
      data: {
        type: 'builds',
        id: buildId,
      },
    }
  );
  console.log('Select build status:', selectBuild.status);
  if (selectBuild.status >= 400) {
    console.log('Error:', JSON.stringify(selectBuild.body, null, 2));
    // Continue anyway to check state
  } else {
    console.log('Build selected successfully!');
  }

  // Step 5: Check for existing review submissions
  console.log('\n=== Step 5: Check existing submissions ===');
  const existingSubs = await api(
    'GET',
    `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=5`
  );

  let activeSubId = null;
  for (const s of existingSubs.body.data || []) {
    const state = s.attributes.state;
    console.log('  Submission ID:', s.id, '| State:', state);
    if (
      state === 'READY_FOR_REVIEW' ||
      state === 'WAITING_FOR_REVIEW' ||
      state === 'UNRESOLVED_ISSUES'
    ) {
      activeSubId = s.id;
    }
  }

  // Step 6: Cancel any blocking submissions
  if (activeSubId) {
    console.log('\n=== Step 6: Cancel blocking submission ===');
    const cancel = await api('PATCH', `/v1/reviewSubmissions/${activeSubId}`, {
      data: {
        type: 'reviewSubmissions',
        id: activeSubId,
        attributes: { canceled: true },
      },
    });
    console.log('Cancel status:', cancel.status);
    if (cancel.status >= 400) {
      console.log('Cancel error:', JSON.stringify(cancel.body, null, 2));
    } else {
      console.log('Cancelled. State:', cancel.body.data?.attributes?.state);
    }
  }

  // Step 7: Create new review submission
  console.log('\n=== Step 7: Create review submission ===');
  const newSub = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: {
        app: { data: { type: 'apps', id: APP_ID } },
      },
    },
  });
  console.log('Create status:', newSub.status);
  if (newSub.status !== 201) {
    console.log('Error:', JSON.stringify(newSub.body, null, 2));
    return;
  }
  const subId = newSub.body.data.id;
  console.log('Submission ID:', subId, '| State:', newSub.body.data.attributes.state);

  // Step 8: Add version to submission
  console.log('\n=== Step 8: Add version to submission ===');
  const addItem = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: {
          data: { type: 'reviewSubmissions', id: subId },
        },
        appStoreVersion: {
          data: { type: 'appStoreVersions', id: VERSION_ID },
        },
      },
    },
  });
  console.log('Add item status:', addItem.status);
  if (addItem.status !== 201) {
    console.log('Error:', JSON.stringify(addItem.body, null, 2));
    return;
  }
  console.log('Item state:', addItem.body.data.attributes.state);

  // Step 9: Submit for review
  console.log('\n=== Step 9: Submit for review ===');
  const submit = await api('PATCH', `/v1/reviewSubmissions/${subId}`, {
    data: {
      type: 'reviewSubmissions',
      id: subId,
      attributes: { submitted: true },
    },
  });
  console.log('Submit status:', submit.status);
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
