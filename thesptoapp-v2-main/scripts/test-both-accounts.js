const https = require('https');

function fb(ep, body) {
  return new Promise((res, rej) => {
    const d = JSON.stringify(body);
    const req = https.request({
      hostname: 'identitytoolkit.googleapis.com',
      path: '/v1/accounts:' + ep + '?key=AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0',
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
    { email: 'apple.review@thespotapp.com', password: 'AppleReview2026!' },
    { email: 'demo.reviewer@thespotapp.com', password: 'AppleReview2026!' },
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
