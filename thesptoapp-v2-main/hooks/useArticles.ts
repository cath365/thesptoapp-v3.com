import { db } from '@/lib/firebase';
import { getCached, setCache } from '@/lib/offlineCache';
import { Article, ArticleMetadata } from '@/types/Article';
import { collection, doc, DocumentData, DocumentSnapshot, getDoc, getDocs, limit, orderBy, query, Query, startAfter, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

const ARTICLES_CACHE_KEY = 'articles_list';

export function useArticles() {
  const [articles, setArticles] = useState<ArticleMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const fetchArticles = async (isLoadMore = false) => {
    try {
      setLoading(!isLoadMore);
      setIsOffline(false);

      let q: Query<DocumentData> = query(
        collection(db, 'articles'),
        where('isPublished', '==', true),
        orderBy('publishedDate', 'desc'),
        limit(10)
      );

      if (isLoadMore && lastDoc) {
        q = query(
          collection(db, 'articles'),
          where('isPublished', '==', true),
          orderBy('publishedDate', 'desc'),
          startAfter(lastDoc),
          limit(10)
        );
      }

      const snapshot = await getDocs(q);
      let newArticles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ArticleMetadata[];

      // Filter out scheduled articles with future dates
      const now = new Date();
      newArticles = newArticles.filter(a => {
        if (!a.publishedDate) return true;
        return new Date(a.publishedDate as any) <= now;
      });

      if (isLoadMore) {
        setArticles(prev => [...prev, ...newArticles]);
      } else {
        setArticles(newArticles);
        // Cache for offline use
        setCache(ARTICLES_CACHE_KEY, newArticles).catch(() => {});
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === 10);
      setError(null);
    } catch {
      // Try loading from cache when offline
      try {
        const cached = await getCached<ArticleMetadata[]>(ARTICLES_CACHE_KEY);
        if (cached && cached.length > 0) {
          setArticles(cached);
          setIsOffline(true);
          setError(null);
        } else {
          setError('Failed to fetch articles');
        }
      } catch {
        setError('Failed to fetch articles');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchArticles(true);
    }
  };

  return {
    articles,
    loading,
    error,
    hasMore,
    isOffline,
    loadMore,
    refetch: () => fetchArticles()
  };
}

export function useArticle(articleId: string) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'articles', articleId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Article;
          setArticle(data);
          // Cache for offline use
          setCache(`article_${articleId}`, data).catch(() => {});
        } else {
          setError('Article not found');
        }
      } catch {
        // Try loading from cache when offline
        try {
          const cached = await getCached<Article>(`article_${articleId}`);
          if (cached) {
            setArticle(cached);
            setError(null);
          } else {
            setError('Failed to fetch article');
          }
        } catch {
          setError('Failed to fetch article');
        }
      } finally {
        setLoading(false);
      }
    };

    if (articleId) {
      fetchArticle();
    }
  }, [articleId]);

  return { article, loading, error };
}

export function useArticleSearch(searchQuery: string, category?: string) {
  const [results, setResults] = useState<ArticleMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchArticles = async (queryText: string, cat?: string) => {
    try {
      setLoading(true);
      
      let q: Query<DocumentData> = query(
        collection(db, 'articles'),
        where('isPublished', '==', true),
        orderBy('publishedDate', 'desc'),
        limit(50)
      );

      if (cat) {
        q = query(
          collection(db, 'articles'),
          where('isPublished', '==', true),
          where('category', '==', cat),
          orderBy('publishedDate', 'desc'),
          limit(50)
        );
      }

      const snapshot = await getDocs(q);
      let articles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ArticleMetadata[];

      // Client-side filtering for text search (since Firestore has limited text search)
      if (queryText.trim()) {
        const searchLower = queryText.toLowerCase();
        articles = articles.filter(article =>
          (article.title ?? '').toLowerCase().includes(searchLower) ||
          (article.summary ?? '').toLowerCase().includes(searchLower) ||
          (article.tags && article.tags.some(tag => (tag ?? '').toLowerCase().includes(searchLower)))
        );
      }

      setResults(articles);
      setError(null);
    } catch {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim() || category) {
        searchArticles(searchQuery, category);
      } else {
        setResults([]);
      }
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery, category]);

  return { results, loading, error };
}

// Utility function to calculate estimated read time
export function calculateReadTime(content: string): number {
  const wordsPerMinute = 200; // Average reading speed
  const words = content.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
} 