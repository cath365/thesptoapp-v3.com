const https = require('https');

const sessionId = '850444b2-53c3-4e32-b5da-b050bc94256d';
const cookie = `expo.sid=${encodeURIComponent(JSON.stringify({ id: sessionId, version: 2 }))}`;

const query = JSON.stringify({
  query: `mutation CreateAccessToken($data: CreateAccessTokenInput!) {
    createAccessToken(createAccessTokenData: $data) {
      id
      token
    }
  }`,
  variables: {
    data: {
      note: "github-actions"
    }
  }
});

const opts = {
  hostname: 'api.expo.dev',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(query),
    'Cookie': cookie
  }
};

const req = https.request(opts, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(body);
      if (j.data && j.data.createAccessToken) {
        console.log('TOKEN=' + j.data.createAccessToken.token);
      } else {
        console.log('STATUS: ' + res.statusCode);
        console.log('RESPONSE: ' + body.substring(0, 500));
      }
    } catch (e) {
      console.log('STATUS: ' + res.statusCode);
      console.log('RAW: ' + body.substring(0, 500));
    }
  });
});
req.on('error', e => console.log('ERR: ' + e));
req.write(query);
req.end();
