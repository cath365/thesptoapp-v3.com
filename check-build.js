const https = require('https');
const androidBuildId = '37927964-8bd1-48c2-9371-04df238cab4a'; // last successful Android
const iosBuildId = 'b2f9309c-02a3-4201-9d69-c95203a96ffb'; // last successful iOS
const query = JSON.stringify({
  query: `query { 
    android: builds { byId(buildId: "${androidBuildId}") { id status platform sdkVersion runtimeVersion appVersion appBuildVersion } }
    ios: builds { byId(buildId: "${iosBuildId}") { id status platform sdkVersion runtimeVersion appVersion appBuildVersion } }
  }`
});
const sessionSecret = JSON.parse(require('fs').readFileSync(require('path').join(require('os').homedir(), '.expo', 'state.json'), 'utf8')).auth.sessionSecret;
const opts = {
  hostname: 'api.expo.dev',
  path: '/graphql',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(query), 'expo-session': sessionSecret }
};
const req = https.request(opts, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log(d.substring(0, 3000)));
});
req.on('error', e => console.log('ERR:', e.message));
req.write(query);
req.end();
