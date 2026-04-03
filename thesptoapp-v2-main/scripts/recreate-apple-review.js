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
  console.log('=== RECREATE apple.review@thespotapp.com ===\n');

  // Step 1: Create
  console.log('Step 1: Creating account...');
  const r = await fb('signUp', {
    email: 'apple.review@thespotapp.com',
    password: 'AppleReview2026!',
    returnSecureToken: true,
  });

  if (r.idToken) {
    console.log('  SUCCESS! UID:', r.localId);
  } else {
    console.log('  FAILED:', r.error?.message);
    if (r.error?.message === 'EMAIL_EXISTS') {
      console.log('  Account still exists — delete was NOT completed.');
      console.log('  Go back to Firebase Console and delete apple.review@thespotapp.com');
    }
    process.exit(1);
  }

  // Step 2: Write Firestore doc
  console.log('\nStep 2: Writing Firestore user doc...');
  const fsBody = JSON.stringify({
    fields: {
      email: { stringValue: 'apple.review@thespotapp.com' },
      displayName: { stringValue: 'Apple Reviewer' },
      role: { stringValue: 'user' },
      active: { booleanValue: true },
      createdAt: { timestampValue: new Date().toISOString() },
      lastLogin: { timestampValue: new Date().toISOString() },
      platform: { stringValue: 'ios' },
    },
  });

  const fsRes = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/spot-app-575e9/databases/(default)/documents/users/' + r.localId,
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + r.idToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(fsBody),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(fsBody);
    req.end();
  });

  if (fsRes.status === 200) {
    console.log('  Firestore doc written (active: true, role: user)');
  } else {
    console.log('  Firestore write failed (status ' + fsRes.status + ')');
    console.log('  ', fsRes.body.substring(0, 200));
  }

  // Step 3: Verify sign-in
  console.log('\nStep 3: Verifying sign-in...');
  const v = await fb('signInWithPassword', {
    email: 'apple.review@thespotapp.com',
    password: 'AppleReview2026!',
    returnSecureToken: true,
  });

  if (v.idToken) {
    console.log('  VERIFIED! Sign-in works. UID:', v.localId);
  } else {
    console.log('  VERIFY FAILED:', v.error?.message);
    process.exit(1);
  }

  // Step 4: Also verify backup account
  console.log('\nStep 4: Verify backup account (demo.reviewer)...');
  const b = await fb('signInWithPassword', {
    email: 'demo.reviewer@thespotapp.com',
    password: 'AppleReview2026!',
    returnSecureToken: true,
  });

  if (b.idToken) {
    console.log('  demo.reviewer also works. UID:', b.localId);
  } else {
    console.log('  demo.reviewer FAILED:', b.error?.message);
  }

  console.log('\n=== DONE ===');
  console.log('apple.review@thespotapp.com / AppleReview2026! is ready for Apple review.');
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
