/**
 * Write safe deployment config docs to Firestore via REST API.
 * Requires temporary open write rules on app_config collection.
 * Run: node write-safe-config.js
 */
const https = require('https');

const PROJECT = 'spot-app-575e9';
const BASE = `/v1/projects/${PROJECT}/databases/(default)/documents/app_config`;

const docs = {
  version: {
    fields: {
      current_version: { stringValue: '1.0.0' },
      min_version: { stringValue: '1.0.0' },
      update_url: { stringValue: '' },
      force_update: { booleanValue: false }
    }
  },
  rollout: {
    fields: {
      enabled: { booleanValue: false },
      percentage: { integerValue: '0' },
      target_version: { stringValue: '1.0.0' },
      updated_at: { stringValue: new Date().toISOString() }
    }
  },
  features: {
    fields: {
      maintenance_mode: { booleanValue: false },
      feature_flags: { mapValue: { fields: {
        articles: { booleanValue: true },
        health_tips: { booleanValue: true },
        bookmarks: { booleanValue: true },
        push_notifications: { booleanValue: true }
      }}}
    }
  }
};

function writeDoc(docId, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'firestore.googleapis.com',
      path: `${BASE}/${docId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(opts, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`  ✅ ${docId} — written successfully`);
          resolve(true);
        } else {
          console.log(`  ❌ ${docId} — HTTP ${res.statusCode}: ${b.substring(0, 200)}`);
          resolve(false);
        }
      });
    });
    req.on('error', e => { console.log(`  ❌ ${docId} — ${e.message}`); resolve(false); });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Writing Safe Config Docs to Firestore ===');
  console.log(`Project: ${PROJECT}\n`);

  let allOk = true;
  for (const [docId, body] of Object.entries(docs)) {
    const ok = await writeDoc(docId, body);
    if (!ok) allOk = false;
  }

  console.log('\n' + (allOk ? '✅ ALL CONFIG DOCS WRITTEN SUCCESSFULLY' : '❌ SOME WRITES FAILED — check rules'));

  // Verify by reading back
  if (allOk) {
    console.log('\n=== Verification Read ===');
    for (const docId of Object.keys(docs)) {
      await new Promise((resolve) => {
        https.get(`https://firestore.googleapis.com${BASE}/${docId}`, (res) => {
          let b = '';
          res.on('data', c => b += c);
          res.on('end', () => {
            if (res.statusCode === 200) {
              const parsed = JSON.parse(b);
              const fieldNames = Object.keys(parsed.fields || {}).join(', ');
              console.log(`  ✅ ${docId} — fields: ${fieldNames}`);
            } else {
              console.log(`  ❌ ${docId} — read failed: HTTP ${res.statusCode}`);
            }
            resolve();
          });
        });
      });
    }
    console.log('\n✅ SAFE CONFIG SEEDING COMPLETE');
  }
}

main();
