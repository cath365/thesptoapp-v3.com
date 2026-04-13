const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');

function createToken() {
  const pk = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const sig = crypto.sign('SHA256', Buffer.from(header + '.' + payload), { key: pk, dsaEncoding: 'ieee-p1363' });
  return header + '.' + payload + '.' + sig.toString('base64url');
}

function api(urlPath) {
  return new Promise((resolve, reject) => {
    const token = createToken();
    const req = https.request({
      hostname: 'api.appstoreconnect.apple.com',
      path: urlPath,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data || '{}')); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('=== APP STORE REVIEW STATUS ===\n');

  // Check version state
  const versions = await api(`/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=3`);
  for (const v of (versions.data || [])) {
    const a = v.attributes;
    console.log(`Version ${a.versionString}: ${a.appStoreState}`);
  }

  // Check review submissions
  console.log('');
  const subs = await api(`/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=5`);
  for (const s of (subs.data || [])) {
    const a = s.attributes;
    console.log(`Submission ${s.id}: ${a.state} (submitted: ${a.submittedDate || 'N/A'})`);
  }
})();
