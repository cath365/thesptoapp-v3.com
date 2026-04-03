// Cancel old submission and resubmit
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';
const OLD_SUBMISSION_ID = '6937bae7-11ca-4bab-9e2a-4da19be11658';
const NEW_SUBMISSION_ID = '6668e186-b93d-47c6-8db6-de6400ab53c5';
const OLD_ITEM_ID = 'NjkzN2JhZTctMTFjYS00YmFiLTllMmEtNGRhMTliZTExNjU4fDZ8ODgzMzU4MzY0';

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
        catch (e) { resolve({ status: res.statusCode, body: d || '' }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Try to remove the item from the old submission
  console.log('Step 1: Removing version from old submission...');
  const removeItem = await api('DELETE', '/v1/reviewSubmissionItems/' + OLD_ITEM_ID);
  console.log('Remove item status:', removeItem.status);
  if (removeItem.status === 204 || removeItem.status === 200) {
    console.log('Item removed successfully');
  } else {
    console.log('Response:', JSON.stringify(removeItem.body, null, 2));
    
    // If we can't remove the item, try to cancel the old submission
    console.log('\nTrying to cancel old submission instead...');
    const cancel = await api('PATCH', '/v1/reviewSubmissions/' + OLD_SUBMISSION_ID, {
      data: {
        type: 'reviewSubmissions',
        id: OLD_SUBMISSION_ID,
        attributes: {
          canceled: true
        }
      }
    });
    console.log('Cancel status:', cancel.status);
    console.log('Cancel response:', JSON.stringify(cancel.body?.data?.attributes || cancel.body, null, 2));
  }

  // Step 2: Clean up - delete the new submission we created (empty one)
  console.log('\nStep 2: Cleaning up empty new submission...');
  const deleteNew = await api('DELETE', '/v1/reviewSubmissions/' + NEW_SUBMISSION_ID);
  console.log('Delete status:', deleteNew.status);

  // Step 3: Check current state of submissions
  console.log('\nStep 3: Checking submission states...');
  const subs = await api('GET', '/v1/reviewSubmissions?filter[app]=' + APP_ID + '&filter[platform]=IOS&limit=5');
  for (const s of (subs.body.data || [])) {
    console.log('  ID:', s.id, '| State:', s.attributes.state, '| Submitted:', s.attributes.submittedDate);
  }

  // Step 4: Create fresh submission and add version
  console.log('\nStep 4: Creating fresh review submission...');
  const newSub = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: {
        app: { data: { type: 'apps', id: APP_ID } }
      }
    }
  });
  console.log('Status:', newSub.status);
  if (newSub.status !== 201) {
    console.log('Error:', JSON.stringify(newSub.body, null, 2));
    return;
  }
  const subId = newSub.body.data.id;
  console.log('New submission ID:', subId, '| State:', newSub.body.data.attributes.state);

  // Step 5: Add version to submission
  console.log('\nStep 5: Adding version to submission...');
  const addItem = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
      }
    }
  });
  console.log('Status:', addItem.status);
  if (addItem.status !== 201) {
    console.log('Error:', JSON.stringify(addItem.body, null, 2));
    return;
  }
  console.log('Item added! State:', addItem.body.data.attributes.state);

  // Step 6: Submit for review
  console.log('\nStep 6: Submitting for Apple review...');
  const submit = await api('PATCH', '/v1/reviewSubmissions/' + subId, {
    data: {
      type: 'reviewSubmissions',
      id: subId,
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
    console.log('Submitted at:', submit.body.data.attributes.submittedDate);
  } else {
    console.log('Error:', JSON.stringify(submit.body, null, 2));
  }
}

main().catch(err => console.error('Error:', err));
