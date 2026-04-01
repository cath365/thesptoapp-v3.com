import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StyleSheet, useColorScheme, View } from 'react-native';

export default function TabBarBackground() {
  const scheme = useColorScheme();
  const bg = scheme === 'dark' ? 'rgba(26,26,46,0.95)' : 'rgba(255,255,255,0.95)';

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: bg },
      ]}
    />
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
