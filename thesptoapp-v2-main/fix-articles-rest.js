// Fix articles using Firebase REST API (no SDK needed)
// Uses the Firebase Auth REST API to sign in as admin, then patches Firestore docs
const https = require('https');

const API_KEY = 'AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0';
const PROJECT_ID = 'spot-app-575e9';

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function signIn(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const body = JSON.stringify({ email, password, returnSecureToken: true });
  const result = await httpsRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, body);
  return result.idToken;
}

async function patchDocument(token, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/articles/${docId}?updateMask.fieldPaths=isPublished&updateMask.fieldPaths=publishedDate`;
  const body = JSON.stringify({
    fields: {
      isPublished: { booleanValue: true },
      publishedDate: { stringValue: '2026-04-01T00:00:00.000Z' }
    }
  });
  await httpsRequest(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, body);
  console.log('Updated', docId);
}

async function main() {
  // Sign in with demo/admin account - need an admin account
  // Let's try the demo account first
  console.log('Signing in...');
  const token = await signIn('demo.reviewer@thespotapp.com', 'AppleReview2026!');
  console.log('Signed in, updating articles...');
  
  for (const id of ['article_001', 'article_002', 'article_003']) {
    await patchDocument(token, id);
  }
  console.log('All done!');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
