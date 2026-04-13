const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Use default credentials from gcloud/firebase CLI
process.env.GOOGLE_CLOUD_PROJECT = 'spot-app-575e9';
initializeApp({ projectId: 'spot-app-575e9' });

const db = getFirestore();

async function fix() {
  const ids = ['article_001', 'article_002', 'article_003'];
  for (const id of ids) {
    await db.collection('articles').doc(id).update({
      isPublished: true,
      publishedDate: '2026-04-01T00:00:00.000Z'
    });
    console.log('Updated', id);
  }
  console.log('All articles fixed');
  process.exit(0);
}

fix().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
