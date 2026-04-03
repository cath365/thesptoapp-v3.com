// Verify that the demo account for Apple reviewers actually works
const https = require('https');

const FIREBASE_API_KEY = 'AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0';
const DEMO_EMAIL = 'apple.review@thespotapp.com';
// We don't know the password, but we can check if the account exists

function firebaseApi(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'identitytoolkit.googleapis.com',
      path: '/v1/accounts:' + endpoint + '?key=' + FIREBASE_API_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== DEMO ACCOUNT VERIFICATION ===');
  console.log('Email:', DEMO_EMAIL);
  
  // 1. Check if the email is registered (using fetchSignInMethodsForEmail equivalent)
  console.log('\n1. Checking if account exists...');
  const createResult = await firebaseApi('createAuthUri', {
    identifier: DEMO_EMAIL,
    continueUri: 'https://thespotapp.com'
  });
  
  if (createResult.body.registered) {
    console.log('  ACCOUNT EXISTS');
    console.log('  Sign-in methods:', createResult.body.signinMethods || createResult.body.allProviders || 'unknown');
  } else {
    console.log('  WARNING: ACCOUNT DOES NOT EXIST!');
    console.log('  Apple reviewers will NOT be able to sign in!');
    console.log('  Response:', JSON.stringify(createResult.body, null, 2));
  }

  // 2. Try signing in with a test password to see if we get "wrong password" vs "user not found"
  console.log('\n2. Testing sign-in response...');
  const signInResult = await firebaseApi('signInWithPassword', {
    email: DEMO_EMAIL,
    password: 'test_wrong_password_intentional',
    returnSecureToken: true
  });
  
  if (signInResult.body.error) {
    const errorMsg = signInResult.body.error.message;
    console.log('  Error:', errorMsg);
    
    if (errorMsg === 'INVALID_LOGIN_CREDENTIALS' || errorMsg === 'INVALID_PASSWORD') {
      console.log('  GOOD: Account exists, just wrong password (expected)');
    } else if (errorMsg === 'EMAIL_NOT_FOUND') {
      console.log('  CRITICAL: Demo account email does not exist in Firebase!');
    } else if (errorMsg === 'USER_DISABLED') {
      console.log('  CRITICAL: Demo account is DISABLED!');
    } else if (errorMsg.includes('TOO_MANY_ATTEMPTS')) {
      console.log('  Account exists but rate limited (too many attempts)');
    }
  } else {
    console.log('  Unexpectedly signed in?');
  }

  // 3. Also check the support URL
  console.log('\n3. Checking support URL accessibility...');
  const checkUrl = (url) => new Promise((resolve) => {
    https.get(url, (res) => {
      resolve({ status: res.statusCode, headers: res.headers });
    }).on('error', (err) => resolve({ error: err.message }));
  });
  
  const support = await checkUrl('https://thesptoapp-v2.vercel.app/');
  console.log('  Support URL status:', support.status || support.error);
  
  const privacy = await checkUrl('https://thesptoapp-v2.vercel.app/privacy');
  console.log('  Privacy URL status:', privacy.status || privacy.error);
}

main().catch(err => console.error('Error:', err));
