import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SpotColors } from '@/constants/Colors';
import { useAppState } from '@/hooks/useAppState';
import { useLanguage } from '@/hooks/useLanguage';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { sendPasswordReset, signIn } from '@/lib/auth';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignInScreen() {
  const router = useRouter();
  const { setGuestMode } = useAppState();
  const { t } = useLanguage();
  const { height: screenHeight } = useWindowDimensions();
  const { isTablet, formMaxWidth, horizontalPadding, heroHeight } = useResponsiveLayout();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Ref-based guard prevents double-fire even if state update is batched
  const loginInFlight = useRef(false);

  const handleContinueAsGuest = async () => {
    try {
      await setGuestMode(true);
    } catch (error: any) {
      console.error('[SignIn] Guest mode error:', error?.message || error);
    }
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address (e.g. user@example.com).';
    }
    
    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;
    // Double-tap guard: ref check + state check
    if (isLoading || loginInFlight.current) return;

    loginInFlight.current = true;
    setIsLoading(true);
    setErrors({});

    console.log('[SignIn] Login attempt for:', email.trim());

    try {
      const result = await signIn({ email: email.trim(), password });

      if (result.error) {
        console.warn('[SignIn] Login failed:', result.error);
        Alert.alert('Sign In Failed', result.error);
      } else {
        console.log('[SignIn] Login success, uid:', result.user?.uid);
        // Navigation is handled automatically by the root layout
        // when Firebase auth state changes to authenticated.
      }
    } catch (error: any) {
      console.error('[SignIn] Uncaught login error:', {
        message: error?.message,
        code: error?.code,
        platform: Platform.OS,
        isPad: Platform.OS === 'ios' && (Platform as any).isPad,
      });
      Alert.alert(
        'Sign In Failed',
        'An unexpected error occurred. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
      loginInFlight.current = false;
    }
  };

  const handleForgotPassword = () => {
    setResetEmail(email);
    setShowForgotModal(true);
  };

  const handleSendReset = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setIsResetting(true);
    try {
      const result = await sendPasswordReset(resetEmail.trim());
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        setShowForgotModal(false);
        Alert.alert(
          'Password Reset Email Sent',
          'Check your email for instructions to reset your password.'
        );
      }
    } catch (error: any) {
      console.error('[SignIn] Password reset error:', error?.message || error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleGoToSignUp = () => {
    router.push('/(auth)/sign-up');
  };

  return (
    <View style={styles.container}>
      {/* Top gradient hero section */}
      <LinearGradient
        colors={[SpotColors.primary, SpotColors.lavender, SpotColors.primaryLight]}
        style={[styles.heroGradient, { height: heroHeight }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Decorative floating circles */}
        <View style={styles.heroBubble1} />
        <View style={styles.heroBubble2} />
        <View style={styles.heroBubble3} />

        <SafeAreaView edges={['top']} style={styles.heroContent}>
          <TouchableOpacity onPress={handleContinueAsGuest} style={styles.skipButton} accessibilityRole="button" accessibilityLabel="Skip sign in and continue as guest">
            <Text style={styles.skipText}>{t('auth.skip')}</Text>
            <Ionicons name="arrow-forward" size={16} color={SpotColors.textOnPrimary} />
          </TouchableOpacity>

          <View style={styles.heroTextContainer}>
            <View style={styles.logoCircle}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logoImage}
              />
            </View>
            <Text style={styles.appName}>The Spot</Text>
            <Text style={styles.heroSubtitle}>Your personal health companion</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Form section */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formSection}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.formCard, formMaxWidth ? { maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
            <Text style={styles.welcomeTitle}>{t('auth.welcomeBack')}</Text>
            <Text style={styles.welcomeSubtitle}>{t('auth.signInSubtitle')}</Text>

            <View style={styles.inputGroup}>
              <Input
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com"
              />

              <Input
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                secureTextEntry={!showPassword}
                autoComplete="password"
                placeholder="Enter your password"
                renderRight={() => (
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={SpotColors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              />

              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword} accessibilityRole="button" accessibilityLabel="Forgot password">
                <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
              </TouchableOpacity>
            </View>

            <Button
              title={t('auth.signIn')}
              onPress={handleSignIn}
              loading={isLoading}
              disabled={isLoading}
              style={styles.signInButton}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity onPress={handleContinueAsGuest} style={styles.guestButton} accessibilityRole="button" accessibilityLabel="Continue as guest">
              <Ionicons name="person-outline" size={18} color={SpotColors.primary} />
              <Text style={styles.guestButtonText}>{t('auth.continueGuest')}</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('auth.noAccount')} </Text>
              <TouchableOpacity onPress={handleGoToSignUp} accessibilityRole="link" accessibilityLabel="Go to sign up">
                <Text style={styles.signUpLink}>{t('auth.signUp')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowForgotModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalIconRow}>
              <LinearGradient
                colors={[SpotColors.primary, SpotColors.primaryLight]}
                style={styles.modalIconCircle}
              >
                <Ionicons name="lock-open-outline" size={28} color={SpotColors.surface} />
              </LinearGradient>
            </View>
            <Text style={styles.modalTitle}>{t('auth.resetPassword')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('auth.resetSubtitle')}
            </Text>
            <TextInput
              style={styles.resetEmailInput}
              placeholder="you@example.com"
              placeholderTextColor={SpotColors.textPrimary + '60'}
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Button
              title={isResetting ? t('auth.sending') : t('auth.sendResetLink')}
              onPress={handleSendReset}
              loading={isResetting}
              style={styles.resetButton}
            />
            <TouchableOpacity
              onPress={() => setShowForgotModal(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SpotColors.background,
  },
  heroGradient: {
    width: '100%',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroBubble1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -20,
    right: -30,
  },
  heroBubble2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: 100,
    left: -20,
  },
  heroBubble3: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.12)',
    bottom: 30,
    right: 60,
  },
  heroContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    gap: 4,
    marginTop: 8,
  },
  skipText: {
    color: SpotColors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  heroTextContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: {
    width: 66,
    height: 66,
    borderRadius: 18,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: SpotColors.textOnPrimary,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginTop: 4,
  },
  formSection: {
    flex: 1,
    marginTop: -32,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: SpotColors.surface,
    borderRadius: 24,
    padding: 28,
    borderTopWidth: 2,
    borderTopColor: SpotColors.primaryLight,
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SpotColors.textPrimary,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: SpotColors.textSecondary,
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: SpotColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  signInButton: {
    borderRadius: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: SpotColors.border,
  },
  dividerText: {
    color: SpotColors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 16,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SpotColors.border,
    backgroundColor: 'rgba(198,159,213,0.08)',
    gap: 8,
  },
  guestButtonText: {
    color: SpotColors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: SpotColors.border,
  },
  footerText: {
    fontSize: 14,
    color: SpotColors.textSecondary,
  },
  signUpLink: {
    fontSize: 14,
    color: SpotColors.primary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: SpotColors.surface,
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 10,
  },
  modalIconRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: SpotColors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: SpotColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  resetEmailInput: {
    borderWidth: 1,
    borderColor: SpotColors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: SpotColors.textPrimary,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  resetButton: {
    borderRadius: 12,
    marginBottom: 12,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    color: SpotColors.textSecondary,
    fontWeight: '600',
  },
}); 