import { SpotColors } from '@/constants/Colors';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isReloading: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isReloading: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, isReloading: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', {
      message: error?.message,
      stack: error?.stack,
      platform: Platform.OS,
      isPad: Platform.OS === 'ios' && (Platform as any).isPad,
      version: Platform.Version,
    });
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleRetry = () => {
    // Reset the React tree instead of calling Updates.reloadAsync().
    // reloadAsync reloads the exact same bundle, which causes an infinite
    // crash loop if the error is deterministic. Resetting the error state
    // re-mounts children, which often resolves transient render errors
    // (e.g. race conditions during the initial navigation).
    this.setState({ hasError: false, isReloading: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>🌸</Text>
          <Text style={styles.title}>Oops! Let's try that again</Text>
          <Text style={styles.message}>
            The Spot App hit a bump. This is usually temporary — tap below to reload.
          </Text>
          <TouchableOpacity
            style={[styles.button, this.state.isReloading ? styles.buttonDisabled : null]}
            onPress={this.handleRetry}
            disabled={this.state.isReloading}
          >
            <Text style={styles.buttonText}>
              {this.state.isReloading ? 'Reloading...' : 'Reload App'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            If this keeps happening, try closing and reopening the app.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: SpotColors.background,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: SpotColors.textPrimary,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: SpotColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: SpotColors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: SpotColors.textOnPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  hint: {
    fontSize: 13,
    color: SpotColors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
    opacity: 0.7,
  },
});
