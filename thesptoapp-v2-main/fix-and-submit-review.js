// Cancel stale review submissions, then submit v2.1.0 build for review
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';

// Stale submission IDs to cancel
const STALE_IDS = [
  'bad22265-8fd8-4c14-bd3c-3db603c33cba',
  'b4ceef8b-e4c0-46b1-b584-6a2c02ea037e',
  'c6d50094-3ebc-4171-b5ec-bc1f1ba10153',
  '6668e186-b93d-47c6-8db6-de6400ab53c5',
  'ffa9e3d8-85e2-4b40-9088-32cefa349456',
];

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
  // Step 1: Cancel all stale submissions
  console.log('Step 1: Cancelling stale review submissions...');
  for (const id of STALE_IDS) {
    const res = await api('DELETE', '/v1/reviewSubmissions/' + id);
    console.log(`  DELETE ${id} -> ${res.status}`);
    if (res.status !== 204 && res.status !== 200) {
      console.log('  Response:', JSON.stringify(res.body));
    }
  }

  // Small delay to let Apple process the cancellations
  await new Promise(r => setTimeout(r, 2000));

  // Step 2: Create a new review submission
  console.log('\nStep 2: Creating new review submission...');
  const submission = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: {
        app: { data: { type: 'apps', id: APP_ID } }
      }
    }
  });

  console.log('Status:', submission.status);
  if (submission.status !== 201) {
    console.log('Error:', JSON.stringify(submission.body, null, 2));
    return;
  }

  const submissionId = submission.body.data.id;
  console.log('Submission ID:', submissionId);
  console.log('State:', submission.body.data.attributes.state);

  // Step 3: Add app store version as item
  console.log('\nStep 3: Adding version to submission...');
  const item = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
      }
    }
  });

  console.log('Status:', item.status);
  if (item.status !== 201) {
    console.log('Error adding item:', JSON.stringify(item.body, null, 2));
    return;
  }
  console.log('Item ID:', item.body.data.id);
  console.log('Item state:', item.body.data.attributes.state);

  // Step 4: Submit for review
  console.log('\nStep 4: Submitting for review...');
  const submit = await api('PATCH', '/v1/reviewSubmissions/' + submissionId, {
    data: {
      type: 'reviewSubmissions',
      id: submissionId,
      attributes: { submitted: true }
    }
  });

  console.log('Status:', submit.status);
  if (submit.status === 200) {
    console.log('\n========================================');
    console.log('SUCCESS! App submitted for Apple review!');
    console.log('========================================');
    console.log('Submission ID:', submit.body.data.id);
    console.log('State:', submit.body.data.attributes.state);
    console.log('Submitted:', submit.body.data.attributes.submittedDate);
  } else {
    console.log('Error submitting:', JSON.stringify(submit.body, null, 2));
  }
}

main().catch(err => console.error('Error:', err));
