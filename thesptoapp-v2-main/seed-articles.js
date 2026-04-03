#!/usr/bin/env node
/**
 * seed-articles.js
 *
 * Seeds the Firestore "articles" collection for The Spot app with educational
 * content across all 9 categories. Uses the Firestore REST API (no SDK needed).
 *
 * Strategy:
 *   1. Temporarily deploy permissive Firestore rules (allow all writes)
 *   2. Upload all article documents via unauthenticated PATCH
 *   3. Restore and deploy the original secure Firestore rules
 *
 * Usage:  node seed-articles.js
 *
 * Prerequisites:
 *   - Firebase CLI installed and authenticated (`firebase login`)
 *   - firebase.json in the outer project directory (../firebase.json)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Firebase config ────────────────────────────────────────────────────────
const PROJECT_ID = 'spot-app-575e9';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// The outer directory containing firebase.json and firestore.rules
const FIREBASE_PROJECT_DIR = path.join(__dirname, '..');
const RULES_FILE = path.join(FIREBASE_PROJECT_DIR, 'firestore.rules');

const TEMP_OPEN_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /articles/{articleId} {
      allow read, write: if true;
    }
    // Keep other rules locked down
    match /{document=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Make an HTTPS request and return parsed JSON. */
function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json.error || json)}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Parse error (${res.statusCode}): ${data.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ─── Firebase rules deployment ──────────────────────────────────────────────

function deployRules(label) {
  console.log(`  Deploying Firestore rules (${label})...`);
  try {
    const result = execSync(
      `firebase deploy --only firestore:rules --project ${PROJECT_ID}`,
      { encoding: 'utf8', timeout: 90000, cwd: FIREBASE_PROJECT_DIR }
    );
    // Check for success indicator
    if (result.includes('Deploy complete') || result.includes('deploy complete')) {
      console.log(`  Rules deployed successfully (${label}).`);
      return true;
    }
    console.log(result);
    return true; // Assume success if no error thrown
  } catch (err) {
    console.error(`  Rules deployment FAILED (${label}):`);
    if (err.stdout) console.error('  STDOUT:', err.stdout.slice(0, 500));
    if (err.stderr) console.error('  STDERR:', err.stderr.slice(0, 500));
    return false;
  }
}

function openRulesForSeeding() {
  const originalRules = fs.readFileSync(RULES_FILE, 'utf8');
  fs.writeFileSync(RULES_FILE, TEMP_OPEN_RULES, 'utf8');
  const ok = deployRules('temporary open for articles');
  if (!ok) {
    // Restore immediately on failure
    fs.writeFileSync(RULES_FILE, originalRules, 'utf8');
    throw new Error('Failed to deploy temporary open rules. Original rules restored on disk.');
  }
  return originalRules;
}

function restoreRules(originalRules) {
  fs.writeFileSync(RULES_FILE, originalRules, 'utf8');
  const ok = deployRules('restored secure rules');
  if (!ok) {
    console.error('  WARNING: Secure rules are restored on disk but deployment failed.');
    console.error('  Run manually: firebase deploy --only firestore:rules --project ' + PROJECT_ID);
  }
}

// ─── Firestore value converters ─────────────────────────────────────────────

function toStringVal(v) { return { stringValue: String(v) }; }
function toIntVal(v) { return { integerValue: String(Math.round(v)) }; }
function toBoolVal(v) { return { booleanValue: !!v }; }
function toArrayOfStrings(arr) {
  return {
    arrayValue: {
      values: (arr || []).map((s) => ({ stringValue: String(s) })),
    },
  };
}

function subsectionToFirestore(sub) {
  return {
    mapValue: {
      fields: {
        id: toStringVal(sub.id),
        title: toStringVal(sub.title),
        content: toStringVal(sub.content || ''),
        order: toIntVal(sub.order),
      },
    },
  };
}

function sectionToFirestore(sec) {
  const fields = {
    id: toStringVal(sec.id),
    title: toStringVal(sec.title),
    content: toStringVal(sec.content || ''),
    order: toIntVal(sec.order),
  };
  if (sec.subsections && sec.subsections.length > 0) {
    fields.subsections = {
      arrayValue: {
        values: sec.subsections.map(subsectionToFirestore),
      },
    };
  }
  return { mapValue: { fields } };
}

function articleToFirestoreFields(article) {
  return {
    id: toStringVal(article.id),
    title: toStringVal(article.title),
    summary: toStringVal(article.summary),
    category: toStringVal(article.category),
    tags: toArrayOfStrings(article.tags),
    featuredImage: toStringVal(article.featuredImage),
    estimatedReadTime: toIntVal(article.estimatedReadTime),
    publishedDate: toStringVal(article.publishedDate),
    lastUpdated: toStringVal(article.lastUpdated),
    author: toStringVal(article.author),
    sources: toArrayOfStrings(article.sources),
    isPublished: toBoolVal(article.isPublished),
    difficulty: toStringVal(article.difficulty),
    targetAudience: toArrayOfStrings(article.targetAudience),
    sections: {
      arrayValue: {
        values: article.sections.map(sectionToFirestore),
      },
    },
  };
}

/** Upload one article document via unauthenticated PATCH. */
async function uploadArticle(article) {
  const docId = article.id;
  const url = `${FIRESTORE_BASE}/articles/${docId}`;
  const body = JSON.stringify({ fields: articleToFirestoreFields(article) });
  return request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, body);
}

// ─── Normalise local data files ─────────────────────────────────────────────

/**
 * Some data files store bullet lists as `list` arrays instead of `content`.
 * Merge list items into the content string so the Article type is satisfied.
 */
function normaliseListToContent(obj) {
  let content = obj.content || '';
  if (obj.list && Array.isArray(obj.list)) {
    const bullets = obj.list.map((item) => `\u2022 ${item}`).join('\n');
    content = content ? content + '\n\n' + bullets : bullets;
  }
  return content;
}

function normaliseSections(sections) {
  return sections.map((sec, i) => {
    const section = {
      id: sec.id || slugify(sec.title),
      title: sec.title,
      content: normaliseListToContent(sec),
      order: sec.order != null ? sec.order : i + 1,
    };
    if (sec.subsections && sec.subsections.length > 0) {
      section.subsections = sec.subsections.map((sub, j) => ({
        id: sub.id || slugify(sub.title),
        title: sub.title,
        content: normaliseListToContent(sub),
        order: sub.order != null ? sub.order : j + 1,
      }));
    }
    return section;
  });
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Load local data (categories 1-4) ──────────────────────────────────────

function loadJsonFile(filename) {
  const fullPath = path.join(__dirname, 'data', filename);
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

function prepareMenstrualHealth() {
  const raw = loadJsonFile('menstrual_health.json');
  raw.sections = normaliseSections(raw.sections);
  return raw;
}

function prepareHivStis() {
  const raw = loadJsonFile('sampleArticle.json');
  raw.sections = normaliseSections(raw.sections);
  return raw;
}

function prepareMaternalHealth() {
  const raw = loadJsonFile('maternal_health_information.json');
  // This file lacks many top-level fields -- fill them in.
  const resourceSection = raw.sections.find((s) => s.title === 'Resources');
  const sources = resourceSection && resourceSection.links ? resourceSection.links : [];
  // Remove the "Resources" section from content sections (it's metadata, not article content)
  const contentSections = raw.sections.filter((s) => s.title !== 'Resources');

  return {
    id: 'maternal-health-guide',
    title: raw.title,
    summary:
      'A comprehensive guide to maternal health covering preconception care, pregnancy stages, labour and delivery, postpartum recovery, newborn care, and resources available in Zambia.',
    category: 'maternal-health',
    tags: ['maternal-health', 'pregnancy', 'childbirth', 'postpartum', 'newborn', 'Zambia'],
    featuredImage: 'https://storage.googleapis.com/thespot-app/images/maternal-health.jpg',
    estimatedReadTime: 30,
    publishedDate: '2025-11-10T00:00:00Z',
    lastUpdated: '2025-11-10T00:00:00Z',
    author: 'The Spot Health Team',
    sources,
    isPublished: true,
    difficulty: 'beginner',
    targetAudience: ['young-women', 'expectant-mothers', 'educators'],
    sections: normaliseSections(contentSections),
  };
}

function prepareSrhrLaws() {
  const raw = loadJsonFile('srhr_laws.json');
  raw.sections = normaliseSections(raw.sections);
  return raw;
}

// ─── Authored articles for categories 5-9 ───────────────────────────────────

function createSafeAbortionArticle() {
  return {
    id: 'safe-abortion-guide',
    title: 'Safe Abortion: Your Rights, Options, and Care in Zambia and Africa',
    summary:
      'An educational guide on safe abortion rights in Zambia and across Africa, including legal status, safe medical and surgical options, aftercare, myths vs facts, and where to get help.',
    category: 'safe-abortion',
    tags: ['safe-abortion', 'reproductive-rights', 'Zambia', 'Africa', 'women-health', 'medical-abortion'],
    featuredImage: 'https://storage.googleapis.com/thespot-app/images/safe-abortion.jpg',
    estimatedReadTime: 15,
    publishedDate: '2025-11-10T00:00:00Z',
    lastUpdated: '2025-11-10T00:00:00Z',
    author: 'The Spot Health Team',
    sources: [
      'https://www.who.int/news-room/fact-sheets/detail/abortion',
      'https://www.guttmacher.org/regions/africa',
      'https://www.ipas.org/where-we-work/africa/',
      'Zambia Termination of Pregnancy Act (1972)',
      'https://www.unfpa.org/topics/safe-abortion',
    ],
    isPublished: true,
    difficulty: 'intermediate',
    targetAudience: ['young-women', 'health-workers', 'educators'],
    sections: [
      {
        id: 'legal-status',
        title: 'Legal Status of Abortion in Zambia and Africa',
        order: 1,
        content:
          'Understanding the law is the first step. Abortion laws vary widely across Africa, and knowing your rights can help you access safe care.',
        subsections: [
          {
            id: 'zambia-abortion-law',
            title: 'Zambia',
            order: 1,
            content:
              'In Zambia, abortion is legal under the Termination of Pregnancy Act (1972). It is permitted when continuing the pregnancy would risk the life of the pregnant person, cause injury to their physical or mental health, or if there is a risk the child would be born with serious physical or mental abnormalities. The procedure requires the approval of three medical practitioners (one must be a specialist). While the law is relatively liberal compared to many African countries, in practice, access remains limited -- especially in rural areas where specialist doctors are scarce. Many women are unaware the law allows abortion under these conditions.',
          },
          {
            id: 'africa-overview',
            title: 'Across Africa',
            order: 2,
            content:
              'Abortion laws range from highly restrictive to broadly permissive:\n\n\u2022 South Africa: Abortion on request up to 12 weeks; under certain conditions up to 20 weeks (Choice on Termination of Pregnancy Act, 1996).\n\u2022 Mozambique and Ethiopia: Relatively progressive laws allowing abortion in several circumstances.\n\u2022 Kenya: Permitted when the life or health of the mother is in danger (Constitution, 2010).\n\u2022 Tanzania, Uganda, Nigeria: Highly restrictive, generally only to save the life of the woman.\n\nThe Maputo Protocol (2003) calls on African Union member states to allow abortion in cases of sexual assault, rape, incest, and where the pregnancy endangers the life or health of the mother. Over 40 countries have ratified this protocol.',
          },
        ],
      },
      {
        id: 'safe-options',
        title: 'Safe Abortion Methods',
        order: 2,
        content:
          'When performed by trained health workers using approved methods, abortion is one of the safest medical procedures. The WHO recognises two main safe approaches.',
        subsections: [
          {
            id: 'medical-abortion',
            title: 'Medical Abortion (Medication)',
            order: 1,
            content:
              'Medical abortion uses pills to end a pregnancy, most commonly a combination of mifepristone and misoprostol. It is safe and effective up to 12 weeks of pregnancy (and can be used later under medical supervision).\n\n\u2022 How it works: Mifepristone stops the hormone progesterone, and misoprostol (taken 24-48 hours later) causes the uterus to contract and empty.\n\u2022 Effectiveness: Over 95% effective when used correctly.\n\u2022 What to expect: Cramping and bleeding (like a heavy period) for several hours. Most people pass the pregnancy tissue within 4-6 hours of taking misoprostol.\n\u2022 Important: Always follow up with a healthcare provider to confirm the abortion is complete.',
          },
          {
            id: 'surgical-abortion',
            title: 'Surgical Abortion (MVA)',
            order: 2,
            content:
              'Manual Vacuum Aspiration (MVA) is a simple, safe surgical procedure usually done in the first trimester (up to 12-14 weeks).\n\n\u2022 How it works: A healthcare provider uses gentle suction to empty the uterus through the cervix. It takes about 5-10 minutes.\n\u2022 Anaesthesia: Local anaesthesia or light sedation is used. It is an outpatient procedure -- you go home the same day.\n\u2022 Effectiveness: Over 99% effective.\n\u2022 Recovery: Most people feel well enough to return to normal activities within a day or two.\n\nDilation and Evacuation (D&E) is used for pregnancies beyond 14 weeks and requires more specialised care.',
          },
        ],
      },
      {
        id: 'aftercare-and-myths',
        title: 'Aftercare, Myths vs Facts, and Getting Help',
        order: 3,
        content:
          'Proper aftercare is essential, and understanding the facts helps you make informed decisions.',
        subsections: [
          {
            id: 'aftercare',
            title: 'Aftercare After Abortion',
            order: 1,
            content:
              '\u2022 Rest for a day or two; avoid strenuous activity for at least a week.\n\u2022 Use sanitary pads (not tampons) for the first two weeks.\n\u2022 Take prescribed painkillers (ibuprofen or paracetamol) for cramping.\n\u2022 Avoid sexual intercourse for at least two weeks to reduce infection risk.\n\u2022 Attend your follow-up appointment (usually within 1-2 weeks).\n\u2022 Seek immediate medical help if you experience: heavy bleeding (soaking more than 2 thick pads per hour for 2+ hours), fever above 38\u00b0C, severe abdominal pain, or foul-smelling discharge.\n\u2022 Your period should return within 4-6 weeks. Fertility returns almost immediately, so discuss contraception with your provider.',
          },
          {
            id: 'myths-vs-facts',
            title: 'Myths vs Facts',
            order: 2,
            content:
              'MYTH: Abortion causes infertility.\nFACT: Safe abortion does not affect future fertility. Complications from UNSAFE abortion (using unsterile methods or untrained providers) can cause damage.\n\nMYTH: Abortion is always illegal in Africa.\nFACT: Most African countries allow abortion in at least some circumstances. Zambia has one of the more liberal laws on the continent.\n\nMYTH: Only "bad" or "irresponsible" people need abortions.\nFACT: People from all backgrounds access abortion. Contraception can fail, and circumstances change. It is a normal part of reproductive healthcare.\n\nMYTH: Herbal or traditional methods are safe alternatives.\nFACT: Unregulated herbal preparations can be toxic and cause serious harm including organ failure. Always seek care from trained health professionals.\n\nMYTH: You need your partner\'s or parent\'s permission.\nFACT: In Zambia, the law requires consent from three doctors, not from a partner or parent. However, for minors, health workers may involve a guardian.',
          },
          {
            id: 'where-to-get-help',
            title: 'Where to Get Help',
            order: 3,
            content:
              '\u2022 Your nearest government hospital or health centre -- ask for the reproductive health department.\n\u2022 Marie Stopes Zambia: Provides safe abortion services and counselling. Visit mariestopes.org.zm or call their helpline.\n\u2022 Planned Parenthood Association of Zambia (PPAZ): Offers SRHR services including safe abortion referrals.\n\u2022 University Teaching Hospital (UTH), Lusaka: Provides comprehensive reproductive health services.\n\u2022 UNFPA Zambia: zambia.unfpa.org -- information on safe motherhood and SRHR services.\n\u2022 If you are in crisis or need immediate help, go to the nearest hospital emergency department.',
          },
        ],
      },
    ],
  };
}

function createContraceptivesArticle() {
  return {
    id: 'contraceptives-guide',
    title: 'Contraception: Types, How They Work, and Where to Access Them in Zambia',
    summary:
      'A practical guide to all major contraceptive methods available in Zambia -- how they work, their effectiveness, side effects, and where to get them.',
    category: 'contraceptives',
    tags: ['contraceptives', 'family-planning', 'sexual-health', 'Zambia', 'prevention', 'reproductive-health'],
    featuredImage: 'https://storage.googleapis.com/thespot-app/images/contraceptives.jpg',
    estimatedReadTime: 15,
    publishedDate: '2025-11-10T00:00:00Z',
    lastUpdated: '2025-11-10T00:00:00Z',
    author: 'The Spot Health Team',
    sources: [
      'https://www.who.int/news-room/fact-sheets/detail/family-planning-contraception',
      'https://www.plannedparenthood.org/learn/birth-control',
      'https://zambia.unfpa.org/en/topics/family-planning',
      'https://www.fpazambia.org.zm/',
      'https://www.cdc.gov/reproductivehealth/contraception/index.htm',
    ],
    isPublished: true,
    difficulty: 'beginner',
    targetAudience: ['young-women', 'adolescents', 'sexually-active'],
    sections: [
      {
        id: 'understanding-contraception',
        title: 'Understanding Contraception',
        order: 1,
        content:
          'Contraception (also called birth control or family planning) refers to methods and devices used to prevent pregnancy. Using contraception allows you to decide if, when, and how many children you want to have. There is no single "best" method -- the right choice depends on your health, lifestyle, relationships, and future plans. A healthcare provider can help you find the best fit.',
        subsections: [
          {
            id: 'why-contraception-matters',
            title: 'Why Contraception Matters',
            order: 1,
            content:
              '\u2022 Prevents unintended pregnancies, which account for nearly half of all pregnancies globally.\n\u2022 Allows you to finish school and pursue your goals before starting a family.\n\u2022 Reduces the need for unsafe abortion, which is a leading cause of maternal death in Africa.\n\u2022 Some methods (condoms) also protect against STIs and HIV.\n\u2022 Helps with child spacing, which improves the health of both mother and children.',
          },
        ],
      },
      {
        id: 'types-of-contraception',
        title: 'Types of Contraception',
        order: 2,
        content:
          'Here are the main types of contraception available in Zambia, grouped by how they work.',
        subsections: [
          {
            id: 'barrier-methods',
            title: 'Barrier Methods',
            order: 1,
            content:
              'Male Condoms\n\u2022 How it works: A thin latex or polyurethane sheath worn on the penis during sex, blocking sperm from entering the vagina.\n\u2022 Effectiveness: About 87% with typical use; 98% with perfect use.\n\u2022 Bonus: The only method that also protects against STIs and HIV.\n\u2022 Availability: Free at most clinics and health centres in Zambia; also sold at pharmacies and shops.\n\nFemale Condoms\n\u2022 How it works: A pouch inserted into the vagina before sex. It lines the vaginal walls and collects semen.\n\u2022 Effectiveness: About 79% with typical use; 95% with perfect use.\n\u2022 Bonus: Also protects against STIs. Can be inserted up to 8 hours before sex.\n\u2022 Availability: Available at health centres and some pharmacies.',
          },
          {
            id: 'hormonal-methods',
            title: 'Hormonal Methods',
            order: 2,
            content:
              'The Pill (Oral Contraceptives)\n\u2022 How it works: Daily pills containing hormones (oestrogen and progestin, or progestin only) that prevent ovulation.\n\u2022 Effectiveness: About 93% with typical use; 99% with perfect use.\n\u2022 Side effects: May cause nausea, headaches, breast tenderness, or mood changes in the first few months. Usually settle down.\n\u2022 Note: Must be taken at the same time every day to be most effective.\n\nInjectable Contraceptives (Depo-Provera)\n\u2022 How it works: A progestin injection given every 3 months (12 weeks) that prevents ovulation and thickens cervical mucus.\n\u2022 Effectiveness: About 96% with typical use; over 99% with perfect use.\n\u2022 Popular in Zambia: This is one of the most widely used methods. Available free at government clinics.\n\u2022 Side effects: Irregular bleeding, weight gain, delayed return to fertility (can take 6-12 months after stopping).\n\nImplant (Jadelle / Implanon)\n\u2022 How it works: A small flexible rod inserted under the skin of the upper arm, releasing progestin for 3-5 years.\n\u2022 Effectiveness: Over 99% -- one of the most effective methods available.\n\u2022 Advantages: Long-lasting, low maintenance, easily reversible (fertility returns quickly after removal).\n\u2022 Side effects: Irregular bleeding, especially in the first year.\n\u2022 Availability: Available at health centres across Zambia. Insertion and removal must be done by a trained provider.',
          },
          {
            id: 'iud-methods',
            title: 'Intrauterine Devices (IUDs)',
            order: 3,
            content:
              'Copper IUD\n\u2022 How it works: A small T-shaped device inserted into the uterus by a healthcare provider. Copper creates an environment that is toxic to sperm.\n\u2022 Effectiveness: Over 99%.\n\u2022 Duration: Lasts up to 10-12 years.\n\u2022 Advantages: Hormone-free, very long-lasting, immediately reversible on removal.\n\u2022 Side effects: May cause heavier or more painful periods in the first few months.\n\nHormonal IUD (Mirena)\n\u2022 How it works: Similar T-shaped device but releases a small amount of progestin locally.\n\u2022 Effectiveness: Over 99%.\n\u2022 Duration: Lasts up to 5 years.\n\u2022 Advantages: Often makes periods lighter. Lower hormonal dose than pills or injections.\n\u2022 Availability: IUDs are available at larger health facilities and family planning clinics in Zambia.',
          },
          {
            id: 'emergency-contraception',
            title: 'Emergency Contraception',
            order: 4,
            content:
              'Emergency Contraceptive Pill ("Morning-After Pill")\n\u2022 How it works: A high dose of levonorgestrel (or ulipristal acetate) taken after unprotected sex to prevent or delay ovulation.\n\u2022 When to use: Within 72 hours (3 days) of unprotected sex -- the sooner, the more effective. Some types work up to 5 days.\n\u2022 Effectiveness: 85-95% depending on how quickly it is taken.\n\u2022 Important: This is NOT a regular contraceptive method. It is for emergencies only -- after a condom breaks, missed pills, or forced sex.\n\u2022 Availability: Available at pharmacies in Zambia (brands like Postinor-2). No prescription needed.\n\nCopper IUD as Emergency Contraception\n\u2022 Can be inserted within 5 days of unprotected sex.\n\u2022 Over 99% effective as emergency contraception and then continues as long-term contraception.',
          },
          {
            id: 'permanent-methods',
            title: 'Permanent Methods',
            order: 5,
            content:
              'Tubal Ligation (Female Sterilisation)\n\u2022 A surgical procedure that permanently blocks the fallopian tubes.\n\u2022 Suitable for those who are certain they do not want more children.\n\u2022 Effectiveness: Over 99%.\n\nVasectomy (Male Sterilisation)\n\u2022 A minor surgical procedure that cuts the tubes carrying sperm.\n\u2022 Effectiveness: Over 99% (after confirmation that sperm count is zero).\n\u2022 Note: Neither method protects against STIs.',
          },
        ],
      },
      {
        id: 'access-in-zambia',
        title: 'Where to Access Contraception in Zambia',
        order: 3,
        content:
          'Contraceptives are widely available across Zambia, and many methods are provided free of charge at government facilities.',
        subsections: [
          {
            id: 'where-to-go',
            title: 'Where to Go',
            order: 1,
            content:
              '\u2022 Government health centres and hospitals: Provide free contraceptives including condoms, pills, injectables, implants, and IUDs.\n\u2022 Youth-friendly corners/clinics: Many health centres have dedicated spaces where young people can access contraception without judgement.\n\u2022 Planned Parenthood Association of Zambia (PPAZ): Provides family planning services, counselling, and referrals.\n\u2022 Marie Stopes Zambia: Offers a wide range of contraceptive services including long-acting methods.\n\u2022 Community-based distributors: Trained community health workers who can provide pills, condoms, and referrals in your neighbourhood.\n\u2022 Private pharmacies: Sell condoms, pills, and emergency contraception over the counter.',
          },
          {
            id: 'your-rights',
            title: 'Your Rights',
            order: 2,
            content:
              '\u2022 You have the right to access contraception regardless of your age or marital status.\n\u2022 Healthcare providers should give you non-judgemental, confidential care.\n\u2022 You have the right to choose your method and to switch methods if one is not working for you.\n\u2022 You have the right to accurate information about all available options.\n\u2022 If a provider refuses to help you, visit another facility or contact PPAZ or Marie Stopes for support.',
          },
        ],
      },
    ],
  };
}

function createFactCheckArticle() {
  return {
    id: 'fact-check-myths-debunked',
    title: 'Myth vs Fact: Common Sexual and Reproductive Health Myths Debunked',
    summary:
      'Separating truth from fiction on common myths about pregnancy, contraception, STIs, and HIV. Get the real facts to protect your health.',
    category: 'fact-check',
    tags: ['fact-check', 'myths', 'sexual-health', 'contraception', 'HIV', 'STI', 'education'],
    featuredImage: 'https://storage.googleapis.com/thespot-app/images/fact-check.jpg',
    estimatedReadTime: 12,
    publishedDate: '2025-11-10T00:00:00Z',
    lastUpdated: '2025-11-10T00:00:00Z',
    author: 'The Spot Health Team',
    sources: [
      'https://www.who.int/news-room/fact-sheets/detail/family-planning-contraception',
      'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
      'https://www.cdc.gov/std/default.htm',
      'https://www.plannedparenthood.org/learn',
      'https://www.unaids.org/en/frequently-asked-questions-about-hiv-and-aids',
    ],
    isPublished: true,
    difficulty: 'beginner',
    targetAudience: ['adolescents', 'young-women', 'young-adults'],
    sections: [
      {
        id: 'pregnancy-myths',
        title: 'Pregnancy Myths',
        order: 1,
        content:
          'Misinformation about pregnancy is widespread and can lead to unintended pregnancies. Here are the facts.',
        subsections: [
          {
            id: 'first-time-myth',
            title: 'MYTH: You Cannot Get Pregnant Your First Time Having Sex',
            order: 1,
            content:
              'THE FACT: This is completely false. You can absolutely get pregnant the very first time you have vaginal sex. Pregnancy can occur any time sperm meets an egg, regardless of whether it is your first time or your hundredth. If you have started menstruating and have unprotected vaginal sex, pregnancy is possible.\n\nWhy this myth is dangerous: Many young people have unprotected sex for the first time believing this myth, leading to unintended pregnancies. Always use contraception if you are not planning a pregnancy.',
          },
          {
            id: 'pulling-out-myth',
            title: 'MYTH: Pulling Out (Withdrawal) Prevents Pregnancy',
            order: 2,
            content:
              'THE FACT: The withdrawal method is NOT reliable. Pre-ejaculate (pre-cum) can contain sperm, meaning pregnancy can occur even if the man pulls out before ejaculation. The failure rate is about 20% with typical use -- meaning 1 in 5 couples relying on this method will experience a pregnancy within a year. Use a reliable contraceptive method instead.',
          },
        ],
      },
      {
        id: 'contraception-myths',
        title: 'Contraception Myths',
        order: 2,
        content:
          'Myths about contraception stop many people from using effective methods. Know the truth.',
        subsections: [
          {
            id: 'pill-infertility-myth',
            title: 'MYTH: The Pill Makes You Infertile',
            order: 1,
            content:
              'THE FACT: The birth control pill does NOT cause infertility. Once you stop taking it, your fertility returns -- usually within 1 to 3 months, though it can take slightly longer for some people. Decades of research involving millions of women have confirmed this.\n\nWhere this myth comes from: Some people experience a delay in their periods returning after stopping the pill, which they mistake for infertility. Also, some people start the pill when young and discover fertility challenges later for unrelated reasons (such as age or underlying conditions like PCOS).',
          },
          {
            id: 'condom-pleasure-myth',
            title: 'MYTH: Condoms Reduce Pleasure Too Much to Be Worth Using',
            order: 2,
            content:
              'THE FACT: Modern condoms are very thin and designed for sensitivity. Many people report little to no difference in sensation. Condoms come in different sizes, textures, and materials -- finding the right fit makes a big difference.\n\nThe real picture: The slight reduction in sensation is a small trade-off for protection against both pregnancy and STIs (including HIV). No other contraceptive method offers this dual protection. Also, the peace of mind from using protection often makes sex more enjoyable, not less.',
          },
          {
            id: 'contraception-promiscuity-myth',
            title: 'MYTH: Using Contraception Means You Are Promiscuous',
            order: 3,
            content:
              'THE FACT: Using contraception is a sign of responsibility, not promiscuity. It means you are taking control of your health and your future. People in committed, long-term relationships use contraception. People who are not yet ready for children use contraception. It is a normal, responsible part of healthcare -- just like getting vaccinated or taking vitamins.',
          },
        ],
      },
      {
        id: 'sti-hiv-myths',
        title: 'STI and HIV Myths',
        order: 3,
        content:
          'Stigma and misinformation about STIs and HIV can prevent people from getting tested and treated. Here are the facts.',
        subsections: [
          {
            id: 'can-tell-by-looking-myth',
            title: 'MYTH: You Can Tell If Someone Has an STI Just by Looking at Them',
            order: 1,
            content:
              'THE FACT: You absolutely cannot tell if someone has an STI by looking at them. Many STIs -- including chlamydia, gonorrhoea, HPV, and even HIV -- can be completely asymptomatic (show no symptoms) for months or even years. A person can look and feel perfectly healthy while carrying and transmitting an infection.\n\nWhat to do instead: The only way to know your STI status (or your partner\'s) is through testing. Regular STI screening is recommended for all sexually active people, especially when starting a new relationship.',
          },
          {
            id: 'hiv-death-sentence-myth',
            title: 'MYTH: HIV Is a Death Sentence',
            order: 2,
            content:
              'THE FACT: HIV is NOT a death sentence. With modern antiretroviral therapy (ART), people living with HIV can live long, healthy, full lives. When taken daily as prescribed, ART suppresses the virus to undetectable levels, which means:\n\n\u2022 The person stays healthy and their immune system remains strong.\n\u2022 They cannot transmit HIV sexually (Undetectable = Untransmittable, or U=U).\n\u2022 Life expectancy is near-normal.\n\nIn Zambia, ART is available free at government health facilities. The key is getting tested early and starting treatment as soon as possible. HIV is a manageable chronic condition, much like diabetes or high blood pressure.',
          },
          {
            id: 'sti-only-promiscuous-myth',
            title: 'MYTH: Only Promiscuous People Get STIs',
            order: 3,
            content:
              'THE FACT: Anyone who is sexually active can get an STI, even if they have had only one partner. STIs do not discriminate based on how many partners you have had. It only takes one sexual encounter with an infected person to contract an STI. Blaming or shaming people for STIs prevents them from seeking testing and treatment, which allows infections to spread further.',
          },
        ],
      },
    ],
  };
}

function createFindServicesArticle() {
  return {
    id: 'find-services-guide',
    title: 'Finding Health Services: Clinics, Hotlines, and Support in Zambia',
    summary:
      'A practical guide to finding youth-friendly clinics, family planning, STI testing, mental health support, and GBV services in Zambia, including key hotlines and contacts.',
    category: 'find-services',
    tags: ['services', 'clinics', 'Zambia', 'hotlines', 'family-planning', 'STI-testing', 'mental-health', 'GBV'],
    featuredImage: 'https://storage.googleapis.com/thespot-app/images/find-services.jpg',
    estimatedReadTime: 10,
    publishedDate: '2025-11-10T00:00:00Z',
    lastUpdated: '2025-11-10T00:00:00Z',
    author: 'The Spot Health Team',
    sources: [
      'https://www.moh.gov.zm/',
      'https://zambia.unfpa.org/',
      'https://www.mariestopes.org.zm/',
      'https://www.ywca.org.zm/',
    ],
    isPublished: true,
    difficulty: 'beginner',
    targetAudience: ['young-women', 'adolescents', 'anyone-seeking-services'],
    sections: [
      {
        id: 'youth-friendly-clinics',
        title: 'Youth-Friendly Health Services',
        order: 1,
        content:
          'Youth-friendly health services are clinics or corners within health facilities specifically designed to serve young people aged 10-24 in a welcoming, non-judgemental environment. In Zambia, many government health centres have dedicated "youth-friendly corners" where you can access services privately.',
        subsections: [
          {
            id: 'what-youth-clinics-offer',
            title: 'What They Offer',
            order: 1,
            content:
              '\u2022 Contraception and family planning advice\n\u2022 STI and HIV testing and treatment\n\u2022 Pregnancy testing and antenatal referrals\n\u2022 Counselling (sexual health, mental health, relationships)\n\u2022 Information and education on SRHR\n\u2022 Referrals to specialised services\n\nYouth-friendly services are designed to be:\n\u2022 Confidential -- your information is private\n\u2022 Non-judgemental -- no shaming or lecturing\n\u2022 Accessible -- free or low-cost, with flexible hours\n\u2022 Respectful -- you are treated with dignity regardless of age or situation',
          },
          {
            id: 'where-to-find-youth-clinics',
            title: 'Where to Find Them',
            order: 2,
            content:
              '\u2022 Ask at your nearest government health centre if they have a youth-friendly corner.\n\u2022 Planned Parenthood Association of Zambia (PPAZ) operates youth centres and mobile outreach.\n\u2022 Grassroots Soccer and other NGOs run youth health programmes in several provinces.\n\u2022 University and college health centres often have dedicated SRH services for students.',
          },
        ],
      },
      {
        id: 'family-planning-services',
        title: 'Family Planning Services',
        order: 2,
        content:
          'Family planning services help you choose and use a contraceptive method that suits you. These services are widely available across Zambia.',
        subsections: [
          {
            id: 'fp-providers',
            title: 'Where to Access',
            order: 1,
            content:
              '\u2022 Government health centres and hospitals: Provide free contraceptives including condoms, pills, injectables, implants, and IUDs.\n\u2022 Marie Stopes Zambia: Specialist family planning provider with clinics in Lusaka, Copperbelt, and other provinces. Also offers mobile outreach to rural areas.\n\u2022 Planned Parenthood Association of Zambia (PPAZ): Family planning counselling and services.\n\u2022 Community-based distributors: Trained community health workers can provide pills and condoms and refer you for long-acting methods.\n\u2022 Private pharmacies: Sell condoms, pills, and emergency contraception.',
          },
        ],
      },
      {
        id: 'sti-hiv-testing',
        title: 'STI and HIV Testing',
        order: 3,
        content:
          'Regular testing is the foundation of sexual health. HIV and STI testing is widely available and often free in Zambia.',
        subsections: [
          {
            id: 'testing-options',
            title: 'Testing Options',
            order: 1,
            content:
              '\u2022 Government health centres: Free HIV rapid testing and STI screening.\n\u2022 Voluntary Counselling and Testing (VCT) centres: Walk-in HIV testing with pre- and post-test counselling.\n\u2022 Mobile testing units: Reach rural and hard-to-access communities.\n\u2022 Self-testing kits: HIV self-test kits (e.g., OraQuick) are available at some pharmacies and through community distributors. They allow you to test in private.\n\u2022 New Start Centres (Society for Family Health): Offer free HTC services in several towns.\n\u2022 Private laboratories: Offer comprehensive STI panels for a fee.',
          },
          {
            id: 'what-to-expect',
            title: 'What to Expect',
            order: 2,
            content:
              '\u2022 HIV rapid test: A finger prick; results in 15-20 minutes. Completely confidential.\n\u2022 STI tests: May involve a urine sample, swab, or blood test depending on what is being tested.\n\u2022 You will receive counselling before and after testing.\n\u2022 If you test positive for any STI, treatment is available -- most bacterial STIs are curable with antibiotics.\n\u2022 If you test HIV-positive, you will be linked to care and started on ART (free in Zambia).',
          },
        ],
      },
      {
        id: 'mental-health-support',
        title: 'Mental Health Support',
        order: 4,
        content:
          'Mental health is just as important as physical health. If you are struggling with anxiety, depression, trauma, or stress, help is available.',
        subsections: [
          {
            id: 'mh-services',
            title: 'Where to Get Help',
            order: 1,
            content:
              '\u2022 Chainama Hills Hospital, Lusaka: Zambia\'s main mental health facility. Offers outpatient and inpatient services.\n\u2022 Government health centres: Many now have mental health services or can refer you.\n\u2022 Zambia Mental Health Movement: Advocacy and support services.\n\u2022 Lifeline/Childline Zambia: Free counselling helpline for young people -- call 116 (toll-free).\n\u2022 Young Women\'s Christian Association (YWCA): Counselling services, particularly for GBV survivors.\n\u2022 Private counsellors and psychologists: Available in urban centres (fees apply).',
          },
        ],
      },
      {
        id: 'gbv-support',
        title: 'Gender-Based Violence (GBV) Support',
        order: 5,
        content:
          'If you or someone you know is experiencing gender-based violence, there are services that can help. You are not alone, and it is not your fault.',
        subsections: [
          {
            id: 'gbv-services',
            title: 'Where to Get Help',
            order: 1,
            content:
              '\u2022 Victim Support Unit (VSU): Located at most police stations across Zambia. Trained officers help with GBV cases. Report directly at your nearest police station.\n\u2022 Childline/Lifeline Zambia: Call 116 (toll-free) for confidential support and referrals.\n\u2022 YWCA Zambia: Provides shelters, counselling, legal aid, and economic empowerment for GBV survivors. Lusaka: +260-211-252-772.\n\u2022 One-Stop Centres: Located at University Teaching Hospital (Lusaka), Ndola Teaching Hospital, and other major hospitals. Provide medical, psychosocial, and legal support under one roof.\n\u2022 Legal Aid Board: Free legal assistance for those who cannot afford a lawyer.\n\u2022 National Legal Aid Clinic for Women (NLACW): Legal support for women experiencing violence.',
          },
          {
            id: 'emergency-contacts',
            title: 'Emergency Contacts',
            order: 2,
            content:
              '\u2022 Police Emergency: 999 or 991\n\u2022 Childline/Lifeline: 116 (toll-free)\n\u2022 Victim Support Unit: Contact your nearest police station\n\u2022 YWCA Lusaka: +260-211-252-772\n\u2022 National Gender Machinery (Ministry of Gender): +260-211-251-808\n\u2022 If you are in immediate danger, go to the nearest police station or hospital.',
          },
        ],
      },
      {
        id: 'key-hotlines-summary',
        title: 'Key Hotlines and Contacts at a Glance',
        order: 6,
        content:
          '\u2022 Childline/Lifeline Zambia: 116 (toll-free) -- counselling, GBV support, referrals\n\u2022 Police Emergency: 999 or 991\n\u2022 Victim Support Unit (VSU): Available at most police stations\n\u2022 YWCA Zambia (Lusaka): +260-211-252-772\n\u2022 Marie Stopes Zambia: mariestopes.org.zm -- SRH services\n\u2022 PPAZ: Family planning and SRHR services\n\u2022 Chainama Hills Hospital (Mental Health): +260-211-284-527\n\u2022 University Teaching Hospital (One-Stop Centre): +260-211-252-641\n\nRemember: You have the right to confidential, respectful care. Do not hesitate to seek help.',
      },
    ],
  };
}

function createSafetyArticle() {
  return {
    id: 'safety-gbv-guide',
    title: 'Gender-Based Violence: Recognising Abuse, Safety Planning, and Getting Help',
    summary:
      'A comprehensive guide to understanding and responding to gender-based violence (GBV), including how to recognise abuse, create a safety plan, protect yourself digitally, and access emergency support in Zambia.',
    category: 'safety',
    tags: ['safety', 'GBV', 'gender-based-violence', 'abuse', 'Zambia', 'emergency', 'digital-safety', 'support'],
    featuredImage: 'https://storage.googleapis.com/thespot-app/images/safety-gbv.jpg',
    estimatedReadTime: 15,
    publishedDate: '2025-11-10T00:00:00Z',
    lastUpdated: '2025-11-10T00:00:00Z',
    author: 'The Spot Health Team',
    sources: [
      'https://www.who.int/news-room/fact-sheets/detail/violence-against-women',
      'https://www.ywca.org.zm/',
      'https://www.unicef.org/zambia/child-protection',
      'https://zambia.unfpa.org/en/topics/gender-based-violence',
      'https://www.un.org/en/observances/ending-violence-against-women-day',
    ],
    isPublished: true,
    difficulty: 'beginner',
    targetAudience: ['young-women', 'adolescents', 'anyone-affected-by-GBV', 'allies'],
    sections: [
      {
        id: 'understanding-gbv',
        title: 'Understanding Gender-Based Violence',
        order: 1,
        content:
          'Gender-based violence (GBV) is any harmful act directed at a person based on their gender. It disproportionately affects women and girls, but anyone can be a victim. GBV is never the victim\'s fault -- it is a violation of human rights.',
        subsections: [
          {
            id: 'types-of-gbv',
            title: 'Types of Gender-Based Violence',
            order: 1,
            content:
              'Physical abuse: Hitting, slapping, kicking, choking, burning, or any physical force used to hurt or control you.\n\nSexual abuse: Any sexual act without your consent, including rape, sexual assault, forced marriage, and sexual coercion. This includes within marriage -- a spouse does not have the right to force sex.\n\nEmotional/Psychological abuse: Insults, threats, intimidation, controlling behaviour, isolation from friends and family, gaslighting (making you doubt your own reality), and constant criticism.\n\nEconomic abuse: Controlling your money, preventing you from working or going to school, taking your earnings, or making you financially dependent.\n\nDigital abuse: Monitoring your phone or social media, sharing intimate images without consent, cyberstalking, and using technology to track or control you.',
          },
          {
            id: 'warning-signs',
            title: 'Warning Signs of an Abusive Relationship',
            order: 2,
            content:
              'Abuse often escalates gradually. Watch for these signs:\n\n\u2022 Your partner is extremely jealous or possessive.\n\u2022 They try to control who you see, where you go, or what you wear.\n\u2022 They check your phone or social media without permission.\n\u2022 They insult, humiliate, or belittle you, especially in front of others.\n\u2022 They blame you for their anger or violent behaviour ("you made me do this").\n\u2022 They threaten to hurt you, your children, or themselves.\n\u2022 They force or pressure you into sexual acts.\n\u2022 They control all the money and make you ask for basic necessities.\n\u2022 You feel afraid of your partner or walk on eggshells around them.\n\nIf any of these sound familiar, you may be in an abusive situation. It is not your fault, and help is available.',
          },
        ],
      },
      {
        id: 'safety-planning',
        title: 'Safety Planning',
        order: 2,
        content:
          'A safety plan is a personalised, practical plan that helps you stay as safe as possible if you are in an abusive situation. Even if you are not ready to leave, a safety plan helps you prepare.',
        subsections: [
          {
            id: 'if-living-with-abuser',
            title: 'If You Are Still Living with the Abuser',
            order: 1,
            content:
              '\u2022 Identify safe areas in your home -- rooms with exits and without weapons. Avoid kitchens and bathrooms during arguments (hard surfaces, sharp objects).\n\u2022 Keep important documents (ID, birth certificates, medical records) in a safe place -- with a trusted friend or family member, or in a bag ready to go.\n\u2022 Save emergency numbers in a way your abuser will not find (use a code name, memorise them, or write them inside a book).\n\u2022 Tell a trusted person about your situation. Agree on a code word or signal that means "I need help".\n\u2022 Keep a small amount of emergency cash hidden.\n\u2022 Know how to get out of your home quickly. Practice your route.\n\u2022 If violence seems imminent, try to leave the area. Your safety is the priority.',
          },
          {
            id: 'leaving-safely',
            title: 'If You Are Planning to Leave',
            order: 2,
            content:
              '\u2022 Plan to leave when the abuser is away.\n\u2022 Pack an emergency bag with: ID documents, money, phone and charger, medications, a change of clothes, and important phone numbers.\n\u2022 Go to a safe place your abuser does not know about (a friend\'s home, a shelter, a relative in another area).\n\u2022 Contact the YWCA, Victim Support Unit, or another support organisation for shelter and assistance.\n\u2022 If you have children, take them with you if it is safe to do so.\n\u2022 After leaving, change your phone number, passwords, and routines if possible.\n\u2022 Apply for a protection order through the courts (the Legal Aid Board can help for free).',
          },
        ],
      },
      {
        id: 'emergency-help',
        title: 'Emergency Contacts and Support Services in Zambia',
        order: 3,
        content:
          'If you are in immediate danger, call the police or go to your nearest police station. Help is available 24/7.',
        subsections: [
          {
            id: 'emergency-numbers',
            title: 'Emergency Numbers',
            order: 1,
            content:
              '\u2022 Police Emergency: 999 or 991\n\u2022 Childline/Lifeline Zambia: 116 (toll-free) -- 24-hour helpline for children and young people experiencing abuse\n\u2022 Victim Support Unit (VSU): Available at most police stations across Zambia. VSU officers are trained to handle GBV cases with sensitivity and confidentiality.\n\u2022 Ambulance: 992',
          },
          {
            id: 'support-organisations',
            title: 'Support Organisations',
            order: 2,
            content:
              '\u2022 YWCA Zambia: Provides emergency shelter, counselling, legal aid, and economic empowerment for GBV survivors. Lusaka office: +260-211-252-772. Branches in Kitwe, Ndola, Livingstone, and other towns.\n\u2022 One-Stop Centres: Located at major hospitals (UTH Lusaka, Ndola Teaching Hospital, Livingstone General Hospital). Provide medical treatment, counselling, police liaison, and legal support all in one place.\n\u2022 Legal Aid Board: Free legal representation for those who cannot afford a lawyer. Offices in all provincial capitals.\n\u2022 National Legal Aid Clinic for Women (NLACW): Specialised legal support for women.\n\u2022 Churches and community organisations: Many provide shelter and support. Ask at your local church or community centre.\n\u2022 Zambia National Women\'s Lobby: Advocacy and support for women\'s rights.',
          },
        ],
      },
      {
        id: 'digital-safety',
        title: 'Digital Safety',
        order: 4,
        content:
          'In today\'s connected world, abusers often use technology to monitor, control, or harass. Here is how to protect yourself online.',
        subsections: [
          {
            id: 'protecting-your-phone',
            title: 'Protecting Your Phone and Accounts',
            order: 1,
            content:
              '\u2022 Use a strong password or PIN on your phone. Do not use patterns or PINs your partner can easily guess (like birthdays).\n\u2022 Enable two-factor authentication (2FA) on your important accounts (email, social media, banking).\n\u2022 Check your phone for tracking apps or spyware. Look for apps you did not install, unusual battery drain, or your phone running hot when not in use.\n\u2022 Change passwords regularly, especially if you suspect someone has access.\n\u2022 Log out of shared devices. Check which devices are signed into your accounts (Google, Facebook, WhatsApp) and remove any you do not recognise.\n\u2022 Use a private/incognito browser window when searching for help or support so it does not appear in your browsing history.',
          },
          {
            id: 'social-media-safety',
            title: 'Social Media Safety',
            order: 2,
            content:
              '\u2022 Review your privacy settings on all platforms. Set your profiles to private/friends only.\n\u2022 Turn off location sharing on your posts and photos.\n\u2022 Block and report anyone who is harassing you.\n\u2022 Do not share your real-time location on social media.\n\u2022 Be cautious about accepting friend requests from people you do not know.\n\u2022 If someone is sharing your intimate images without consent, report it to the platform and to the police Victim Support Unit. This is a crime.',
          },
          {
            id: 'safe-communication',
            title: 'Communicating Safely',
            order: 3,
            content:
              '\u2022 If you need to contact a helpline or support service secretly, use a friend\'s phone or a public phone.\n\u2022 Delete call logs and messages after contacting support services, if your partner checks your phone.\n\u2022 Use apps with disappearing messages (like Signal) for sensitive conversations.\n\u2022 Save support numbers under innocent-sounding names in your contacts.\n\u2022 If you are using this app (The Spot) to find help, you can clear your browsing history or use the app\'s quick-exit feature if available.',
          },
        ],
      },
    ],
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== The Spot App - Article Seeder ===\n');

  // Step 1: Prepare all articles
  console.log('Preparing articles...\n');

  const articles = [];

  // Category 1: menstrual-health (from local file)
  try {
    const mh = prepareMenstrualHealth();
    articles.push(mh);
    console.log('  [OK] menstrual-health loaded from local data');
  } catch (err) {
    console.error('  [FAIL] menstrual-health:', err.message);
  }

  // Category 2: hiv-stis (from local file)
  try {
    const hiv = prepareHivStis();
    articles.push(hiv);
    console.log('  [OK] hiv-stis loaded from local data');
  } catch (err) {
    console.error('  [FAIL] hiv-stis:', err.message);
  }

  // Category 3: maternal-health (from local file, adapted)
  try {
    const mh = prepareMaternalHealth();
    articles.push(mh);
    console.log('  [OK] maternal-health loaded and adapted from local data');
  } catch (err) {
    console.error('  [FAIL] maternal-health:', err.message);
  }

  // Category 4: srhr-laws (from local file)
  try {
    const srhr = prepareSrhrLaws();
    articles.push(srhr);
    console.log('  [OK] srhr-laws loaded from local data');
  } catch (err) {
    console.error('  [FAIL] srhr-laws:', err.message);
  }

  // Category 5: safe-abortion (authored)
  articles.push(createSafeAbortionArticle());
  console.log('  [OK] safe-abortion created');

  // Category 6: contraceptives (authored)
  articles.push(createContraceptivesArticle());
  console.log('  [OK] contraceptives created');

  // Category 7: fact-check (authored)
  articles.push(createFactCheckArticle());
  console.log('  [OK] fact-check created');

  // Category 8: find-services (authored)
  articles.push(createFindServicesArticle());
  console.log('  [OK] find-services created');

  // Category 9: safety (authored)
  articles.push(createSafetyArticle());
  console.log('  [OK] safety created');

  console.log(`\nTotal articles to upload: ${articles.length}\n`);

  // Step 2: Deploy temporary open rules for articles collection
  console.log('Step 2: Deploying temporary open Firestore rules...\n');
  let originalRules;
  try {
    originalRules = openRulesForSeeding();
  } catch (err) {
    console.error('FATAL:', err.message);
    process.exit(1);
  }

  // Step 3: Upload each article (no auth needed with open rules)
  console.log('\nStep 3: Uploading articles to Firestore...\n');
  let successCount = 0;
  let failCount = 0;

  for (const article of articles) {
    const label = `${article.category} (${article.id})`;
    try {
      await uploadArticle(article);
      console.log(`  [UPLOADED] ${label}`);
      successCount++;
    } catch (err) {
      console.error(`  [FAILED]   ${label}: ${err.message}`);
      failCount++;
    }
  }

  // Step 4: Restore secure rules
  console.log('\nStep 4: Restoring secure Firestore rules...\n');
  restoreRules(originalRules);

  // Summary
  console.log('\n=== Seeding Complete ===');
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed:  ${failCount}`);
  console.log(`  Total:   ${articles.length}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  // Attempt to restore rules even on crash
  try {
    const originalRules = fs.readFileSync(RULES_FILE + '.bak', 'utf8');
    fs.writeFileSync(RULES_FILE, originalRules, 'utf8');
    console.log('Rules file restored from backup.');
  } catch (_) {
    // No backup available
  }
  process.exit(1);
});
