// Check rejection reason and select build 22
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';
const NEW_BUILD_ID = '23b7a10f-06b9-4155-a7b0-4fbe23e02d97';
const REVIEW_SUB_ID = '6937bae7-11ca-4bab-9e2a-4da19be11658';

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
  // 1. Check the rejection review submission items
  console.log('=== REJECTION REVIEW SUBMISSION (6937bae7) ===');
  const subItems = await api('GET', '/v1/reviewSubmissions/' + REVIEW_SUB_ID + '/items');
  console.log('Items:', JSON.stringify(subItems.body, null, 2));

  // 2. Check app resolution center / customer reviews
  console.log('\n=== CHECKING RESOLUTION CENTER ===');
  const resolutions = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '?include=appStoreVersionSubmission');
  console.log('Version with submission:', JSON.stringify(resolutions.body.included || [], null, 2));

  // 3. Check submission for the rejected review
  console.log('\n=== SUBMISSION DETAILS ===');
  const subDetail = await api('GET', '/v1/reviewSubmissions/' + REVIEW_SUB_ID);
  console.log('State:', subDetail.body.data?.attributes?.state);
  console.log('Platform:', subDetail.body.data?.attributes?.platform);
  console.log('Submitted:', subDetail.body.data?.attributes?.submittedDate);
  console.log('Full:', JSON.stringify(subDetail.body.data?.attributes, null, 2));

  // 4. Try to find rejection reason via older endpoint
  console.log('\n=== APP STORE VERSION SUBMISSION ===');
  const vSub = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '/appStoreVersionSubmission');
  console.log('Status:', vSub.status);
  console.log('Response:', JSON.stringify(vSub.body, null, 2));

  // 5. Check build 20 beta feedback / app resolution
  console.log('\n=== CHECKING PREVIOUS COMPLETED REVIEWS ===');
  const sub2 = await api('GET', '/v1/reviewSubmissions/2d551f76-ad11-4e93-b4f4-aa65c4c8797c');
  console.log('State:', sub2.body.data?.attributes?.state);
  console.log('Submitted:', sub2.body.data?.attributes?.submittedDate);

  // 6. Now select build 22 for version 2.1.0
  console.log('\n=== SELECTING BUILD 22 FOR VERSION 2.1.0 ===');
  const selectBuild = await api('PATCH', '/v1/appStoreVersions/' + VERSION_ID, {
    data: {
      type: 'appStoreVersions',
      id: VERSION_ID,
      relationships: {
        build: {
          data: {
            type: 'builds',
            id: NEW_BUILD_ID
          }
        }
      }
    }
  });
  console.log('Status:', selectBuild.status);
  if (selectBuild.status === 200) {
    console.log('SUCCESS! Build 22 is now selected for version 2.1.0');
  } else {
    console.log('Response:', JSON.stringify(selectBuild.body, null, 2));
  }

  // 7. Verify build is now attached
  console.log('\n=== VERIFYING BUILD ATTACHMENT ===');
  const verify = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '/build');
  if (verify.body.data) {
    console.log('Attached build ID:', verify.body.data.id);
    console.log('Build number:', verify.body.data.attributes.version);
    console.log('Processing:', verify.body.data.attributes.processingState);
    if (verify.body.data.id === NEW_BUILD_ID) {
      console.log('CONFIRMED: Build 22 is correctly attached!');
    } else {
      console.log('ERROR: Wrong build still attached!');
    }
  }
}

main().catch(err => console.error('Error:', err));
