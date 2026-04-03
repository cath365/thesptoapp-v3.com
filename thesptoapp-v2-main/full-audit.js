// Check EVERYTHING Apple commonly rejects for
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_ID = 'X79F2H3QXT';
const ISSUER_ID = '3ddd637a-4279-41fa-8c12-672a3c557cba';
const APP_ID = '6755155637';
const KEY_PATH = path.join(__dirname, 'AuthKey_X79F2H3QXT.p8');

function createToken() {
  const pk = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }, pk, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' }
  });
}

function api(urlPath) {
  return new Promise((resolve, reject) => {
    const token = createToken();
    const opts = {
      hostname: 'api.appstoreconnect.apple.com',
      path: urlPath,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d || '{}')); }
        catch (e) { resolve({ rawError: d }); }
      });
    }).on('error', reject).end();
  });
}

async function main() {
  const issues = [];
  const report = [];

  // ===== 1. PRIVACY POLICY =====
  report.push('===== 1. PRIVACY POLICY =====');
  const appInfos = await api('/v1/apps/' + APP_ID + '/appInfos?include=appInfoLocalizations&limit=5');
  for (const info of (appInfos.data || [])) {
    report.push('AppInfo ' + info.id + ' state=' + info.attributes.appStoreState);
    // Get localizations for this appInfo
    const locUrl = '/v1/appInfos/' + info.id + '/appInfoLocalizations';
    const locs = await api(locUrl);
    for (const loc of (locs.data || [])) {
      report.push('  Locale: ' + loc.attributes.locale);
      report.push('  Privacy Policy URL: ' + (loc.attributes.privacyPolicyUrl || '(EMPTY!)'));
      report.push('  Privacy Policy Text: ' + (loc.attributes.privacyPolicyText || '(empty)'));
      report.push('  Privacy Choices URL: ' + (loc.attributes.privacyChoicesUrl || '(empty)'));
      if (!loc.attributes.privacyPolicyUrl) {
        issues.push('CRITICAL: Missing privacy policy URL for locale ' + loc.attributes.locale + ' in appInfo ' + info.id);
      }
    }
  }

  // ===== 2. APP PRIVACY / DATA COLLECTION =====
  report.push('\n===== 2. APP PRIVACY / DATA COLLECTION =====');
  // Check app privacy
  const appPrivacy = await api('/v2/apps/' + APP_ID + '?fields[apps]=appStoreVersions');
  report.push('App v2 status: ' + (appPrivacy.data ? 'OK' : 'Error'));

  // ===== 3. AGE RATING DECLARATION =====
  report.push('\n===== 3. AGE RATING =====');
  for (const info of (appInfos.data || [])) {
    if (info.attributes.appStoreState === 'WAITING_FOR_REVIEW' || info.attributes.appStoreState === 'READY_FOR_SALE') {
      const ageRating = await api('/v1/appInfos/' + info.id + '/ageRatingDeclaration');
      if (ageRating.data) {
        const ar = ageRating.data.attributes;
        report.push('State: ' + info.attributes.appStoreState);
        report.push('  Health/Wellness: ' + ar.healthOrWellnessTopics);
        report.push('  Medical info: ' + ar.medicalOrTreatmentInformation);
        report.push('  Mature themes: ' + ar.matureOrSuggestiveThemes);
        report.push('  Sexual content: ' + ar.sexualContentOrNudity);
        report.push('  User generated content: ' + ar.userGeneratedContent);
        report.push('  Messaging/Chat: ' + ar.messagingAndChat);
        report.push('  Gambling: ' + ar.gambling);
        report.push('  Unrestricted web: ' + ar.unrestrictedWebAccess);
        report.push('  Age rating: ' + ar.ageRatingOverride);
        // Health app with SRHR content - check for appropriate ratings
        if (ar.sexualContentOrNudity === 'NONE' && true) {
          report.push('  NOTE: SRHR app with sexualContentOrNudity=NONE - this may be flagged');
        }
      }
    }
  }

  // ===== 4. SCREENSHOTS & PREVIEWS =====
  report.push('\n===== 4. SCREENSHOTS =====');
  const VERSION_ID = '193a42ea-6826-4118-a8d2-d6483702e08c';
  const locResults = await api('/v1/appStoreVersions/' + VERSION_ID + '/appStoreVersionLocalizations');
  for (const loc of (locResults.data || [])) {
    report.push('Locale: ' + loc.attributes.locale);
    const ssSet = await api('/v1/appStoreVersionLocalizations/' + loc.id + '/appScreenshotSets');
    const sets = ssSet.data || [];
    report.push('  Screenshot sets: ' + sets.length);
    const requiredTypes = ['APP_IPHONE_67', 'APP_IPHONE_65', 'APP_IPAD_PRO_3GEN_129', 'APP_IPAD_PRO_6GEN_129'];
    const presentTypes = sets.map(s => s.attributes.screenshotDisplayType);
    report.push('  Present types: ' + presentTypes.join(', '));
    
    for (const ss of sets) {
      const shots = await api('/v1/appScreenshotSets/' + ss.id + '/appScreenshots');
      const count = (shots.data || []).length;
      report.push('    ' + ss.attributes.screenshotDisplayType + ': ' + count + ' screenshots');
      if (count < 3) issues.push('Only ' + count + ' screenshots for ' + ss.attributes.screenshotDisplayType + ' (minimum 3 recommended)');
    }
    
    // Check if iPhone 6.7" is missing (required for newer devices)
    if (!presentTypes.includes('APP_IPHONE_67')) {
      issues.push('Missing iPhone 6.7" (APP_IPHONE_67) screenshots - required for iPhone 14 Pro Max / 15 Pro Max');
    }
    if (!presentTypes.includes('APP_IPAD_PRO_6GEN_129')) {
      report.push('  NOTE: No iPad Pro 6th gen screenshots (APP_IPAD_PRO_6GEN_129)');
    }
  }

  // ===== 5. VERSION LOCALIZATION COMPLETENESS =====
  report.push('\n===== 5. METADATA COMPLETENESS =====');
  for (const loc of (locResults.data || [])) {
    const a = loc.attributes;
    report.push('Locale: ' + a.locale);
    report.push('  Description length: ' + (a.description || '').length);
    report.push('  Keywords: ' + (a.keywords || '(empty)'));
    report.push('  Support URL: ' + (a.supportUrl || '(EMPTY!)'));
    report.push('  Marketing URL: ' + (a.marketingUrl || '(empty)'));
    report.push('  Whats New: ' + (a.whatsNew || '(EMPTY!)'));
    
    if (!a.description || a.description.length < 100) issues.push('Description too short (' + (a.description || '').length + ' chars) for ' + a.locale);
    if (!a.keywords) issues.push('Missing keywords for ' + a.locale);
    if (!a.supportUrl) issues.push('CRITICAL: Missing support URL for ' + a.locale);
    if (!a.whatsNew) issues.push('Missing whats new text for ' + a.locale);
  }

  // ===== 6. EXPORT COMPLIANCE =====
  report.push('\n===== 6. EXPORT COMPLIANCE =====');
  const NEW_BUILD_ID = '23b7a10f-06b9-4155-a7b0-4fbe23e02d97';
  const buildDetail = await api('/v1/builds/' + NEW_BUILD_ID);
  const bd = buildDetail.data?.attributes;
  report.push('Uses non-exempt encryption: ' + bd?.usesNonExemptEncryption);
  if (bd?.usesNonExemptEncryption === null || bd?.usesNonExemptEncryption === undefined) {
    issues.push('CRITICAL: Export compliance (usesNonExemptEncryption) not set on build');
  }

  // ===== 7. APP CATEGORY =====
  report.push('\n===== 7. APP CATEGORY =====');
  for (const info of (appInfos.data || [])) {
    if (info.attributes.appStoreState === 'WAITING_FOR_REVIEW') {
      report.push('Categories for pending version:');
      const cats = info.relationships;
      report.push('  Primary category: ' + JSON.stringify(cats?.primaryCategory?.data));
      report.push('  Secondary category: ' + JSON.stringify(cats?.secondaryCategory?.data));
      report.push('  Primary subcategory 1: ' + JSON.stringify(cats?.primarySubcategoryOne?.data));
      report.push('  Primary subcategory 2: ' + JSON.stringify(cats?.primarySubcategoryTwo?.data));
    }
  }

  // ===== 8. REVIEW CONTACT & DEMO =====
  report.push('\n===== 8. REVIEW CONTACT & DEMO ACCOUNT =====');
  const reviewDetail = await api('/v1/appStoreVersions/' + VERSION_ID + '/appStoreReviewDetail');
  if (reviewDetail.data) {
    const rd = reviewDetail.data.attributes;
    report.push('Contact: ' + rd.contactFirstName + ' ' + rd.contactLastName);
    report.push('Email: ' + rd.contactEmail);
    report.push('Phone: ' + rd.contactPhone);
    report.push('Demo user: ' + rd.demoAccountName);
    report.push('Demo pass set: ' + (rd.demoAccountPassword ? 'YES' : 'NO!'));
    report.push('Notes length: ' + (rd.notes || '').length);
    report.push('Demo required: ' + rd.demoAccountRequired);
    
    if (!rd.contactEmail) issues.push('CRITICAL: Missing review contact email');
    if (!rd.contactPhone) issues.push('CRITICAL: Missing review contact phone');
    if (!rd.demoAccountName) issues.push('WARNING: No demo account - reviewers may not be able to test the app');
    if (!rd.demoAccountPassword) issues.push('WARNING: Demo password not set');
  }

  // ===== 9. IN-APP PURCHASES =====
  report.push('\n===== 9. IN-APP PURCHASES =====');
  const iaps = await api('/v1/apps/' + APP_ID + '/inAppPurchasesV2?limit=5');
  report.push('IAPs: ' + (iaps.data || []).length);
  for (const iap of (iaps.data || [])) {
    report.push('  ' + iap.attributes.productId + ' | ' + iap.attributes.name + ' | state: ' + iap.attributes.state);
  }

  // ===== SUMMARY =====
  report.push('\n========================================');
  report.push('===== FULL AUDIT REPORT =====');
  report.push('========================================');
  if (issues.length === 0) {
    report.push('NO ISSUES FOUND');
  } else {
    report.push(issues.length + ' ISSUE(S):');
    issues.forEach((issue, i) => report.push('  ' + (i + 1) + '. ' + issue));
  }

  const output = report.join('\n');
  console.log(output);
  fs.writeFileSync(path.join(__dirname, 'full-audit.txt'), output);
}

main().catch(err => console.error('Error:', err));
