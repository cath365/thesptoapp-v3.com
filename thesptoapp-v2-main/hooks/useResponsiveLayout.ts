import { Platform, useWindowDimensions } from 'react-native';

/**
 * Responsive layout hook — returns breakpoint flags and
 * adaptive values for phone vs tablet (iPad).
 */
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isLargeTablet = width >= 1024;
  const isLandscape = width > height;

  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    isLandscape,
    isPad: Platform.OS === 'ios' && isTablet,

    // Adaptive values
    contentMaxWidth: isLargeTablet ? 720 : isTablet ? 560 : undefined,
    horizontalPadding: isTablet ? 40 : 20,
    formMaxWidth: isTablet ? 480 : undefined,
    cardColumns: isTablet ? 2 : 1,
    iconSize: isTablet ? 32 : 28,
    heroHeight: isTablet
      ? Math.min(height * 0.3, 280)
      : Math.min(height * 0.35, 300),
  };
}
