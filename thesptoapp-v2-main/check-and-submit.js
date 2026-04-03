// Check existing review submissions and submit using an available one
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';

const READY_IDS = [
  'bad22265-8fd8-4c14-bd3c-3db603c33cba',
  'b4ceef8b-e4c0-46b1-b584-6a2c02ea037e',
  'c6d50094-3ebc-4171-b5ec-bc1f1ba10153',
  '6668e186-b93d-47c6-8db6-de6400ab53c5',
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
  // Step 1: Check items in each READY_FOR_REVIEW submission
  console.log('Checking items in existing READY_FOR_REVIEW submissions...\n');

  let bestSubmissionId = null;
  let hasOurVersion = false;

  for (const id of READY_IDS) {
    const res = await api('GET', '/v1/reviewSubmissions/' + id + '/items?include=appStoreVersion&limit=5');
    console.log(`Submission ${id}:`);
    console.log('  Status:', res.status);
    if (res.body.data) {
      const items = res.body.data;
      console.log('  Items count:', items.length);
      items.forEach(item => {
        const versionId = item.relationships?.appStoreVersion?.data?.id;
        console.log('  Item:', item.id, '| version:', versionId, '| state:', item.attributes?.state);
        if (versionId === VERSION_ID) {
          hasOurVersion = true;
          bestSubmissionId = id;
          console.log('  *** THIS HAS OUR VERSION ***');
        }
      });
      if (items.length === 0 && !bestSubmissionId) {
        bestSubmissionId = id; // use first empty one
        console.log('  (empty - candidate for use)');
      }
    } else {
      console.log('  Response:', JSON.stringify(res.body).substring(0, 200));
    }
    console.log();
  }

  if (!bestSubmissionId) {
    bestSubmissionId = READY_IDS[0];
    console.log('No ideal candidate found, using first submission:', bestSubmissionId);
  }

  console.log(`\nUsing submission: ${bestSubmissionId}`);

  // Step 2: If it doesn't have our version, add it
  if (!hasOurVersion) {
    console.log('\nAdding version to submission...');
    const item = await api('POST', '/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: bestSubmissionId } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
        }
      }
    });
    console.log('Add item status:', item.status);
    if (item.status !== 201) {
      console.log('Add item response:', JSON.stringify(item.body, null, 2));

      // If item already exists, that's fine - just proceed to submit
      if (item.status !== 409) {
        console.log('Cannot add item, aborting.');
        return;
      }
      console.log('Item may already exist, proceeding to submit...');
    } else {
      console.log('Item added:', item.body.data.id);
    }
  }

  // Step 3: Submit for review
  console.log('\nSubmitting for review...');
  const submit = await api('PATCH', '/v1/reviewSubmissions/' + bestSubmissionId, {
    data: {
      type: 'reviewSubmissions',
      id: bestSubmissionId,
      attributes: { submitted: true }
    }
  });

  console.log('Submit status:', submit.status);
  if (submit.status === 200) {
    console.log('\n========================================');
    console.log('SUCCESS! App submitted for Apple review!');
    console.log('========================================');
    console.log('Submission ID:', submit.body.data.id);
    console.log('State:', submit.body.data.attributes.state);
    console.log('Submitted:', submit.body.data.attributes.submittedDate);
  } else {
    console.log('Error:', JSON.stringify(submit.body, null, 2));

    // Try the old API as fallback
    console.log('\nTrying legacy appStoreVersionSubmissions API...');
    const legacySubmit = await api('POST', '/v1/appStoreVersionSubmissions', {
      data: {
        type: 'appStoreVersionSubmissions',
        relationships: {
          appStoreVersion: {
            data: { type: 'appStoreVersions', id: VERSION_ID }
          }
        }
      }
    });
    console.log('Legacy submit status:', legacySubmit.status);
    console.log('Legacy submit response:', JSON.stringify(legacySubmit.body, null, 2));
  }
}

main().catch(err => console.error('Error:', err));
