const https = require('https');
const buildId = 'b0a57b4e-0434-4abe-838a-2fe6a14422c6';

const query = JSON.stringify({
  query: `query {
    builds {
      byId(buildId: "${buildId}") {
        id
        status
        platform
        runtimeVersion
        sdkVersion
        appVersion
        appBuildVersion
        error {
          message
          errorCode
        }
        artifacts {
          buildUrl
        }
        logFiles
        initiatingActor {
          __typename
          id
        }
      }
    }
  }`
});

const req = https.request({
  hostname: 'api.expo.dev',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const data = JSON.parse(d);
      const build = data.data?.builds?.byId;
      if (build) {
        console.log('Build ID:', build.id);
        console.log('Status:', build.status);
        console.log('Platform:', build.platform);
        console.log('SDK Version:', build.sdkVersion);
        console.log('App Version:', build.appVersion);
        console.log('Build Version:', build.appBuildVersion);
        console.log('Runtime Version:', build.runtimeVersion);
        if (build.error) {
          console.log('Error:', build.error.message);
          console.log('Error Code:', build.error.errorCode);
        }
        if (build.artifacts) {
          console.log('Build URL:', build.artifacts.buildUrl);
          console.log('Logs Key:', build.artifacts.logsS3KeyPrefix);
        }
      } else {
        console.log('Full response:', JSON.stringify(data, null, 2));
      }
    } catch(e) {
      console.log('Raw:', d);
    }
  });
});
req.write(query);
req.end();
