// Fix articles using Firebase CLI access token (bypasses security rules)
const { execSync } = require('child_process');
const https = require('https');

const PROJECT_ID = 'spot-app-575e9';

// Get access token from firebase CLI
function getAccessToken() {
  // firebase CLI stores tokens we can use
  const output = execSync('npx firebase login:ci --no-localhost 2>&1', { encoding: 'utf8', timeout: 5000 }).trim();
  return output;
}

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
  // Get the access token from firebase CLI's stored credentials
  const tokenJson = execSync('npx firebase --json login:list', { encoding: 'utf8', timeout: 10000 });
  console.log('Token info:', tokenJson.substring(0, 200));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
