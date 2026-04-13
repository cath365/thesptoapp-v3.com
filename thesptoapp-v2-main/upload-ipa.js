// Upload IPA to App Store Connect using the Transporter API
// This creates a proper upload package and uses the iTunes Transporter protocol
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const jwt = require('jsonwebtoken');

// ASC API credentials
const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');
const IPA_PATH = path.join(__dirname, '..', 'build77', 'thespotapp.ipa');
const APP_ID = '6755155637';

function generateJWT() {
  const key = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
    key,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' } }
  );
}

function apiRequest(method, urlPath, body = null) {
  const token = generateJWT();
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.appstoreconnect.apple.com${urlPath}`);
    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function uploadPart(url, data, contentType, offset, length) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      method: 'PUT',
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type': contentType,
        'Content-Length': length,
      },
    };
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.headers);
        } else {
          reject(new Error(`Upload HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Reading IPA file...');
  const ipaBuffer = fs.readFileSync(IPA_PATH);
  const ipaSize = ipaBuffer.length;
  const md5 = crypto.createHash('md5').update(ipaBuffer).digest('base64');
  console.log(`IPA size: ${ipaSize} bytes, MD5: ${md5}`);

  // Step 1: Create build delivery reservation
  console.log('\n1. Creating build delivery reservation...');
  const reservation = await apiRequest('POST', '/v1/buildDeliveries', {
    data: {
      type: 'buildDeliveries',
      attributes: {
        cfBundleShortVersionString: '2.1.0',
        cfBundleVersion: '77',
      },
      relationships: {
        app: {
          data: { type: 'apps', id: APP_ID },
        },
      },
    },
  });
  console.log('Reservation created:', reservation.data?.id);

  // Step 2: Create large upload
  console.log('\n2. Creating upload...');
  const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB chunks
  const numParts = Math.ceil(ipaSize / CHUNK_SIZE);
  
  const uploadBody = {
    data: {
      type: 'largeUploads',
      attributes: {
        fileName: 'thespotapp.ipa',
        fileSize: ipaSize,
        md5: md5,
        numberOfParts: numParts,
      },
    },
  };
  
  const upload = await apiRequest('POST', '/v1/largeUploads', uploadBody);
  const uploadId = upload.data?.id;
  const uploadOps = upload.data?.attributes?.uploadOperations || [];
  console.log(`Upload created: ${uploadId}, ${uploadOps.length} part(s)`);

  // Step 3: Upload parts
  console.log('\n3. Uploading IPA...');
  for (let i = 0; i < uploadOps.length; i++) {
    const op = uploadOps[i];
    const start = op.offset || (i * CHUNK_SIZE);
    const length = op.length || Math.min(CHUNK_SIZE, ipaSize - start);
    const chunk = ipaBuffer.slice(start, start + length);
    console.log(`  Part ${i + 1}/${uploadOps.length}: offset=${start}, length=${length}`);
    await uploadPart(op.url, chunk, op.requestHeaders?.find(h => h.name === 'Content-Type')?.value || 'application/octet-stream', start, length);
  }

  // Step 4: Commit upload
  console.log('\n4. Committing upload...');
  await apiRequest('PATCH', `/v1/largeUploads/${uploadId}`, {
    data: {
      type: 'largeUploads',
      id: uploadId,
      attributes: {
        committed: true,
      },
    },
  });

  // Step 5: Complete delivery
  console.log('\n5. Completing delivery...');
  await apiRequest('PATCH', `/v1/buildDeliveries/${reservation.data.id}`, {
    data: {
      type: 'buildDeliveries',
      id: reservation.data.id,
      attributes: {},
      relationships: {
        largeUpload: {
          data: { type: 'largeUploads', id: uploadId },
        },
      },
    },
  });

  console.log('\nUpload complete! Build 77 is being processed by App Store Connect.');
  console.log('Check status at: https://appstoreconnect.apple.com');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
