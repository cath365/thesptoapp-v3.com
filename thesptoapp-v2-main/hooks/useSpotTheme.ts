import { useColorScheme } from 'react-native';
import { SpotColors, SpotColorsDark } from '@/constants/SpotColors';

/**
 * Returns the appropriate color palette for the current system color scheme.
 * Falls back to light mode if the scheme is not detected.
 */
export function useSpotTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    colors: isDark ? SpotColorsDark : SpotColors,
    isDark,
  };
}
