import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAnnouncement, AnnouncementType } from '@/hooks/useAnnouncement';
import { SpotColors } from '@/constants/Colors';

const TYPE_CONFIG: Record<AnnouncementType, {
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  textColor: string;
  accentColor: string;
}> = {
  info: {
    gradient: [SpotColors.gradientCard, SpotColors.gradientLight],
    icon: 'megaphone-outline',
    iconColor: SpotColors.primary,
    iconBg: SpotColors.primaryLight,
    textColor: SpotColors.textPrimary,
    accentColor: SpotColors.primary,
  },
  warning: {
    gradient: ['#FFFDF5', SpotColors.warningLight],
    icon: 'alert-circle-outline',
    iconColor: SpotColors.warningDark,
    iconBg: SpotColors.warningLight,
    textColor: SpotColors.textPrimary,
    accentColor: SpotColors.warning,
  },
  success: {
    gradient: ['#F8FFF8', SpotColors.successLight],
    icon: 'checkmark-circle-outline',
    iconColor: SpotColors.success,
    iconBg: SpotColors.successLight,
    textColor: SpotColors.textPrimary,
    accentColor: SpotColors.success,
  },
  urgent: {
    gradient: ['#FFFBFC', SpotColors.softPink],
    icon: 'notifications-outline',
    iconColor: SpotColors.rose,
    iconBg: SpotColors.blush,
    textColor: SpotColors.textPrimary,
    accentColor: SpotColors.rose,
  },
};

export default function AnnouncementBanner() {
  const { announcement, dismiss } = useAnnouncement();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (announcement) {
      // Slide in + fade in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 60,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Start continuous pulse loop
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.4,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    }
    return () => {
      pulseAnim.stopAnimation();
    };
  }, [announcement, slideAnim, fadeAnim, pulseAnim]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => dismiss());
  };

  if (!announcement) return null;

  const config = TYPE_CONFIG[announcement.type] ?? TYPE_CONFIG.info;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY: slideAnim }],
          opacity: Animated.multiply(fadeAnim, pulseAnim),
        },
      ]}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={config.gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBg}
        />
        {/* Accent stripe */}
        <View style={[styles.accentStripe, { backgroundColor: config.accentColor }]} />

        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
          <Ionicons name={config.icon} size={20} color={config.iconColor} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.message, { color: config.textColor }]} numberOfLines={3}>
            {announcement.message}
          </Text>
        </View>

        {/* Dismiss */}
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <View style={styles.closeBtnInner}>
            <Ionicons name="close" size={14} color={SpotColors.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: SpotColors.surface,
    ...Platform.select({
      ios: {
        shadowColor: SpotColors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  gradientBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  accentStripe: {
    width: 4,
    alignSelf: 'stretch',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginVertical: 12,
  },
  content: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  message: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  closeBtn: {
    paddingRight: 14,
    paddingVertical: 14,
  },
  closeBtnInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
