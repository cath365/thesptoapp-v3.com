#!/usr/bin/env node
/**
 * verify-login-flow.js
 *
 * Production-readiness verification script for the login system.
 * Tests every scenario Apple reviewers might encounter.
 *
 * Run:  node scripts/verify-login-flow.js
 */
const https = require('https');
const tls = require('tls');
const {
  FIREBASE_API_KEY,
  FIREBASE_PROJECT,
  APPLE_REVIEW_EMAIL,
  CANONICAL_REVIEW_PASSWORD,
} = require('./review-credentials');

const DEMO_EMAIL = APPLE_REVIEW_EMAIL;
const DEMO_PASSWORD = CANONICAL_REVIEW_PASSWORD;

let passed = 0;
let failed = 0;
const results = [];

function record(name, ok, detail) {
  const status = ok ? 'PASS' : 'FAIL';
  results.push({ name, status, detail });
  if (ok) passed++; else failed++;
  console.log(`  [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

function firebaseRest(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'identitytoolkit.googleapis.com',
        path: `/v1/accounts:${endpoint}?key=${FIREBASE_API_KEY}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, body: d }); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

function firestoreRead(uid, idToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${uid}`,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + idToken },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, body: d }); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function checkTls(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: true,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized === true;
        socket.end();
        resolve({
          ok: authorized,
          detail: authorized
            ? `authorized cert: ${cert?.subject?.CN || 'unknown CN'}`
            : socket.authorizationError || 'certificate not authorized',
        });
      }
    );

    socket.setTimeout(10000, () => {
      socket.destroy();
      resolve({ ok: false, detail: 'TLS handshake timed out' });
    });

    socket.on('error', (e) => {
      resolve({ ok: false, detail: e.message });
    });
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  LOGIN FLOW — PRODUCTION READINESS VERIFICATION ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ── 1. Valid credentials ─────────────────────────────────────
  console.log('── 1. Valid Credentials ──────────────────────────');
  let idToken, uid;
  try {
    const res = await firebaseRest('signInWithPassword', {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      returnSecureToken: true,
    });
    const ok = !!res.body.idToken;
    record('Sign in with valid credentials', ok, ok ? 'uid=' + res.body.localId : res.body.error?.message);
    if (ok) { idToken = res.body.idToken; uid = res.body.localId; }
  } catch (e) {
    record('Sign in with valid credentials', false, e.message);
  }

  // ── 2. Token received ─────────────────────────────────────
  console.log('\n── 2. Token / Session ───────────────────────────');
  record('Auth token received', !!idToken, idToken ? 'token length: ' + idToken.length : 'no token');
  record('User UID received', !!uid, uid || 'no uid');

  // ── 3. Firestore user document ─────────────────────────────
  console.log('\n── 3. Firestore User Document ───────────────────');
  if (idToken && uid) {
    try {
      const fsRes = await firestoreRead(uid, idToken);
      const fields = fsRes.body.fields || {};
      record('Firestore document exists', fsRes.status === 200, 'status ' + fsRes.status);
      record('active field is true', fields.active?.booleanValue === true,
        'active=' + JSON.stringify(fields.active));
      record('role field is user', fields.role?.stringValue === 'user',
        'role=' + JSON.stringify(fields.role));
      record('email matches', fields.email?.stringValue === DEMO_EMAIL,
        'email=' + (fields.email?.stringValue || '(missing)'));
    } catch (e) {
      record('Firestore document read', false, e.message);
    }
  } else {
    record('Firestore document read', false, 'skipped — no token');
  }

  // ── 4. Invalid credentials ─────────────────────────────────
  console.log('\n── 4. Invalid Credentials ───────────────────────');
  try {
    const res = await firebaseRest('signInWithPassword', {
      email: DEMO_EMAIL,
      password: 'WrongPassword123',
      returnSecureToken: true,
    });
    const err = res.body.error?.message || '';
    record('Wrong password returns error (not crash)',
      !res.body.idToken && err.includes('INVALID_LOGIN_CREDENTIALS'),
      err);
  } catch (e) {
    record('Wrong password returns error', false, 'Exception: ' + e.message);
  }

  // ── 5. Invalid email format ────────────────────────────────
  console.log('\n── 5. Invalid Email Format ──────────────────────');
  try {
    const res = await firebaseRest('signInWithPassword', {
      email: 'not-an-email',
      password: 'anything',
      returnSecureToken: true,
    });
    const err = res.body.error?.message || '';
    record('Invalid email returns error', !res.body.idToken && err.length > 0, err);
  } catch (e) {
    record('Invalid email returns error', false, 'Exception: ' + e.message);
  }

  // ── 6. Empty email/password ────────────────────────────────
  console.log('\n── 6. Empty Fields ──────────────────────────────');
  try {
    const res = await firebaseRest('signInWithPassword', {
      email: '',
      password: '',
      returnSecureToken: true,
    });
    const err = res.body.error?.message || '';
    record('Empty credentials returns error', !res.body.idToken && err.length > 0, err);
  } catch (e) {
    record('Empty credentials returns error', false, 'Exception: ' + e.message);
  }

  // ── 7. Non-existent user ───────────────────────────────────
  console.log('\n── 7. Non-existent User ─────────────────────────');
  try {
    const res = await firebaseRest('signInWithPassword', {
      email: 'does.not.exist.9999@thespotapp.com',
      password: 'SomePassword1!',
      returnSecureToken: true,
    });
    const err = res.body.error?.message || '';
    record('Non-existent user returns error', !res.body.idToken && err.length > 0, err);
  } catch (e) {
    record('Non-existent user returns error', false, 'Exception: ' + e.message);
  }

  // ── 8. Password reset endpoint ────────────────────────────
  console.log('\n── 8. Password Reset Endpoint ───────────────────');
  try {
    const res = await firebaseRest('sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email: DEMO_EMAIL,
    });
    record('Password reset email sends', res.status === 200, 'status ' + res.status);
  } catch (e) {
    record('Password reset email sends', false, e.message);
  }

  // ── 9. API reachability ────────────────────────────────────
  console.log('\n── 9. API Reachability ──────────────────────────');
  try {
    const start = Date.now();
    const res = await firebaseRest('signInWithPassword', {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      returnSecureToken: true,
    });
    const ms = Date.now() - start;
    record('Firebase Auth reachable', res.status === 200, ms + 'ms response time');
    record('Response time < 10s', ms < 10000, ms + 'ms');
    record('Response time < 5s', ms < 5000, ms + 'ms');
  } catch (e) {
    record('Firebase Auth reachable', false, e.message);
  }

  // ── 9b. TLS / SSL verification ────────────────────────────
  console.log('\n── 9b. TLS / SSL Verification ───────────────────');
  const authTls = await checkTls('identitytoolkit.googleapis.com');
  record('Firebase Auth TLS certificate valid', authTls.ok, authTls.detail);
  const fsTls = await checkTls('firestore.googleapis.com');
  record('Firestore TLS certificate valid', fsTls.ok, fsTls.detail);

  // ── 10. Code-level static checks ──────────────────────────
  console.log('\n── 10. Static Code Checks ──────────────────────');
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..');

  // Check firebase.ts
  const firebaseSrc = fs.readFileSync(path.join(root, 'lib', 'firebase.ts'), 'utf8');
  record('No localhost in firebase.ts', !firebaseSrc.includes('localhost'), '');
  record('inMemoryPersistence fallback exists',
    firebaseSrc.includes('inMemoryPersistence'), '');
  record('getReactNativePersistence guarded',
    firebaseSrc.includes("typeof getReactNativePersistence !== 'function'"), '');
  record('auth/already-initialized handled',
    (firebaseSrc.match(/auth\/already-initialized/g) || []).length >= 3, 'multiple catch sites');

  // Check auth.ts
  const authSrc = fs.readFileSync(path.join(root, 'lib', 'auth.ts'), 'utf8');
  record('No localhost in auth.ts', !authSrc.includes('localhost'), '');
  record('signIn has auth null-check', authSrc.includes("if (!auth)"), '');
  record('signIn waits for auth readiness', authSrc.includes('waitForAuthReady('), '');
  record('signIn normalizes email', authSrc.includes('normalizeEmailInput('), '');
  record('signIn normalizes password', authSrc.includes('normalizePasswordInput('), '');
  record('signIn has 15s timeout', authSrc.includes('15000'), '');
  record('signUp has timeout', authSrc.includes("'Sign up'"), '');
  record('Default error is user-friendly (no raw leak)',
    authSrc.includes("'Something went wrong. Please check your connection and try again.'"), '');
  record('Production error logging',
    authSrc.includes("console.error('[Auth] signIn failed:'"), '');
  record('Persistent auth diagnostics logging enabled',
    authSrc.includes("appendAuthDiagnostic('auth:signIn:start'"), '');

  // Check sign-in.tsx
  const signInSrc = fs.readFileSync(path.join(root, 'app', '(auth)', 'sign-in.tsx'), 'utf8');
  record('handleSignIn wrapped in try/catch', signInSrc.includes('catch (error'), '');
  record('handleSendReset wrapped in try/catch',
    (signInSrc.match(/catch \(error/g) || []).length >= 2, '');
  record('handleContinueAsGuest wrapped in try/catch',
    signInSrc.includes("[SignIn] Guest mode error"), '');
  record('Production logging in sign-in',
    signInSrc.includes("[SignIn] Login attempt"), '');
  record('Sign-in screen waits for auth readiness',
    signInSrc.includes('waitForAuthReady(12000)'), '');
  record('No __DEV__-only logging in sign-in flow',
    !signInSrc.includes('if (__DEV__) console.log(\'Login'), '');

  // Check sign-up.tsx
  const signUpSrc = fs.readFileSync(path.join(root, 'app', '(auth)', 'sign-up.tsx'), 'utf8');
  record('handleSignUp wrapped in try/catch/finally',
    signUpSrc.includes('} catch (error') && signUpSrc.includes('} finally {'), '');
  record('Sign-up has production logging',
    signUpSrc.includes("[SignUp] Attempt for"), '');

  // Check useAuth.ts
  const useAuthSrc = fs.readFileSync(path.join(root, 'hooks', 'useAuth.ts'), 'utf8');
  record('useAuth has safety timeout',
    useAuthSrc.includes('10000') && useAuthSrc.includes('safetyTimer'), '');
  record('onAuthStateChanged wrapped in try/catch',
    useAuthSrc.includes('Failed to subscribe to auth state'), '');

  // Check ErrorBoundary exists
  const errorBoundaryExists = fs.existsSync(path.join(root, 'components', 'ErrorBoundary.tsx'));
  record('ErrorBoundary component exists', errorBoundaryExists, '');

  // Check root layout wraps in ErrorBoundary
  const layoutSrc = fs.readFileSync(path.join(root, 'app', '_layout.tsx'), 'utf8');
  record('Root layout uses ErrorBoundary', layoutSrc.includes('<ErrorBoundary>'), '');

  // ── Summary ────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  SUMMARY                                         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  PASSED: ${String(passed).padEnd(4)} FAILED: ${String(failed).padEnd(4)}             ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  if (failed === 0) {
    console.log('║  ✅ ALL CHECKS PASSED — READY FOR SUBMISSION     ║');
  } else {
    console.log('║  ❌ SOME CHECKS FAILED — FIX BEFORE SUBMITTING   ║');
    console.log('║                                                  ║');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log('║  • ' + r.name.substring(0, 44).padEnd(44) + ' ║');
    });
  }
  console.log('╚══════════════════════════════════════════════════╝');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Verification script crashed:', e);
  process.exit(2);
});
