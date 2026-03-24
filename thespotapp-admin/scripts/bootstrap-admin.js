/**
 * Bootstrap script: creates admin user doc + seeds sample articles and health tips.
 * Requires temporary open write rules. Run once, then restore secure rules.
 */
const https = require('https');

const PROJECT = 'spot-app-575e9';
const BASE = `/v1/projects/${PROJECT}/databases/(default)/documents`;
const ADMIN_UID = 'Yzutwcw9xAa1fYe19d8VlvIOpat2';
const NOW = new Date().toISOString();

// ── Admin user doc ──
const adminDoc = {
  fields: {
    email: { stringValue: 'sistahsistahfoundation101@gmail.com' },
    displayName: { stringValue: 'Admin' },
    role: { stringValue: 'admin' },
    createdAt: { timestampValue: NOW },
    lastLogin: { timestampValue: NOW }
  }
};

// ── Sample Articles ──
const articles = [
  {
    id: 'article_001',
    data: {
      title: { stringValue: 'Understanding Your Menstrual Cycle' },
      summary: { stringValue: 'A comprehensive guide to the four phases of your menstrual cycle and what happens in each one.' },
      content: { stringValue: '## The Four Phases of Your Cycle\n\nYour menstrual cycle is divided into four distinct phases:\n\n### 1. Menstruation (Days 1-5)\nThis is when your period happens. The uterine lining sheds, causing bleeding that typically lasts 3-7 days.\n\n### 2. Follicular Phase (Days 1-13)\nYour body prepares an egg for release. Estrogen levels rise, thickening the uterine lining.\n\n### 3. Ovulation (Day 14)\nA mature egg is released from the ovary. This is when you\'re most fertile.\n\n### 4. Luteal Phase (Days 15-28)\nThe body prepares for potential pregnancy. If the egg isn\'t fertilized, hormone levels drop and the cycle begins again.\n\n## Tips for Each Phase\n- **Menstruation:** Rest, stay hydrated, use heat for cramps\n- **Follicular:** Great time for exercise and new projects\n- **Ovulation:** Peak energy — good for social activities\n- **Luteal:** Practice self-care, eat balanced meals' },
      category: { stringValue: 'Menstrual Health' },
      author: { stringValue: 'The Spot App Team' },
      imageUrl: { stringValue: '' },
      published: { booleanValue: true },
      viewCount: { integerValue: '0' },
      createdAt: { timestampValue: NOW },
      updatedAt: { timestampValue: NOW }
    }
  },
  {
    id: 'article_002',
    data: {
      title: { stringValue: 'Sexual and Reproductive Health Rights in Africa' },
      summary: { stringValue: 'Know your rights: an overview of SRHR laws and access to healthcare services across the continent.' },
      content: { stringValue: '## Your Rights Matter\n\nSexual and Reproductive Health Rights (SRHR) are fundamental human rights recognized by international law.\n\n### Key Rights Include:\n- **Right to information:** Access accurate health information\n- **Right to healthcare:** Access quality reproductive healthcare services\n- **Right to decide:** Choose if, when, and how many children to have\n- **Right to privacy:** Confidential healthcare consultations\n- **Right to equality:** Non-discrimination in healthcare access\n\n### The Maputo Protocol\nThe Protocol to the African Charter on Human and Peoples\' Rights guarantees comprehensive rights for women, including reproductive health rights.\n\n### Accessing Services\nMany African countries provide free or subsidized:\n- Maternal healthcare\n- Family planning services\n- HIV/AIDS testing and treatment\n- Cervical cancer screening\n\n### Know Your Local Laws\nSRHR laws vary by country. Research your local policies and available services. Contact local health clinics for information about free services in your area.' },
      category: { stringValue: 'SRHR' },
      author: { stringValue: 'The Spot App Team' },
      imageUrl: { stringValue: '' },
      published: { booleanValue: true },
      viewCount: { integerValue: '0' },
      createdAt: { timestampValue: NOW },
      updatedAt: { timestampValue: NOW }
    }
  },
  {
    id: 'article_003',
    data: {
      title: { stringValue: 'Nutrition Guide for Women\'s Health' },
      summary: { stringValue: 'Essential nutrients every woman needs and the best food sources to support reproductive health.' },
      content: { stringValue: '## Essential Nutrients for Women\n\n### Iron\n**Why:** Prevents anaemia, especially important during menstruation\n**Sources:** Leafy greens (spinach, kale), beans, lean red meat, fortified cereals\n**Daily need:** 18mg for women 19-50\n\n### Folic Acid\n**Why:** Critical for reproductive health and prevents birth defects\n**Sources:** Dark leafy vegetables, citrus fruits, beans, fortified grains\n**Daily need:** 400mcg\n\n### Calcium\n**Why:** Builds strong bones, reduces PMS symptoms\n**Sources:** Dairy products, sardines, broccoli, almonds\n**Daily need:** 1000mg\n\n### Vitamin D\n**Why:** Helps absorb calcium, supports immune system\n**Sources:** Sunlight, fatty fish, eggs, fortified milk\n**Daily need:** 600 IU\n\n### Omega-3 Fatty Acids\n**Why:** Reduces menstrual pain, supports heart health\n**Sources:** Fatty fish (salmon, mackerel), walnuts, flaxseeds\n\n## Quick Meal Ideas\n- Spinach and bean stew with brown rice\n- Grilled fish with roasted vegetables\n- Fruit smoothie with yogurt and flaxseeds\n- Lentil soup with leafy greens' },
      category: { stringValue: 'Nutrition' },
      author: { stringValue: 'The Spot App Team' },
      imageUrl: { stringValue: '' },
      published: { booleanValue: true },
      viewCount: { integerValue: '0' },
      createdAt: { timestampValue: NOW },
      updatedAt: { timestampValue: NOW }
    }
  }
];

// ── Sample Health Tips ──
const healthTips = [
  {
    id: 'tip_001',
    data: {
      title: { stringValue: 'Stay Hydrated' },
      body: { stringValue: 'Drinking 6-8 glasses of water daily helps regulate your menstrual cycle, reduces cramps, and supports overall reproductive health.' },
      emoji: { stringValue: '💧' },
      category: { stringValue: 'General Wellness' },
      published: { booleanValue: true },
      createdAt: { timestampValue: NOW }
    }
  },
  {
    id: 'tip_002',
    data: {
      title: { stringValue: 'Eat Iron-Rich Foods' },
      body: { stringValue: 'Iron from leafy greens, beans, and lean meat replaces what you lose during menstruation and helps prevent anaemia.' },
      emoji: { stringValue: '🥗' },
      category: { stringValue: 'Nutrition' },
      published: { booleanValue: true },
      createdAt: { timestampValue: NOW }
    }
  },
  {
    id: 'tip_003',
    data: {
      title: { stringValue: 'Track Your Cycle' },
      body: { stringValue: 'Knowing your cycle helps you understand your body, predict your period, and identify any irregularities early.' },
      emoji: { stringValue: '📅' },
      category: { stringValue: 'Menstrual Health' },
      published: { booleanValue: true },
      createdAt: { timestampValue: NOW }
    }
  },
  {
    id: 'tip_004',
    data: {
      title: { stringValue: 'Exercise Regularly' },
      body: { stringValue: 'Regular physical activity reduces menstrual cramps, improves mood, and supports hormonal balance. Even a 30-minute walk helps!' },
      emoji: { stringValue: '🏃‍♀️' },
      category: { stringValue: 'Fitness' },
      published: { booleanValue: true },
      createdAt: { timestampValue: NOW }
    }
  },
  {
    id: 'tip_005',
    data: {
      title: { stringValue: 'Prioritize Sleep' },
      body: { stringValue: 'Getting 7-9 hours of quality sleep supports hormone regulation, immune function, and mental health.' },
      emoji: { stringValue: '😴' },
      category: { stringValue: 'General Wellness' },
      published: { booleanValue: true },
      createdAt: { timestampValue: NOW }
    }
  }
];

function writeDoc(collection, docId, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ fields: body.fields || body });
    const path = `${BASE}/${collection}/${docId}`;
    const opts = {
      hostname: 'firestore.googleapis.com',
      path,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(opts, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        const ok = res.statusCode === 200;
        console.log(`  ${ok ? '✅' : '❌'} ${collection}/${docId} — HTTP ${res.statusCode}`);
        resolve(ok);
      });
    });
    req.on('error', e => { console.log(`  ❌ ${collection}/${docId} — ${e.message}`); resolve(false); });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Bootstrap: Admin User + Sample Content ===\n');
  let ok = true;

  // 1. Admin user doc
  console.log('1. Creating admin user document...');
  if (!await writeDoc('users', ADMIN_UID, adminDoc)) ok = false;

  // 2. Articles
  console.log('\n2. Seeding sample articles...');
  for (const a of articles) {
    if (!await writeDoc('articles', a.id, { fields: a.data })) ok = false;
  }

  // 3. Health tips
  console.log('\n3. Seeding health tips...');
  for (const t of healthTips) {
    if (!await writeDoc('health_tips', t.id, { fields: t.data })) ok = false;
  }

  console.log('\n' + (ok ? '✅ ALL BOOTSTRAP DATA WRITTEN SUCCESSFULLY' : '❌ SOME WRITES FAILED'));
  
  if (ok) {
    console.log('\n📊 Summary:');
    console.log(`  • Admin user: sistahsistahfoundation101@gmail.com (role: admin)`);
    console.log(`  • Articles: ${articles.length} seeded`);
    console.log(`  • Health tips: ${healthTips.length} seeded`);
    console.log(`\n⚠️  NOW PASTE THE SECURE PRODUCTION RULES`);
  }
}

main();
