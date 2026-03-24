const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const fb = path.join(root, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
const outFile = path.join(root, "deploy_result.txt");

let output = "Firebase CLI: " + fb + "\n";
output += "Deploying firestore:rules to spot-app-575e9...\n\n";

try {
  const result = execSync(
    `node "${fb}" deploy --only firestore:rules --project spot-app-575e9`,
    { encoding: "utf8", timeout: 60000, cwd: root }
  );
  output += "SUCCESS:\n" + result;
} catch (e) {
  output += "FAILED:\n";
  if (e.stdout) output += "STDOUT: " + e.stdout + "\n";
  if (e.stderr) output += "STDERR: " + e.stderr + "\n";
  if (!e.stdout && !e.stderr) output += "ERROR: " + e.message + "\n";
}

fs.writeFileSync(outFile, output);
console.log(output);
