// wait-and-submit-53.js — Poll EAS build status, upload to ASC, submit for review
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const EAS_BUILD_ID = 'f8014170-da2c-4a54-8711-256fab0e85eb';
const APP_ID = '6755155637';
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';

// ASC credentials
const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const pk = fs.readFileSync(path.join(__dirname, 'AuthKey_X79F2H3QXT.p8'), 'utf8');

function makeJWT() {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const sig = crypto.sign('SHA256', Buffer.from(header + '.' + payload), { key: pk, dsaEncoding: 'ieee-p1363' });
  return header + '.' + payload + '.' + sig.toString('base64url');
}

function ascRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const token = makeJWT();
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.appstoreconnect.apple.com',
      path: apiPath,
      method,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    };
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Read Expo session token for API auth
const os = require('os');
const expoState = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const EXPO_SESSION = expoState.auth.sessionSecret;

function easApiRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const opts = {
      hostname: 'api.expo.dev',
      path: '/graphql',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Content-Length': Buffer.byteLength(body),
        'Cookie': 'expo-session=' + encodeURIComponent(EXPO_SESSION),
        'expo-session': EXPO_SESSION
      }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function waitForBuild() {
  console.log(`Waiting for EAS build ${EAS_BUILD_ID} to complete...`);
  const query = `query Build($buildId: ID!) { 
    builds { byId(buildId: $buildId) { id status platform artifacts { buildUrl } error { message } } } 
  }`;
  
  for (let i = 0; i < 60; i++) { // up to 30 minutes
    try {
      const result = await easApiRequest(query, { buildId: EAS_BUILD_ID });
      const build = result?.data?.builds?.byId;
      if (build) {
        console.log(`  [${new Date().toLocaleTimeString()}] Status: ${build.status}`);
        if (build.status === 'FINISHED' || build.status === 'finished') return build;
        if (build.status === 'ERRORED' || build.status === 'errored' || build.status === 'CANCELED' || build.status === 'canceled') {
          throw new Error(`Build ${build.status}: ${build.error?.message || 'unknown'}`);
        }
      } else {
        console.log(`  [${new Date().toLocaleTimeString()}] Polling... (no data yet)`);
      }
    } catch (e) {
      if (e.message?.includes('ERRORED') || e.message?.includes('CANCELED')) throw e;
      console.log(`  [${new Date().toLocaleTimeString()}] Checking... (${e.message?.substring(0, 80)})`);
    }
    await sleep(30000); // check every 30s
  }
  throw new Error('Timed out waiting for build');
}

async function submitToASC(easBuild) {
  // Step 1: Upload build to ASC via eas submit
  console.log('\n=== Uploading build to App Store Connect ===');
  try {
    const submitResult = execSync(
      `npx eas submit --platform ios --id ${EAS_BUILD_ID} --non-interactive 2>&1`,
      { encoding: 'utf8', timeout: 600000, env: { ...process.env, NODE_OPTIONS: '--dns-result-order=ipv4first' } }
    );
    console.log(submitResult.substring(submitResult.length - 500));
  } catch (e) {
    console.log('EAS submit output:', e.stdout?.substring(e.stdout.length - 500) || e.message);
  }

  // Step 2: Wait for build to appear in ASC
  console.log('\n=== Waiting for Build 53 to appear in ASC ===');
  let ascBuildId = null;
  for (let i = 0; i < 20; i++) {
    await sleep(15000);
    const buildsResp = await ascRequest('GET', `/v1/apps/${APP_ID}/builds?filter[version]=53&sort=-uploadedDate&limit=1`);
    if (buildsResp.data?.data?.length > 0) {
      const b = buildsResp.data.data[0];
      console.log(`  Found build: ${b.id}, processing: ${b.attributes.processingState}, valid: ${b.attributes.valid}`);
      if (b.attributes.processingState === 'VALID') {
        ascBuildId = b.id;
        break;
      }
    } else {
      console.log(`  Not yet visible in ASC... (attempt ${i + 1})`);
    }
  }

  if (!ascBuildId) {
    // Try broader search
    const allBuilds = await ascRequest('GET', `/v1/apps/${APP_ID}/builds?sort=-uploadedDate&limit=5`);
    for (const b of (allBuilds.data?.data || [])) {
      console.log(`  Build: ${b.id}, version: ${b.attributes.version}, processing: ${b.attributes.processingState}`);
      if (b.attributes.version === '53' && b.attributes.processingState === 'VALID') {
        ascBuildId = b.id;
        break;
      }
    }
  }

  if (!ascBuildId) throw new Error('Build 53 not found or not VALID in ASC');
  console.log(`\nASC Build ID: ${ascBuildId}`);

  // Step 3: Cancel any existing submissions with issues
  console.log('\n=== Checking existing submissions ===');
  const existingSubs = await ascRequest('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=WAITING_FOR_REVIEW,UNRESOLVED_ISSUES&include=items`);
  for (const sub of (existingSubs.data?.data || [])) {
    console.log(`  Existing submission ${sub.id}: ${sub.attributes.state}`);
    if (sub.attributes.state === 'UNRESOLVED_ISSUES' || sub.attributes.state === 'WAITING_FOR_REVIEW') {
      console.log(`  Canceling ${sub.id}...`);
      const cancelResp = await ascRequest('PATCH', `/v1/reviewSubmissions/${sub.id}`, {
        data: { type: 'reviewSubmissions', id: sub.id, attributes: { canceled: true } }
      });
      console.log(`  Cancel result: ${cancelResp.status}`);
    }
  }

  // Wait for cancellations to propagate
  await sleep(5000);

  // Step 4: Attach Build 53 to version
  console.log('\n=== Attaching Build 53 to version ===');
  const attachResp = await ascRequest('PATCH', `/v1/appStoreVersions/${VERSION_ID}`, {
    data: {
      type: 'appStoreVersions',
      id: VERSION_ID,
      relationships: { build: { data: { type: 'builds', id: ascBuildId } } }
    }
  });
  console.log(`Attach result: ${attachResp.status}`);
  if (attachResp.status !== 200) {
    console.log('Attach error:', JSON.stringify(attachResp.data?.errors || attachResp.data, null, 2));
  }

  // Step 5: Create new submission
  console.log('\n=== Creating new review submission ===');
  const newSub = await ascRequest('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } }
    }
  });
  console.log(`New submission: ${newSub.status}, ID: ${newSub.data?.data?.id}, state: ${newSub.data?.data?.attributes?.state}`);
  const subId = newSub.data?.data?.id;
  if (!subId) throw new Error('Failed to create submission: ' + JSON.stringify(newSub.data?.errors));

  // Step 6: Add version to submission
  console.log('\n=== Adding version to submission ===');
  const addItem = await ascRequest('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
      }
    }
  });
  console.log(`Add item: ${addItem.status}`);

  // Step 7: Submit for review
  console.log('\n=== Submitting for review ===');
  const submitResp = await ascRequest('PATCH', `/v1/reviewSubmissions/${subId}`, {
    data: { type: 'reviewSubmissions', id: subId, attributes: { submitted: true } }
  });
  console.log(`Submit: ${submitResp.status}, state: ${submitResp.data?.data?.attributes?.state}`);

  // Step 8: Verify
  const verResp = await ascRequest('GET', `/v1/appStoreVersions/${VERSION_ID}?include=build`);
  const ver = verResp.data?.data?.attributes;
  const buildNum = verResp.data?.included?.[0]?.attributes?.version;
  console.log(`\n*** FINAL: Version ${ver?.versionString}, State: ${ver?.appStoreState}, Build: ${buildNum} ***`);
  
  if (submitResp.data?.data?.attributes?.state === 'WAITING_FOR_REVIEW') {
    console.log('\n🎉 BUILD 53 SUBMITTED FOR APPLE REVIEW!');
  }
}

async function main() {
  const build = await waitForBuild();
  console.log(`\nBuild finished! Platform: ${build.platform}, Status: ${build.status}`);
  await submitToASC(build);
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
