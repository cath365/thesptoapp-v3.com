import { SpotColors } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    ViewStyle,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return [styles.button, styles.secondaryButton];
      case 'outline':
        return [styles.button, styles.outlineButton];
      default:
        return [styles.button, styles.primaryButton];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return [styles.buttonText, styles.secondaryButtonText];
      case 'outline':
        return [styles.buttonText, styles.outlineButtonText];
      default:
        return [styles.buttonText, styles.primaryButtonText];
    }
  };

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // iPad and some devices lack a Taptic Engine — silently ignore
      }
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        ...getButtonStyle(),
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'outline' ? SpotColors.primary : SpotColors.textOnPrimary} 
        />
      ) : (
        <Text style={[...getTextStyle(), textStyle]} maxFontSizeMultiplier={1.3}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButton: {
    backgroundColor: SpotColors.primary,
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  secondaryButton: {
    backgroundColor: SpotColors.secondary,
    shadowColor: SpotColors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  outlineButton: {
    backgroundColor: SpotColors.gradientLight,
    borderWidth: 1.5,
    borderColor: SpotColors.primary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  primaryButtonText: {
    color: SpotColors.textOnPrimary,
  },
  secondaryButtonText: {
    color: SpotColors.textOnSecondary,
  },
  outlineButtonText: {
    color: SpotColors.primary,
  },
}); 