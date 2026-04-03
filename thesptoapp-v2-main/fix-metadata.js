// Fix privacy policy URL and other metadata issues
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');
const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';

function createToken() {
  const pk = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }, pk, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' }
  });
}

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const token = createToken();
    const opts = {
      hostname: 'api.appstoreconnect.apple.com',
      path: urlPath,
      method,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }); }
        catch (e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. Get the WAITING_FOR_REVIEW appInfo and fix privacy policy URLs
  console.log('=== FIXING APP INFO LOCALIZATIONS (Privacy Policy URL) ===');
  const appInfos = await api('GET', '/v1/apps/' + APP_ID + '/appInfos?limit=5');
  
  for (const info of (appInfos.body.data || [])) {
    console.log('AppInfo:', info.id, 'state:', info.attributes.appStoreState);
    
    if (info.attributes.appStoreState === 'WAITING_FOR_REVIEW') {
      // Get localizations for this appInfo
      const locs = await api('GET', '/v1/appInfos/' + info.id + '/appInfoLocalizations');
      for (const loc of (locs.body.data || [])) {
        console.log('  Locale:', loc.attributes.locale);
        console.log('  Current privacy policy URL:', loc.attributes.privacyPolicyUrl);
        console.log('  Current privacy choices URL:', loc.attributes.privacyChoicesUrl);
        
        // Fix: point to the actual privacy page
        if (loc.attributes.privacyPolicyUrl && !loc.attributes.privacyPolicyUrl.endsWith('/privacy')) {
          console.log('\n  FIXING privacy policy URL...');
          const fix = await api('PATCH', '/v1/appInfoLocalizations/' + loc.id, {
            data: {
              type: 'appInfoLocalizations',
              id: loc.id,
              attributes: {
                privacyPolicyUrl: 'https://thesptoapp-v2.vercel.app/privacy',
                privacyChoicesUrl: 'https://thesptoapp-v2.vercel.app/privacy'
              }
            }
          });
          console.log('  Fix status:', fix.status);
          if (fix.status === 200) {
            console.log('  SUCCESS! Privacy policy URL updated to /privacy');
          } else {
            console.log('  Error:', JSON.stringify(fix.body.errors || fix.body, null, 2));
          }
        }
      }
    }
  }

  // 2. Check/fix version localization support URL
  console.log('\n=== CHECKING VERSION LOCALIZATIONS ===');
  const verLocs = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '/appStoreVersionLocalizations');
  for (const loc of (verLocs.body.data || [])) {
    const a = loc.attributes;
    console.log('Locale:', a.locale);
    console.log('  Support URL:', a.supportUrl);
    console.log('  Marketing URL:', a.marketingUrl);
    
    // Check if the support URL should also be more specific
    // Support URL should work - it's the main site with contact info
  }

  // 3. Check app category 
  console.log('\n=== CHECKING APP CATEGORY ===');
  for (const info of (appInfos.body.data || [])) {
    if (info.attributes.appStoreState === 'WAITING_FOR_REVIEW') {
      // Get full appInfo with included relationships
      const fullInfo = await api('GET', '/v1/appInfos/' + info.id + '?include=primaryCategory,secondaryCategory,primarySubcategoryOne,primarySubcategoryTwo');
      console.log('Primary category:', fullInfo.body.included?.[0]?.attributes?.platforms?.[0] || 'checking...');
      
      for (const inc of (fullInfo.body.included || [])) {
        console.log('  Category:', inc.type, inc.id, JSON.stringify(inc.attributes));
      }
      
      if (!fullInfo.body.included || fullInfo.body.included.length === 0) {
        console.log('  WARNING: No categories set!');
        
        // Try to list available categories
        const cats = await api('GET', '/v1/appCategories?filter[platforms]=IOS&limit=50');
        const healthCats = (cats.body.data || []).filter(c => 
          c.attributes?.platforms?.includes('IOS') && 
          (c.id.includes('HEALTH') || c.id.includes('MEDICAL') || c.id.includes('EDUCATION'))
        );
        console.log('  Available health/education categories:');
        for (const c of healthCats) {
          console.log('    ' + c.id);
        }
      }
    }
  }

  // 4. Current version state
  console.log('\n=== CURRENT STATUS ===');
  const ver = await api('GET', '/v1/appStoreVersions/' + VERSION_ID + '?include=build');
  console.log('Version:', ver.body.data?.attributes?.versionString);
  console.log('State:', ver.body.data?.attributes?.appStoreState);
  if (ver.body.included?.[0]) {
    console.log('Build:', ver.body.included[0].attributes?.version);
    console.log('Build processing:', ver.body.included[0].attributes?.processingState);
  }
}

main().catch(err => console.error('Error:', err));
