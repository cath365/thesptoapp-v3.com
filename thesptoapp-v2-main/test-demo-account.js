/**
 * Test if the Apple review demo account is working
 */
const https = require('https');

const FIREBASE_API_KEY = 'AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0';
const DEMO_EMAIL = 'demo.reviewer@thespotapp.com';
const DEMO_PASSWORD = 'AppleReview2026!';

function firebaseSignIn(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email,
      password,
      returnSecureToken: true
    });
    
    const opts = {
      hostname: 'identitytoolkit.googleapis.com',
      path: '/v1/accounts:signInWithPassword?key=' + FIREBASE_API_KEY,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Content-Length': Buffer.byteLength(data) 
      },
    };
    
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { 
          resolve({ status: res.statusCode, body: JSON.parse(d) }); 
        } catch { 
          resolve({ status: res.statusCode, body: d }); 
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== TESTING DEMO ACCOUNT ===\n');
  console.log('Email:', DEMO_EMAIL);
  console.log('Password:', DEMO_PASSWORD);
  console.log('');
  
  console.log('Attempting sign-in...');
  const result = await firebaseSignIn(DEMO_EMAIL, DEMO_PASSWORD);
  
  if (result.status === 200 && result.body.localId) {
    console.log('\n✅ SUCCESS! Account works!');
    console.log('User ID:', result.body.localId);
    console.log('Email verified:', result.body.emailVerified || false);
  } else {
    console.log('\n❌ FAILED!');
    console.log('Status:', result.status);
    console.log('Error:', JSON.stringify(result.body, null, 2));
    
    if (result.body?.error?.message === 'EMAIL_NOT_FOUND') {
      console.log('\n⚠️  The demo account does not exist! It needs to be created.');
    } else if (result.body?.error?.message === 'INVALID_PASSWORD') {
      console.log('\n⚠️  The password is wrong! It may have been changed.');
    }
  }
}

main().catch(console.error);
