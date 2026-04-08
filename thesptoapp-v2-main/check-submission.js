// check-submission.js — Check EAS submission status
const https = require('https');
const fs = require('fs');
const os = require('os');

const st = JSON.parse(fs.readFileSync(os.homedir() + '/.expo/state.json', 'utf8'));

const q = JSON.stringify({
  query: `query($id: ID!) {
    submissions {
      byId(submissionId: $id) {
        id
        status
        platform
        error { message errorCode }
        logsUrl
      }
    }
  }`,
  variables: { id: '9c7f4483-656f-418c-ae35-d1a74a75cc69' }
});

const opts = {
  hostname: 'api.expo.dev',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(q),
    'expo-session': st.auth.sessionSecret
  }
};

const r = https.request(opts, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const data = JSON.parse(d);
      console.log(JSON.stringify(data, null, 2));
    } catch { console.log(d); }
  });
});
r.on('error', e => console.error(e));
r.write(q);
r.end();
