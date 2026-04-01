import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

const LOCAL_BOOKMARKS_KEY = '@spotapp:bookmarks';

export interface BookmarkEntry {
  articleId: string;
  title?: string;
  summary?: string;
  category?: string;
  featuredImage?: string;
  estimatedReadTime?: number;
  savedAt: number; // epoch ms
}

/**
 * Manages article bookmarks.
 * - Authenticated users: real-time sync with Firestore `users/{uid}/bookmarks/{articleId}`
 * - Guest users: persisted in AsyncStorage
 */
export function useBookmarks() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Firestore listener for authenticated users ──
  useEffect(() => {
    if (!user) {
      // Load from local storage for guests
      loadLocalBookmarks();
      return;
    }

    setLoading(true);
    const colRef = collection(db, `users/${user.uid}/bookmarks`);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const entries: BookmarkEntry[] = snapshot.docs.map((d) => ({
          articleId: d.id,
          ...d.data(),
          savedAt: d.data().savedAt?.toMillis?.() ?? d.data().savedAt ?? Date.now(),
        })) as BookmarkEntry[];

        // Sort newest first
        entries.sort((a, b) => b.savedAt - a.savedAt);
        setBookmarks(entries);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // ── Local storage helpers ──
  const loadLocalBookmarks = async () => {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_BOOKMARKS_KEY);
      if (raw) {
        const entries: BookmarkEntry[] = JSON.parse(raw);
        entries.sort((a, b) => b.savedAt - a.savedAt);
        setBookmarks(entries);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const saveLocalBookmarks = async (entries: BookmarkEntry[]) => {
    try {
      await AsyncStorage.setItem(LOCAL_BOOKMARKS_KEY, JSON.stringify(entries));
    } catch { /* ignore */ }
  };

  // ── Public API ──
  const isBookmarked = useCallback(
    (articleId: string) => bookmarks.some((b) => b.articleId === articleId),
    [bookmarks]
  );

  const toggleBookmark = useCallback(
    async (articleId: string, meta?: Omit<BookmarkEntry, 'articleId' | 'savedAt'>) => {
      const alreadySaved = bookmarks.some((b) => b.articleId === articleId);

      if (user) {
        // Firestore path
        try {
          const docRef = doc(db, `users/${user.uid}/bookmarks`, articleId);
          if (alreadySaved) {
            await deleteDoc(docRef);
          } else {
            await setDoc(docRef, {
              articleId,
              ...meta,
              savedAt: serverTimestamp(),
            });
          }
        } catch {
          // Swallow Firestore errors — caller can handle via UI
        }
      } else {
        // AsyncStorage path
        let updated: BookmarkEntry[];
        if (alreadySaved) {
          updated = bookmarks.filter((b) => b.articleId !== articleId);
        } else {
          const entry: BookmarkEntry = {
            articleId,
            ...meta,
            savedAt: Date.now(),
          };
          updated = [entry, ...bookmarks];
        }
        setBookmarks(updated);
        await saveLocalBookmarks(updated);
      }
    },
    [bookmarks, user]
  );

  return { bookmarks, loading, isBookmarked, toggleBookmark };
}
