import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from '@/locales/en.json';
import sw from '@/locales/sw.json';
import zu from '@/locales/zu.json';
import fr from '@/locales/fr.json';

const LANGUAGE_KEY = '@spotapp:language';

const resources = {
  en: { translation: en },
  sw: { translation: sw },
  zu: { translation: zu },
  fr: { translation: fr },
};

export const AVAILABLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'zu', label: 'isiZulu' },
  { code: 'fr', label: 'Français' },
] as const;

// Detect the device language or use saved preference
async function getInitialLanguage(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved && Object.keys(resources).includes(saved)) return saved;
  } catch {
    // ignore
  }

  try {
    const locales = getLocales();
    const deviceLang = locales[0]?.languageCode ?? 'en';
    if (Object.keys(resources).includes(deviceLang)) return deviceLang;
  } catch {
    // ignore
  }

  return 'en';
}

// Initialize i18n synchronously with English so components always have a working
// t() function on the very first render. If this runs after the component tree
// has already mounted (async init), useTranslation() would access an unset
// I18nextContext and throw — which the ErrorBoundary catches as "Something went
// wrong". Initializing synchronously prevents that race condition on fast devices
// (e.g. iPad Air M3) where the JS bundle executes before any Promise resolves.
// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources,
  lng: 'en', // safe default — updated below once AsyncStorage resolves
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

// Async: switch to the user's saved/device language once we know it
getInitialLanguage().then((lng) => {
  if (lng !== i18n.language) {
    // eslint-disable-next-line import/no-named-as-default-member
    i18n.changeLanguage(lng);
  }
}).catch(() => {});

export async function setAppLanguage(code: string): Promise<void> {
  try {
    // eslint-disable-next-line import/no-named-as-default-member
    await i18n.changeLanguage(code);
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    // Silently ignore — language will fallback to current
  }
}

export default i18n;
