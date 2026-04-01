import { SpotColors } from '@/constants/Colors';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface OnboardingPagerProps {
  children: React.ReactNode[];
  backgroundColor?: string;
  textColor?: string;
}

// Define step colors
const stepColors = [
  { backgroundColor: SpotColors.primary, textColor: SpotColors.textOnPrimary },
  { backgroundColor: SpotColors.secondary, textColor: SpotColors.textOnSecondary },
  { backgroundColor: SpotColors.accent, textColor: SpotColors.textOnAccent },
];

export function OnboardingPager({
  children,
  backgroundColor = SpotColors.primary,
  textColor = SpotColors.textOnPrimary,
}: OnboardingPagerProps) {
  const { width } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();

  const totalPages = children.length;
  const isLastPage = currentPage === totalPages - 1;

  // Get current step colors
  const currentStepColors = stepColors[currentPage] || stepColors[0];

  const handleNext = () => {
    if (isLastPage) {
      handleFinish();
    } else {
      const nextPage = currentPage + 1;
      scrollRef.current?.scrollTo({ x: nextPage * width, animated: true });
      setCurrentPage(nextPage);
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    try {
      await completeOnboarding();
    } catch {
      // Even if persistence fails, proceed to auth
    }
    router.replace('/(auth)/sign-in');
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / width);
    if (page !== currentPage && page >= 0 && page < totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentStepColors.backgroundColor }]}>
      <View style={styles.header}>
        <Pressable onPress={handleSkip} style={({ pressed }) => [styles.skipButton, pressed && { opacity: 0.6 }]}>
          <Text style={[styles.skipText, { color: currentStepColors.textColor }]}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {children.map((child, index) => (
          <View key={index} style={[styles.page, { width }]}>
            {child}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {Array.from({ length: totalPages }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: currentPage === index 
                    ? currentStepColors.textColor 
                    : `${currentStepColors.textColor}40`,
                },
              ]}
            />
          ))}
        </View>

        <Pressable 
          onPress={handleNext} 
          style={({ pressed }) => [
            styles.nextButton, 
            { 
              borderColor: currentStepColors.textColor,
              backgroundColor: currentStepColors.textColor + '10'
            },
            pressed && { opacity: 0.6 }
          ]}
        >
          <Text style={[styles.nextText, { color: currentStepColors.textColor }]}>
            {isLastPage ? 'Get Started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    zIndex: 10,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  nextButton: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    minWidth: 140,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 