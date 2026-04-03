/**
 * fix-all-issues.js
 * Fixes all remaining Apple App Store issues before resubmission:
 * 1. Age rating: set sexualContentOrNudity to INFREQUENT_OR_MILD (SRHR app)
 * 2. Categories: set primary=HEALTH_AND_FITNESS, secondary=EDUCATION
 * 3. Screenshots: copy iPhone 6.5" screenshots to iPhone 6.7" slot
 *
 * Run: node fix-all-issues.js
 */
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');

function createToken() {
  const pk = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
    pk,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' } }
  );
}

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const token = createToken();
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.appstoreconnect.apple.com',
      path: urlPath,
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function uploadToApple(uploadUrl, buffer) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(uploadUrl);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': buffer.length,
      },
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const results = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Fix Age Rating
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════ STEP 1: FIX AGE RATING ══════');
  const appInfos = await api('GET', '/v1/apps/' + APP_ID + '/appInfos?limit=5');
  let ageRatingFixed = false;

  for (const info of (appInfos.body.data || [])) {
    // Only fix the version that's REJECTED (editable)
    if (info.attributes.appStoreState === 'REJECTED') {
      const ageRating = await api('GET', '/v1/appInfos/' + info.id + '/ageRatingDeclaration');
      if (ageRating.body.data) {
        const arId = ageRating.body.data.id;
        const current = ageRating.body.data.attributes;
        console.log('  Current sexualContentOrNudity:', current.sexualContentOrNudity);
        console.log('  Current matureOrSuggestiveThemes:', current.matureOrSuggestiveThemes);

        if (current.sexualContentOrNudity === 'NONE') {
          console.log('  Updating sexualContentOrNudity to INFREQUENT_OR_MILD...');
          const fix = await api('PATCH', '/v1/ageRatingDeclarations/' + arId, {
            data: {
              type: 'ageRatingDeclarations',
              id: arId,
              attributes: {
                sexualContentOrNudity: 'INFREQUENT_OR_MILD',
              },
            },
          });
          if (fix.status === 200) {
            console.log('  ✅ Age rating updated successfully');
            console.log('  New sexualContentOrNudity:', fix.body.data?.attributes?.sexualContentOrNudity);
            ageRatingFixed = true;
            results.push('[PASS] Age rating: sexualContentOrNudity set to INFREQUENT_OR_MILD');
          } else {
            console.log('  ❌ Failed:', fix.status, JSON.stringify(fix.body.errors || fix.body));
            results.push('[FAIL] Age rating update failed: ' + fix.status);
          }
        } else {
          console.log('  Already set appropriately:', current.sexualContentOrNudity);
          ageRatingFixed = true;
          results.push('[SKIP] Age rating already correct');
        }
      }
    }
  }
  if (!ageRatingFixed) {
    console.log('  No REJECTED appInfo found to update age rating');
    results.push('[SKIP] No editable appInfo for age rating');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Fix App Categories
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════ STEP 2: FIX APP CATEGORIES ══════');
  for (const info of (appInfos.body.data || [])) {
    if (info.attributes.appStoreState === 'REJECTED') {
      // Check current categories
      const fullInfo = await api('GET', '/v1/appInfos/' + info.id + '?include=primaryCategory,secondaryCategory');
      const hasPrimary = fullInfo.body.included && fullInfo.body.included.length > 0;
      console.log('  Current categories included:', fullInfo.body.included?.map(i => i.id) || 'none');

      // Set HEALTH_AND_FITNESS as primary, EDUCATION as secondary
      console.log('  Setting primary=HEALTH_AND_FITNESS, secondary=EDUCATION...');
      const catFix = await api('PATCH', '/v1/appInfos/' + info.id, {
        data: {
          type: 'appInfos',
          id: info.id,
          relationships: {
            primaryCategory: {
              data: { type: 'appCategories', id: 'HEALTH_AND_FITNESS' },
            },
            secondaryCategory: {
              data: { type: 'appCategories', id: 'EDUCATION' },
            },
          },
        },
      });
      if (catFix.status === 200) {
        console.log('  ✅ Categories updated successfully');
        results.push('[PASS] Categories: HEALTH_AND_FITNESS + EDUCATION');
      } else {
        console.log('  ❌ Failed:', catFix.status, JSON.stringify(catFix.body.errors || catFix.body));
        results.push('[FAIL] Category update failed: ' + catFix.status);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Fix Missing iPhone 6.7" Screenshots
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════ STEP 3: FIX IPHONE 6.7" SCREENSHOTS ══════');
  const verLocs = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '/appStoreVersionLocalizations');

  for (const loc of (verLocs.body.data || [])) {
    console.log('  Locale:', loc.attributes.locale);
    const ssSets = await api('GET', '/v1/appStoreVersionLocalizations/' + loc.id + '/appScreenshotSets');
    const sets = ssSets.body.data || [];
    const types = sets.map((s) => s.attributes.screenshotDisplayType);

    console.log('  Existing screenshot types:', types.join(', '));

    // Check if 6.7" already exists
    if (types.includes('APP_IPHONE_67')) {
      console.log('  ✅ iPhone 6.7" screenshots already present');
      results.push('[SKIP] iPhone 6.7" screenshots already exist');
      continue;
    }

    // Find the 6.5" set to copy from
    const set65 = sets.find((s) => s.attributes.screenshotDisplayType === 'APP_IPHONE_65');
    if (!set65) {
      console.log('  ❌ No iPhone 6.5" screenshots to copy from');
      results.push('[FAIL] No 6.5" source screenshots');
      continue;
    }

    // Get the actual screenshot URLs from the 6.5" set
    const shots65 = await api('GET', '/v1/appScreenshotSets/' + set65.id + '/appScreenshots');
    const screenshots = shots65.body.data || [];
    console.log('  Found', screenshots.length, 'iPhone 6.5" screenshots to copy');

    if (screenshots.length === 0) {
      results.push('[FAIL] 6.5" set is empty');
      continue;
    }

    // Create the 6.7" screenshot set
    console.log('  Creating iPhone 6.7" screenshot set...');
    const newSet = await api('POST', '/v1/appScreenshotSets', {
      data: {
        type: 'appScreenshotSets',
        attributes: {
          screenshotDisplayType: 'APP_IPHONE_67',
        },
        relationships: {
          appStoreVersionLocalization: {
            data: { type: 'appStoreVersionLocalizations', id: loc.id },
          },
        },
      },
    });

    if (newSet.status !== 201) {
      console.log('  ❌ Failed to create screenshot set:', newSet.status, JSON.stringify(newSet.body.errors || newSet.body));
      results.push('[FAIL] Could not create 6.7" screenshot set');
      continue;
    }

    const setId67 = newSet.body.data.id;
    console.log('  Created set:', setId67);

    // Upload each screenshot from 6.5" to 6.7"
    let uploadedCount = 0;
    for (let i = 0; i < screenshots.length; i++) {
      const shot = screenshots[i];
      const imgUrl = shot.attributes.imageAsset?.templateUrl
        ?.replace('{w}', shot.attributes.imageAsset.width)
        ?.replace('{h}', shot.attributes.imageAsset.height)
        ?.replace('{f}', 'png');

      if (!imgUrl) {
        console.log('  ⚠️  Screenshot', i, 'has no imageAsset URL, skipping');
        continue;
      }

      console.log('  Downloading screenshot', i + 1, '/', screenshots.length, '...');
      const imgBuffer = await downloadBuffer(imgUrl);
      console.log('  Downloaded', imgBuffer.length, 'bytes');

      // Create the screenshot reservation
      const reservation = await api('POST', '/v1/appScreenshots', {
        data: {
          type: 'appScreenshots',
          attributes: {
            fileName: shot.attributes.fileName || ('screenshot_' + (i + 1) + '.png'),
            fileSize: imgBuffer.length,
          },
          relationships: {
            appScreenshotSet: {
              data: { type: 'appScreenshotSets', id: setId67 },
            },
          },
        },
      });

      if (reservation.status !== 201) {
        console.log('  ❌ Screenshot reservation failed:', reservation.status, JSON.stringify(reservation.body.errors || reservation.body));
        continue;
      }

      const resData = reservation.body.data;
      const uploadOps = resData.attributes.uploadOperations || [];
      console.log('  Upload operations:', uploadOps.length);

      // Upload chunks
      for (const op of uploadOps) {
        const chunk = imgBuffer.slice(op.offset, op.offset + op.length);
        const uploadResult = await uploadToApple(op.url, chunk);
        if (uploadResult.status >= 400) {
          console.log('  ❌ Upload failed for chunk:', uploadResult.status);
        }
      }

      // Commit the upload
      const commit = await api('PATCH', '/v1/appScreenshots/' + resData.id, {
        data: {
          type: 'appScreenshots',
          id: resData.id,
          attributes: {
            uploaded: true,
            sourceFileChecksum: resData.attributes.sourceFileChecksum,
          },
        },
      });

      if (commit.status === 200) {
        console.log('  ✅ Screenshot', i + 1, 'uploaded');
        uploadedCount++;
      } else {
        console.log('  ❌ Commit failed:', commit.status, JSON.stringify(commit.body.errors || commit.body));
      }

      await sleep(1000); // Rate limit
    }

    console.log('  Uploaded', uploadedCount, '/', screenshots.length, 'screenshots to iPhone 6.7"');
    results.push(uploadedCount === screenshots.length
      ? '[PASS] iPhone 6.7" screenshots: ' + uploadedCount + ' uploaded'
      : '[PARTIAL] iPhone 6.7" screenshots: ' + uploadedCount + '/' + screenshots.length);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║         FIX-ALL RESULTS                  ║');
  console.log('╠══════════════════════════════════════════╣');
  for (const r of results) {
    console.log('║  ' + r.padEnd(39) + '║');
  }
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Next: node submit-review.js             ║');
  console.log('╚══════════════════════════════════════════╝');
}

main().catch((err) => console.error('Fatal error:', err));
