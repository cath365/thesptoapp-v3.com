// Pre-submission audit: check version state, metadata, build, screenshots, rejection info
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
  const issues = [];

  // 1. Version details
  console.log('=== APP STORE VERSION 2.1.0 ===');
  const ver = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '?include=build');
  const attrs = ver.body.data.attributes;
  console.log('  Version:', attrs.versionString);
  console.log('  State:', attrs.appStoreState);
  console.log('  Release type:', attrs.releaseType);
  console.log('  Created:', attrs.createdDate);
  if (attrs.appStoreState !== 'REJECTED' && attrs.appStoreState !== 'PREPARE_FOR_SUBMISSION' && attrs.appStoreState !== 'DEVELOPER_REJECTED') {
    issues.push('Version state is ' + attrs.appStoreState + ' - may not be editable');
  }

  // 2. App info
  console.log('\n=== APP INFO ===');
  const app = await api('GET', '/v1/apps/' + APP_ID);
  console.log('  Name:', app.body.data.attributes.name);
  console.log('  Bundle ID:', app.body.data.attributes.bundleId);
  console.log('  SKU:', app.body.data.attributes.sku);
  console.log('  Content rights:', app.body.data.attributes.contentRightsDeclaration);

  // 3. App info details (age rating, category)
  console.log('\n=== APP INFO DETAILS ===');
  const appInfos = await api('GET', '/v1/apps/' + APP_ID + '/appInfos?limit=5');
  for (const info of (appInfos.body.data || [])) {
    console.log('  Info ID:', info.id);
    console.log('  State:', info.attributes.appStoreState);
    console.log('  Age rating:', info.attributes.appStoreAgeRating);
    console.log('  Category:', info.attributes.primaryCategory);
    
    // Get age rating declaration
    const ageRating = await api('GET', '/v1/appInfos/' + info.id + '/ageRatingDeclaration');
    if (ageRating.body.data) {
      const ar = ageRating.body.data.attributes;
      console.log('  Age rating details:', JSON.stringify(ar, null, 2));
    }
  }

  // 4. Localizations
  console.log('\n=== VERSION LOCALIZATIONS ===');
  const locs = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '/appStoreVersionLocalizations');
  for (const l of (locs.body.data || [])) {
    const a = l.attributes;
    console.log('  Locale:', a.locale);
    console.log('    Description:', (a.description || '').substring(0, 100) + ((a.description || '').length > 100 ? '...' : ''));
    console.log('    Description length:', (a.description || '').length);
    console.log("    What's New:", a.whatsNew || '(EMPTY)');
    console.log('    Keywords:', a.keywords || '(EMPTY)');
    console.log('    Support URL:', a.supportUrl || '(EMPTY)');
    console.log('    Marketing URL:', a.marketingUrl || '(empty)');
    console.log('    Promotional text:', a.promotionalText || '(empty)');

    if (!a.description || a.description.length < 10) issues.push('Description too short for locale ' + a.locale);
    if (!a.whatsNew) issues.push("Missing What's New for locale " + a.locale);
    if (!a.supportUrl) issues.push('Missing Support URL for locale ' + a.locale);
    if (!a.keywords) issues.push('Missing keywords for locale ' + a.locale);

    // Screenshots
    const ssSet = await api('GET', '/v1/appStoreVersionLocalizations/' + l.id + '/appScreenshotSets');
    const sets = ssSet.body.data || [];
    console.log('    Screenshot sets:', sets.length);
    for (const ss of sets) {
      const shots = await api('GET', '/v1/appScreenshotSets/' + ss.id + '/appScreenshots');
      const count = (shots.body.data || []).length;
      console.log('      ' + ss.attributes.screenshotDisplayType + ': ' + count + ' screenshots');
      if (count === 0) issues.push('No screenshots for ' + ss.attributes.screenshotDisplayType + ' in ' + a.locale);
    }
  }

  // 5. Current build
  console.log('\n=== CURRENTLY ATTACHED BUILD ===');
  const buildRel = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '/build');
  if (buildRel.body.data) {
    const ba = buildRel.body.data.attributes;
    console.log('  Build ID:', buildRel.body.data.id);
    console.log('  Build number:', ba.version);
    console.log('  Processing:', ba.processingState);
    console.log('  Uploaded:', ba.uploadedDate);
    console.log('  Min OS:', ba.minOsVersion);
    if (ba.processingState !== 'VALID') issues.push('Build processing state is ' + ba.processingState + ', not VALID');
    if (buildRel.body.data.id !== NEW_BUILD_ID) {
      console.log('  *** NOT OUR NEW BUILD (22)! Need to select it. ***');
      issues.push('Wrong build attached. Need to select build ' + NEW_BUILD_ID);
    }
  } else {
    console.log('  No build attached!');
    issues.push('No build attached to version');
  }

  // 6. New build 22 details
  console.log('\n=== NEW BUILD 22 DETAILS ===');
  const newBuild = await api('GET', '/v1/builds/' + NEW_BUILD_ID);
  if (newBuild.body.data) {
    const nb = newBuild.body.data.attributes;
    console.log('  Build ID:', newBuild.body.data.id);
    console.log('  Build number:', nb.version);
    console.log('  Processing:', nb.processingState);
    console.log('  Uploaded:', nb.uploadedDate);
    console.log('  Min OS:', nb.minOsVersion);
    console.log('  Expired:', nb.expired);
    console.log('  Uses non-exempt encryption:', nb.usesNonExemptEncryption);
    if (nb.processingState !== 'VALID') issues.push('New build processing state: ' + nb.processingState);
    if (nb.expired) issues.push('New build is expired!');
  }

  // 7. Export compliance
  console.log('\n=== EXPORT COMPLIANCE ===');
  const compliance = await api('GET', '/v1/builds/' + NEW_BUILD_ID + '/buildBetaDetail');
  if (compliance.body.data) {
    console.log('  Auto notify:', compliance.body.data.attributes.autoNotifyEnabled);
    console.log('  External state:', compliance.body.data.attributes.externalBuildState);
    console.log('  Internal state:', compliance.body.data.attributes.internalBuildState);
  }

  // 8. Review submissions history
  console.log('\n=== RECENT REVIEW SUBMISSIONS ===');
  const subs = await api('GET', '/v1/reviewSubmissions?filter[app]=' + APP_ID + '&filter[platform]=IOS&limit=5');
  for (const s of (subs.body.data || [])) {
    console.log('  ID:', s.id, 'state:', s.attributes.state, 'submitted:', s.attributes.submittedDate);
  }

  // 9. App store review details / contact info
  console.log('\n=== REVIEW DETAILS ===');
  const reviewDetail = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '/appStoreReviewDetail');
  if (reviewDetail.body.data) {
    const rd = reviewDetail.body.data.attributes;
    console.log('  Contact first name:', rd.contactFirstName || '(empty)');
    console.log('  Contact last name:', rd.contactLastName || '(empty)');
    console.log('  Contact phone:', rd.contactPhone || '(empty)');
    console.log('  Contact email:', rd.contactEmail || '(empty)');
    console.log('  Demo user:', rd.demoAccountName || '(empty)');
    console.log('  Demo pass:', rd.demoAccountPassword ? '***set***' : '(EMPTY)');
    console.log('  Notes:', rd.notes || '(empty)');
    if (!rd.contactEmail) issues.push('Missing review contact email');
    if (!rd.contactPhone) issues.push('Missing review contact phone');
  } else {
    console.log('  No review details found');
    issues.push('No app store review details (contact info for Apple reviewer)');
  }

  // Summary
  console.log('\n========================================');
  console.log('=== AUDIT SUMMARY ===');
  console.log('========================================');
  if (issues.length === 0) {
    console.log('ALL CHECKS PASSED - Ready to submit!');
  } else {
    console.log(issues.length + ' ISSUE(S) FOUND:');
    issues.forEach((issue, i) => console.log('  ' + (i + 1) + '. ' + issue));
  }
}

main().catch(err => console.error('Error:', err));
