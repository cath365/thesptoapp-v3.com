// Submit version 2.1.0 with build 22 for Apple review
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
  // Step 1: Create a new review submission
  console.log('Step 1: Creating review submission...');
  const submission = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: {
        platform: 'IOS'
      },
      relationships: {
        app: {
          data: {
            type: 'apps',
            id: APP_ID
          }
        }
      }
    }
  });

  console.log('Status:', submission.status);
  if (submission.status !== 201) {
    console.log('Error creating submission:', JSON.stringify(submission.body, null, 2));
    // Check if there's an existing pending submission we can use
    if (submission.status === 409) {
      console.log('\nExisting submission conflict. Checking current submissions...');
      const existing = await api('GET', '/v1/reviewSubmissions?filter[app]=' + APP_ID + '&filter[platform]=IOS&filter[state]=WAITING_FOR_REVIEW,READY_FOR_REVIEW,UNRESOLVED_ISSUES&limit=5');
      console.log('Existing submissions:', JSON.stringify(existing.body, null, 2));
    }
    return;
  }

  const submissionId = submission.body.data.id;
  console.log('Submission ID:', submissionId);
  console.log('State:', submission.body.data.attributes.state);

  // Step 2: Add the app store version as an item to the submission
  console.log('\nStep 2: Adding version to submission...');
  const item = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: {
          data: {
            type: 'reviewSubmissions',
            id: submissionId
          }
        },
        appStoreVersion: {
          data: {
            type: 'appStoreVersions',
            id: VERSION_ID
          }
        }
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

  // Step 3: Submit for review
  console.log('\nStep 3: Submitting for review...');
  const submit = await api('PATCH', '/v1/reviewSubmissions/' + submissionId, {
    data: {
      type: 'reviewSubmissions',
      id: submissionId,
      attributes: {
        submitted: true
      }
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
