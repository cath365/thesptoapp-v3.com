// Deep investigation of Apple rejection reason
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

function api(method, urlPath) {
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
    req.end();
  });
}

async function main() {
  const results = [];

  // 1. Check appStoreVersions with rejectionReasons included
  results.push('=== 1. VERSION REJECTION DETAILS ===');
  const ver = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '?include=appStoreVersionSubmission,build');
  results.push('State: ' + ver.body.data?.attributes?.appStoreState);
  results.push('Included types: ' + (ver.body.included || []).map(i => i.type + '/' + i.id).join(', '));

  // 2. Check all review submissions with items
  results.push('\n=== 2. ALL REVIEW SUBMISSIONS ===');
  const subs = await api('GET', '/v1/reviewSubmissions?filter[app]=' + APP_ID + '&filter[platform]=IOS&limit=10&include=items');
  for (const s of (subs.body.data || [])) {
    results.push('  Sub: ' + s.id + ' | state: ' + s.attributes.state + ' | submitted: ' + s.attributes.submittedDate);
  }
  for (const inc of (subs.body.included || [])) {
    results.push('  Included: type=' + inc.type + ' id=' + inc.id + ' state=' + inc.attributes?.state);
  }

  // 3. Check the COMPLETED submission that was the rejection (2d551f76)
  results.push('\n=== 3. REJECTION SUBMISSION DETAILS (2d551f76) ===');
  const rejSub = await api('GET', '/v1/reviewSubmissions/2d551f76-ad11-4e93-b4f4-aa65c4c8797c?include=items');
  results.push('State: ' + rejSub.body.data?.attributes?.state);
  for (const inc of (rejSub.body.included || [])) {
    results.push('  Item: ' + inc.id + ' state=' + inc.attributes?.state);
  }

  // 4. Try app store version resolution center
  results.push('\n=== 4. RESOLUTION CENTER / CUSTOMER REVIEWS ===');
  const appResolutions = await api('GET', '/v1/apps/' + APP_ID + '/customerReviews?limit=5');
  results.push('Customer reviews status: ' + appResolutions.status);
  if (appResolutions.body.data) {
    for (const r of appResolutions.body.data) {
      results.push('  Review: ' + JSON.stringify(r.attributes));
    }
  }

  // 5. Check app events / submissions
  results.push('\n=== 5. APP STORE REVIEW DETAIL (contact/notes) ===');
  const reviewDetail = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '/appStoreReviewDetail');
  if (reviewDetail.body.data) {
    const rd = reviewDetail.body.data.attributes;
    results.push('Contact: ' + rd.contactFirstName + ' ' + rd.contactLastName);
    results.push('Email: ' + rd.contactEmail);
    results.push('Phone: ' + rd.contactPhone);
    results.push('Demo user: ' + rd.demoAccountName);
    results.push('Demo password: ' + (rd.demoAccountPassword ? '***set***' : '(EMPTY!)'));
    results.push('Notes: ' + rd.notes);
  }

  // 6. Try to get rejection reasons via appStoreVersionSubmission
  results.push('\n=== 6. VERSION SUBMISSION OBJECT ===');
  const vSub = await api('GET', '/v1/appStoreVersionSubmissions?filter[appStoreVersion]=' + VERSION_ID);
  results.push('Status: ' + vSub.status);
  results.push('Data: ' + JSON.stringify(vSub.body, null, 2).substring(0, 500));

  // 7. Check submission items from the original rejection (6937bae7)
  results.push('\n=== 7. ORIGINAL REJECTION SUBMISSION (6937bae7) ===');
  const origSub = await api('GET', '/v1/reviewSubmissions/6937bae7-11ca-4bab-9e2a-4da19be11658?include=items,lastUpdatedByActor');
  results.push('State: ' + origSub.body.data?.attributes?.state);
  results.push('Full attrs: ' + JSON.stringify(origSub.body.data?.attributes, null, 2));
  for (const inc of (origSub.body.included || [])) {
    results.push('  Included: ' + inc.type + ' | ' + inc.id + ' | ' + JSON.stringify(inc.attributes || {}));
  }

  // 8. Try the older v1 appStoreVersions endpoint with rejection reasons
  results.push('\n=== 8. APP INFO (REJECTION STATE) ===');
  const appInfos = await api('GET', '/v1/apps/' + APP_ID + '/appInfos?include=appInfoLocalizations&limit=5');
  for (const info of (appInfos.body.data || [])) {
    results.push('  AppInfo: ' + info.id + ' state=' + info.attributes.appStoreState);
  }

  // 9. Check build 20 (the rejected build) details
  results.push('\n=== 9. REJECTED BUILD 20 DETAILS ===');
  const build20 = await api('GET', '/v1/builds/6a8206ab-6975-4cb4-b0db-bc80d3f18360?include=betaBuildLocalizations,buildBetaDetail,betaAppReviewSubmission');
  if (build20.body.data) {
    results.push('Build #: ' + build20.body.data.attributes.version);
    results.push('Processing: ' + build20.body.data.attributes.processingState);
  }
  for (const inc of (build20.body.included || [])) {
    results.push('  Included: ' + inc.type + ' | ' + JSON.stringify(inc.attributes));
  }

  // 10. Check for app store version phasedRelease, routingAppCoverage
  results.push('\n=== 10. VERSION ROUTING/COVERAGE ===');
  const routing = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '/routingAppCoverage');
  results.push('Routing status: ' + routing.status);
  if (routing.status === 200 && routing.body.data) {
    results.push('Routing: ' + JSON.stringify(routing.body.data.attributes));
  }

  // 11. Check privacy / app clips
  results.push('\n=== 11. APP PRIVACY ===');
  const privacy = await api('GET', '/v1/apps/' + APP_ID + '/appClips');
  results.push('App clips status: ' + privacy.status);

  // Write everything to file
  const output = results.join('\n');
  console.log(output);
  fs.writeFileSync(path.join(__dirname, 'rejection-details.txt'), output);
}

main().catch(err => console.error('Error:', err));
