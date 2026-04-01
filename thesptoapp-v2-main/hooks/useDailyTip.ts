import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  DAILY_HEALTH_TIPS,
  LANGUAGE_LABELS,
  type HealthTip,
  type SupportedLanguage,
} from '@/data/daily_health_tips';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

const TIP_LANGUAGE_KEY = '@tip_language';

/**
 * Returns a different tip each day by using the day-of-year as an index.
 * Reads from Firestore `health_tips` collection if available, falls back to
 * hardcoded data. Persists the user's chosen language in AsyncStorage.
 */
export function useDailyTip() {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [tips, setTips] = useState<HealthTip[]>(DAILY_HEALTH_TIPS);

  useEffect(() => {
    // Load saved language preference
    AsyncStorage.getItem(TIP_LANGUAGE_KEY).then((saved) => {
      if (saved && saved in LANGUAGE_LABELS) {
        setLanguageState(saved as SupportedLanguage);
      }
    }).catch(() => {});

    // Fetch health tips from Firestore, fall back to hardcoded data
    const fetchTips = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'health_tips'));
        if (!snapshot.empty) {
          const firestoreTips: HealthTip[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: data.id ?? 0,
              emoji: data.emoji ?? '💡',
              translations: data.translations ?? {},
            } as HealthTip;
          });
          // Only use Firestore tips if they have valid translations for English
          const validTips = firestoreTips.filter(
            (t) => t.translations?.en?.title && t.translations?.en?.body
          );
          if (validTips.length > 0) {
            setTips(validTips);
          }
        }
      } catch {
        // Network error or Firestore unavailable — keep hardcoded tips
      } finally {
        setIsLoading(false);
      }
    };

    fetchTips();
  }, []);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    await AsyncStorage.setItem(TIP_LANGUAGE_KEY, lang);
  }, []);

  // Rotate based on day-of-year so the tip changes every day
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
  );
  const tipIndex = dayOfYear % tips.length;
  const tip: HealthTip = tips[tipIndex];

  const translated = tip.translations[language] ?? tip.translations['en'];

  return {
    tip,
    title: translated?.title ?? '',
    body: translated?.body ?? '',
    emoji: tip.emoji,
    language,
    setLanguage,
    isLoading,
    allLanguages: LANGUAGE_LABELS,
  };
}
