#!/usr/bin/env node
/**
 * Simulates strict App Review login conditions.
 * Focuses on first-attempt success under cold-start and network stress assumptions.
 */
const https = require('https');
const {
  FIREBASE_API_KEY,
  APPLE_REVIEW_EMAIL,
  CANONICAL_REVIEW_PASSWORD,
} = require('./review-credentials');

function postAuth(endpoint, body, timeoutMs = 12000) {
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
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });
    req.write(data);
    req.end();
  });
}

async function oneShotLogin(label, timeoutMs) {
  const started = Date.now();
  try {
    const res = await postAuth('signInWithPassword', {
      email: APPLE_REVIEW_EMAIL,
      password: CANONICAL_REVIEW_PASSWORD,
      returnSecureToken: true,
    }, timeoutMs);

    const ok = !!res.body.idToken;
    return {
      label,
      ok,
      elapsedMs: Date.now() - started,
      detail: ok ? `uid=${res.body.localId}` : (res.body.error?.message || `HTTP ${res.status}`),
    };
  } catch (e) {
    return {
      label,
      ok: false,
      elapsedMs: Date.now() - started,
      detail: e.message,
    };
  }
}

async function main() {
  console.log('=== Simulate Apple Review Conditions ===\n');

  const checks = [];

  // First-attempt login with normal timeout (cold-start mindset).
  checks.push(await oneShotLogin('First-attempt login (12s timeout)', 12000));

  // Network stress: stricter timeout to expose borderline latency risks.
  checks.push(await oneShotLogin('First-attempt login (3s timeout stress)', 3000));

  // High-latency tolerance test.
  checks.push(await oneShotLogin('First-attempt login (30s max tolerance)', 30000));

  let failed = 0;
  for (const c of checks) {
    const state = c.ok ? 'PASS' : 'FAIL';
    if (!c.ok) failed += 1;
    console.log(`[${state}] ${c.label} — ${c.detail} (${c.elapsedMs}ms)`);
  }

  console.log('\nResult:', failed === 0 ? 'READY' : 'RISK FOUND');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Simulation crashed:', e);
  process.exit(2);
});
