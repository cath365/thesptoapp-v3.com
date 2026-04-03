// Wait for old submission to finish canceling, then submit
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Wait for old submission to finish canceling
  console.log('Waiting for old submission to finish canceling...');
  for (let i = 0; i < 30; i++) {
    const check = await api('GET', '/v1/reviewSubmissions/' + OLD_SUBMISSION_ID);
    const state = check.body.data?.attributes?.state;
    console.log('  Attempt ' + (i + 1) + ': state = ' + state);
    if (state !== 'CANCELING') {
      console.log('Cancellation complete! State: ' + state);
      break;
    }
    await sleep(5000);
  }

  // Check all current submissions
  console.log('\nCurrent submissions:');
  const subs = await api('GET', '/v1/reviewSubmissions?filter[app]=' + APP_ID + '&filter[platform]=IOS&limit=5');
  for (const s of (subs.body.data || [])) {
    console.log('  ' + s.id + ' | ' + s.attributes.state);
  }

  // Find an existing READY_FOR_REVIEW submission to use, or create one
  let subId;
  const ready = (subs.body.data || []).find(s => s.attributes.state === 'READY_FOR_REVIEW');
  if (ready) {
    subId = ready.id;
    console.log('\nUsing existing READY_FOR_REVIEW submission: ' + subId);
  } else {
    console.log('\nCreating new review submission...');
    const newSub = await api('POST', '/v1/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: APP_ID } } }
      }
    });
    if (newSub.status !== 201) {
      console.log('Error:', JSON.stringify(newSub.body, null, 2));
      return;
    }
    subId = newSub.body.data.id;
    console.log('Created:', subId);
  }

  // Add version to submission
  console.log('\nAdding version to submission...');
  const addItem = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
      }
    }
  });
  console.log('Add item status:', addItem.status);
  if (addItem.status !== 201) {
    console.log('Error:', JSON.stringify(addItem.body, null, 2));
    // If still part of old submission, try removing from old one
    if (addItem.body?.errors?.[0]?.code === 'STATE_ERROR.ITEM_PART_OF_ANOTHER_SUBMISSION') {
      console.log('\nStill linked to old submission. Trying to remove item...');
      const items = await api('GET', '/v1/reviewSubmissions/' + OLD_SUBMISSION_ID + '/items');
      for (const item of (items.body.data || [])) {
        console.log('Deleting item:', item.id);
        const del = await api('DELETE', '/v1/reviewSubmissionItems/' + item.id);
        console.log('Delete status:', del.status, JSON.stringify(del.body));
      }
      // Retry adding
      console.log('\nRetrying add version...');
      const retry = await api('POST', '/v1/reviewSubmissionItems', {
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } },
            appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
          }
        }
      });
      console.log('Retry status:', retry.status);
      if (retry.status !== 201) {
        console.log('Retry error:', JSON.stringify(retry.body, null, 2));
        return;
      }
    } else {
      return;
    }
  }

  // Submit
  console.log('\nSubmitting for review...');
  const submit = await api('PATCH', '/v1/reviewSubmissions/' + subId, {
    data: {
      type: 'reviewSubmissions',
      id: subId,
      attributes: { submitted: true }
    }
  });
  console.log('Submit status:', submit.status);
  if (submit.status === 200) {
    console.log('\n========================================');
    console.log('SUCCESS! App submitted for Apple review!');
    console.log('========================================');
    console.log('State:', submit.body.data.attributes.state);
    console.log('Submitted:', submit.body.data.attributes.submittedDate);
  } else {
    console.log('Error:', JSON.stringify(submit.body, null, 2));
  }
}

main().catch(err => console.error('Error:', err));
