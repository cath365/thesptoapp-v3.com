// Test Firestore rules via REST API (bypasses SDK caching)
const https = require("https");

const PROJECT = "spot-app-575e9";

function firestoreGet(collection, docId) {
  return new Promise((resolve, reject) => {
    const path = docId
      ? `/v1/projects/${PROJECT}/databases/(default)/documents/${collection}/${docId}`
      : `/v1/projects/${PROJECT}/databases/(default)/documents/${collection}`;
    
    const options = {
      hostname: "firestore.googleapis.com",
      path: path,
      method: "GET",
      headers: { "Content-Type": "application/json" },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode, body: data.substring(0, 500) });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  console.log("Testing Firestore REST API for project:", PROJECT);
  console.log("(This bypasses SDK caching)\n");

  const tests = [
    { collection: "articles", doc: null, label: "articles (list)" },
    { collection: "health_tips", doc: null, label: "health_tips (list)" },
    { collection: "app_config", doc: "version", label: "app_config/version" },
    { collection: "app_config", doc: "rollout", label: "app_config/rollout" },
    { collection: "users", doc: null, label: "users (should fail)" },
  ];

  for (const t of tests) {
    try {
      const res = await firestoreGet(t.collection, t.doc);
      const ok = res.status === 200 || res.status === 404; // 404 = doc doesn't exist but IS accessible
      const icon = ok ? "✅" : "❌";
      console.log(`${icon} ${t.label}: HTTP ${res.status}`);
      if (res.status !== 200) {
        // Show first bit of error
        try {
          const parsed = JSON.parse(res.body);
          console.log(`   ${parsed.error?.message || res.body.substring(0, 200)}`);
        } catch {
          console.log(`   ${res.body.substring(0, 200)}`);
        }
      }
    } catch (e) {
      console.log(`❌ ${t.label}: ${e.message}`);
    }
  }
}

main();
