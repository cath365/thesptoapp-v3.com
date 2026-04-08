// queue-build53.js — Set remote build number to 53 and queue a new iOS build
const { execSync } = require('child_process');

try {
  // First, check what the current remote build number is
  console.log('=== Checking current remote version ===');
  const getResult = execSync(
    'npx eas build:version:get -p ios -e production 2>&1',
    { encoding: 'utf8', timeout: 30000 }
  );
  console.log(getResult);
  
  // Set the build number to 53
  console.log('=== Setting remote build number to 53 ===');
  const setResult = execSync(
    'npx eas build:version:set -p ios -e production 2>&1',
    { 
      encoding: 'utf8', 
      timeout: 30000,
      input: '53\n'  // pipe the answer
    }
  );
  console.log(setResult);
  
  // Verify it was set
  console.log('=== Verifying ===');
  const verifyResult = execSync(
    'npx eas build:version:get -p ios -e production 2>&1',
    { encoding: 'utf8', timeout: 30000 }
  );
  console.log(verifyResult);

  // Queue a new build
  console.log('=== Queuing iOS production build ===');
  const buildResult = execSync(
    'npx eas build --platform ios --profile production --non-interactive --no-wait 2>&1',
    { 
      encoding: 'utf8', 
      timeout: 300000,
      env: { ...process.env, EAS_BUILD_NO_EXPO_GO_WARNING: 'true', NODE_OPTIONS: '--dns-result-order=ipv4first' }
    }
  );
  console.log(buildResult);
  console.log('=== BUILD QUEUED ===');
} catch (err) {
  console.error('Error:', err.message);
  if (err.stdout) console.log('stdout:', err.stdout);
  if (err.stderr) console.log('stderr:', err.stderr);
}
