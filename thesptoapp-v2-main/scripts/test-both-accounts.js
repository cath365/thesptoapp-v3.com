const https = require('https');
const {
  FIREBASE_API_KEY,
  APPLE_REVIEW_EMAIL,
  BACKUP_REVIEW_EMAIL,
  CANONICAL_REVIEW_PASSWORD,
} = require('./review-credentials');

function fb(ep, body) {
  return new Promise((res, rej) => {
    const d = JSON.stringify(body);
    const req = https.request({
      hostname: 'identitytoolkit.googleapis.com',
      path: '/v1/accounts:' + ep + '?key=' + FIREBASE_API_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) }
    }, (r) => {
      let dd = '';
      r.on('data', c => dd += c);
      r.on('end', () => { try { res(JSON.parse(dd)); } catch { res(dd); } });
    });
    req.on('error', rej);
    req.write(d);
    req.end();
  });
}

async function main() {
  const accounts = [
    { email: APPLE_REVIEW_EMAIL, password: CANONICAL_REVIEW_PASSWORD },
    { email: BACKUP_REVIEW_EMAIL, password: CANONICAL_REVIEW_PASSWORD },
  ];

  for (const a of accounts) {
    process.stdout.write(a.email + ' ... ');
    const r = await fb('signInWithPassword', {
      email: a.email,
      password: a.password,
      returnSecureToken: true,
    });
    if (r.idToken) {
      console.log('OK (uid: ' + r.localId + ')');
    } else {
      console.log('FAILED: ' + (r.error?.message || 'unknown'));
    }
  }
}

main().catch(e => console.error('Error:', e));
