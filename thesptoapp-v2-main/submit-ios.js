// Submit app to App Store Review via App Store Connect API
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');

// Generate JWT for App Store Connect API
function createToken() {
  const privateKey = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 1200, // 20 minutes
    aud: 'appstoreconnect-v1'
  };
  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' }
  });
}

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const token = createToken();
    const options = {
      hostname: 'api.appstoreconnect.apple.com',
      path: urlPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  try {
    // Step 1: Find the build
    console.log('1. Finding build 2.1.0 (20)...');
    const buildsRes = await apiRequest('GET',
      `/v1/builds?filter[app]=${APP_ID}&filter[version]=20&filter[preReleaseVersion.version]=2.1.0&limit=5`
    );
    
    if (buildsRes.status !== 200) {
      console.log('Failed to fetch builds:', JSON.stringify(buildsRes.data, null, 2));
      return;
    }
    
    const builds = buildsRes.data.data || [];
    console.log(`   Found ${builds.length} build(s)`);
    
    if (builds.length === 0) {
      console.log('   No builds found. Trying without version filter...');
      const allBuildsRes = await apiRequest('GET',
        `/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=5`
      );
      const allBuilds = allBuildsRes.data.data || [];
      console.log(`   Found ${allBuilds.length} recent build(s):`);
      allBuilds.forEach(b => {
        console.log(`   - ID: ${b.id}, version: ${b.attributes.version}, uploaded: ${b.attributes.uploadedDate}, processing: ${b.attributes.processingState}`);
      });
      if (allBuilds.length === 0) return;
      // Use the most recent build
      var buildId = allBuilds[0].id;
      console.log(`   Using most recent build: ${buildId}`);
    } else {
      var buildId = builds[0].id;
      console.log(`   Build ID: ${buildId}, processing: ${builds[0].attributes.processingState}`);
    }
    
    // Step 2: Check if there's an existing App Store version for 2.1.0
    console.log('\n2. Checking for existing App Store version 2.1.0...');
    const versionsRes = await apiRequest('GET',
      `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=2.1.0&filter[platform]=IOS`
    );
    
    let versionId;
    const versions = versionsRes.data.data || [];
    
    if (versions.length > 0) {
      versionId = versions[0].id;
      const state = versions[0].attributes.appStoreState;
      console.log(`   Found existing version: ${versionId}, state: ${state}`);
    } else {
      // Create new App Store version
      console.log('   No version found. Creating App Store version 2.1.0...');
      const createVersionRes = await apiRequest('POST', '/v1/appStoreVersions', {
        data: {
          type: 'appStoreVersions',
          attributes: {
            platform: 'IOS',
            versionString: '2.1.0',
            releaseType: 'MANUAL'
          },
          relationships: {
            app: { data: { type: 'apps', id: APP_ID } }
          }
        }
      });
      
      if (createVersionRes.status !== 201) {
        console.log('   Failed to create version:', JSON.stringify(createVersionRes.data, null, 2));
        return;
      }
      versionId = createVersionRes.data.data.id;
      console.log(`   Created version: ${versionId}`);
    }
    
    // Step 3: Select the build for this version
    console.log('\n3. Selecting build for version...');
    const selectBuildRes = await apiRequest('PATCH', `/v1/appStoreVersions/${versionId}`, {
      data: {
        type: 'appStoreVersions',
        id: versionId,
        relationships: {
          build: { data: { type: 'builds', id: buildId } }
        }
      }
    });
    
    if (selectBuildRes.status !== 200) {
      console.log('   Failed to select build:', JSON.stringify(selectBuildRes.data, null, 2));
      // Continue anyway - build might already be selected
    } else {
      console.log('   Build selected successfully');
    }
    
    // Step 4: Update "What's New" text
    console.log('\n4. Updating release notes...');
    const localizationsRes = await apiRequest('GET',
      `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`
    );
    
    const whatsNew = "• Security improvements and bug fixes\n• Improved performance and stability\n• Updated backend infrastructure";
    
    if (localizationsRes.data.data && localizationsRes.data.data.length > 0) {
      const locId = localizationsRes.data.data[0].id;
      await apiRequest('PATCH', `/v1/appStoreVersionLocalizations/${locId}`, {
        data: {
          type: 'appStoreVersionLocalizations',
          id: locId,
          attributes: { whatsNew: whatsNew }
        }
      });
      console.log('   Release notes updated');
    }
    
    // Step 5: Submit for review
    console.log('\n5. Submitting for App Store Review...');
    const submitRes = await apiRequest('POST', '/v1/appStoreVersionSubmissions', {
      data: {
        type: 'appStoreVersionSubmissions',
        relationships: {
          appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } }
        }
      }
    });
    
    if (submitRes.status === 201 || submitRes.status === 200) {
      console.log('\n   SUCCESS! App submitted for App Store Review!');
      console.log('   Apple typically reviews within 24-48 hours.');
    } else {
      console.log('   Submit response:', submitRes.status, JSON.stringify(submitRes.data, null, 2));
      
      // Try the newer reviewSubmissions API
      console.log('\n   Trying alternate submission API...');
      const submitRes2 = await apiRequest('POST', '/v1/reviewSubmissions', {
        data: {
          type: 'reviewSubmissions',
          attributes: { platform: 'IOS' },
          relationships: {
            app: { data: { type: 'apps', id: APP_ID } }
          }
        }
      });
      
      if (submitRes2.status === 201 || submitRes2.status === 200) {
        const submissionId = submitRes2.data.data.id;
        console.log(`   Created review submission: ${submissionId}`);
        
        // Add the version to the submission
        await apiRequest('POST', '/v1/reviewSubmissionItems', {
          data: {
            type: 'reviewSubmissionItems',
            relationships: {
              reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
              appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } }
            }
          }
        });
        
        // Confirm the submission
        const confirmRes = await apiRequest('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
          data: {
            type: 'reviewSubmissions',
            id: submissionId,
            attributes: { submitted: true }
          }
        });
        
        if (confirmRes.status === 200) {
          console.log('\n   SUCCESS! App submitted for App Store Review!');
        } else {
          console.log('   Confirm result:', confirmRes.status, JSON.stringify(confirmRes.data, null, 2));
        }
      } else {
        console.log('   Alternate submit result:', submitRes2.status, JSON.stringify(submitRes2.data, null, 2));
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
