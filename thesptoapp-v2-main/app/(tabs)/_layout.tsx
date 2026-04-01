import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors, SpotColors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLanguage } from '@/hooks/useLanguage';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useLanguage();
  const { iconSize } = useResponsiveLayout();
  const inactiveColor = Colors[colorScheme ?? 'light'].tabIconDefault;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: SpotColors.primary,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {
            backgroundColor: SpotColors.surface,
            borderTopWidth: 1,
            borderTopColor: SpotColors.border,
            elevation: 8,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons 
              size={iconSize} 
              name="favorite" 
              color={focused ? SpotColors.primary : inactiveColor} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="period-tracker"
        options={{
          title: t('tabs.period'),
          tabBarAccessibilityLabel: 'Period tracker tab',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons 
              size={iconSize} 
              name="local-florist" 
              color={focused ? SpotColors.rose : inactiveColor} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: t('tabs.journal'),
          tabBarAccessibilityLabel: 'Journal tab',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons 
              size={iconSize} 
              name="auto-stories" 
              color={focused ? SpotColors.primary : inactiveColor} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: t('tabs.library'),
          tabBarAccessibilityLabel: 'Library tab',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons
              size={iconSize}
              name="bookmark"
              color={focused ? SpotColors.lavender : inactiveColor}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarAccessibilityLabel: 'Profile tab',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons 
              size={iconSize} 
              name="face" 
              color={focused ? SpotColors.primary : inactiveColor} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
