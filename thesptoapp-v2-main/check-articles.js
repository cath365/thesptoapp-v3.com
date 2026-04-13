const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyCsbVq08esnwhZHFwj9dcEjnAdCnpaSIs0',
  authDomain: 'spot-app-575e9.firebaseapp.com',
  projectId: 'spot-app-575e9',
  storageBucket: 'spot-app-575e9.firebasestorage.app',
});
const db = getFirestore(app);

async function check() {
  const snap = await getDocs(query(collection(db, 'articles'), limit(5)));
  snap.forEach((d) => {
    const a = d.data();
    console.log(JSON.stringify({
      id: d.id,
      category: a.category,
      hasSections: !!a.sections,
      sectionsLen: a.sections?.length,
      hasSources: !!a.sources,
      sourcesLen: a.sources?.length,
      hasTags: !!a.tags,
      tagsLen: a.tags?.length,
      difficulty: a.difficulty,
      readTime: a.estimatedReadTime,
      hasPublishedDate: !!a.publishedDate,
    }));
  });
  process.exit(0);
}

check().catch((e) => { console.error(e.message); process.exit(1); });
