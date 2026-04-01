import { SpotColors } from '@/constants/Colors';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
    ViewStyle,
} from 'react-native';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
  renderRight?: () => React.ReactNode;
}

export function Input({ label, error, containerStyle, renderRight, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label} maxFontSizeMultiplier={1.3}>{label}</Text>
      <View style={{ position: 'relative' }}>
        <TextInput
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            error ? styles.inputError : null,
            renderRight ? { paddingRight: 44 } : null,
          ]}
          placeholderTextColor={SpotColors.textPrimary + '60'}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          maxFontSizeMultiplier={1.3}
          {...props}
        />
        {renderRight && (
          <View style={styles.rightIconContainer}>{renderRight()}</View>
        )}
      </View>
      {error && <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: SpotColors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: SpotColors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: SpotColors.textPrimary,
    backgroundColor: '#FFFFFF',
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputFocused: {
    borderColor: SpotColors.primary,
    borderWidth: 1.5,
    shadowColor: SpotColors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  inputError: {
    borderColor: SpotColors.error,
  },
  errorText: {
    color: SpotColors.error,
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
  },
  rightIconContainer: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: 36,
  },
}); 