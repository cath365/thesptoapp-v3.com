import { SpotColors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AppInitErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export default function AppInitErrorScreen({ message, onRetry }: AppInitErrorScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unable to Load App</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: SpotColors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: SpotColors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: SpotColors.textSecondary,
    marginBottom: 24,
    maxWidth: 460,
  },
  button: {
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: SpotColors.primary,
  },
  buttonText: {
    color: SpotColors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
