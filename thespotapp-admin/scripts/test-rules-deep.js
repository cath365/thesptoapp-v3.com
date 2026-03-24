// Deeper diagnostic: test LIST vs GET and check error details
const https = require("https");

const PROJECT = "spot-app-575e9";
const API_KEY = "AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0";

function firestoreRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `/v1/projects/${PROJECT}/databases/(default)/documents/${path}?key=${API_KEY}`;
    
    const options = {
      hostname: "firestore.googleapis.com",
      path: url,
      method: "GET",
      headers: { "Content-Type": "application/json" },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  console.log("Deep Firestore diagnostic for:", PROJECT, "\n");

  // Test various access patterns
  const tests = [
    // These should all work with `allow read: if true`
    "articles",                       // LIST articles
    "articles/test_nonexistent",      // GET single article
    "health_tips",                    // LIST health_tips
    "health_tips/test_nonexistent",   // GET single health tip
    "app_config",                     // LIST app_config
    "app_config/version",             // GET specific doc
    "announcements",                  // LIST announcements (also public read)
    "announcements/test_nonexistent", // GET announcement
  ];

  for (const path of tests) {
    const res = await firestoreRequest(path);
    const icon = res.status === 200 ? "✅" : res.status === 404 ? "🔸" : "❌";
    let detail = "";
    try {
      const parsed = JSON.parse(res.body);
      if (res.status === 200) {
        if (parsed.documents) detail = `${parsed.documents.length} docs`;
        else if (parsed.fields) detail = `exists, ${Object.keys(parsed.fields).length} fields`;
        else detail = "empty collection";
      } else {
        detail = parsed.error?.status || parsed.error?.message || "";
      }
    } catch {
      detail = res.body.substring(0, 100);
    }
    console.log(`${icon} [${res.status}] ${path} — ${detail}`);
  }
}

main();
