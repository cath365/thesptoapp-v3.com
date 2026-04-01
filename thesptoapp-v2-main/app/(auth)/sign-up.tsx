import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SpotColors } from '@/constants/Colors';
import { useAppState } from '@/hooks/useAppState';
import { useLanguage } from '@/hooks/useLanguage';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { checkConnectivity, signUp } from '@/lib/auth';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignUpScreen() {
  const router = useRouter();
  const { setGuestMode } = useAppState();
  const { t } = useLanguage();
  const { height: screenHeight } = useWindowDimensions();
  const { isTablet, formMaxWidth, horizontalPadding, heroHeight } = useResponsiveLayout();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Ref-based guard prevents double-fire even if state update is batched
  const signUpInFlight = useRef(false);

  const validateForm = () => {
    const newErrors: {
      displayName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};
    
    if (!displayName.trim()) {
      newErrors.displayName = 'Full name is required.';
    }
    
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
    
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;
    if (isLoading || signUpInFlight.current) return;
    
    signUpInFlight.current = true;
    setIsLoading(true);
    console.log('[SignUp] Attempt for:', email.trim());

    try {
      // Pre-flight connectivity check
      const online = await checkConnectivity();
      if (!online) {
        Alert.alert(
          'No Internet Connection',
          'Please check your network connection and try again.'
        );
        return;
      }

      const result = await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      
      if (result.error) {
        console.warn('[SignUp] Failed:', result.error);
        Alert.alert('Sign Up Failed', result.error);
      } else {
        console.log('[SignUp] Success, uid:', result.user?.uid);
      }
      // On success, Firebase auth state change will automatically navigate to home
    } catch (error: any) {
      console.error('[SignUp] Uncaught error:', error?.message || error, {
        platform: Platform.OS,
        isPad: (Platform as any).isPad,
        version: Platform.Version,
        stack: error?.stack?.slice?.(0, 300),
      });
      Alert.alert(
        'Sign Up Failed',
        'An unexpected error occurred. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
      signUpInFlight.current = false;
    }
  };

  const handleGoToSignIn = () => {
    router.push('/(auth)/sign-in');
  };

  const handleContinueAsGuest = async () => {
    try {
      await setGuestMode(true);
    } catch (error: any) {
      console.error('[SignUp] Guest mode error:', error?.message || error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top gradient hero section */}
      <LinearGradient
        colors={[SpotColors.primary, SpotColors.lavender, SpotColors.primaryLight] as any}
        style={[styles.heroGradient, { height: heroHeight }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Decorative floating circles */}
        <View style={styles.heroBubble1} />
        <View style={styles.heroBubble2} />
        <View style={styles.heroBubble3} />

        <SafeAreaView edges={['top']} style={styles.heroContent}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity onPress={handleGoToSignIn} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back to sign in">
              <Ionicons name="arrow-back" size={18} color={SpotColors.textOnPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleContinueAsGuest} style={styles.skipButton} accessibilityRole="button" accessibilityLabel="Skip sign up and continue as guest">
              <Text style={styles.skipText}>{t('auth.skip')}</Text>
              <Ionicons name="arrow-forward" size={16} color={SpotColors.textOnPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroTextContainer}>
            <View style={styles.logoCircle}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logoImage}
              />
            </View>
            <Text style={styles.appName}>{t('auth.joinTitle')}</Text>
            <Text style={styles.heroSubtitle}>{t('auth.joinSubtitle')}</Text>
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
            <Text style={styles.welcomeTitle}>{t('auth.createAccount')}</Text>
            <Text style={styles.welcomeSubtitle}>{t('auth.createSubtitle')}</Text>

            <View style={styles.inputGroup}>
              <Input
                label={t('auth.fullName')}
                value={displayName}
                onChangeText={setDisplayName}
                error={errors.displayName}
                autoComplete="name"
                placeholder="Jane Doe"
              />

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
                autoComplete="password-new"
                placeholder="Min. 6 characters"
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

              <Input
                label={t('auth.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoComplete="password-new"
                placeholder="Re-enter your password"
                renderRight={() => (
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword((v) => !v)}
                    accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={SpotColors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              />
            </View>

            <Button
              title={t('auth.createAccount')}
              onPress={handleSignUp}
              loading={isLoading}
              variant="secondary"
              style={styles.signUpButton}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity onPress={handleContinueAsGuest} style={styles.guestButton} accessibilityRole="button" accessibilityLabel="Continue as guest">
              <Ionicons name="person-outline" size={18} color={SpotColors.secondary} />
              <Text style={styles.guestButtonText}>{t('auth.continueGuest')}</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('auth.hasAccount')} </Text>
              <TouchableOpacity onPress={handleGoToSignIn} accessibilityRole="link" accessibilityLabel="Go to sign in">
                <Text style={styles.signInLink}>{t('auth.signIn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -15,
    left: -25,
  },
  heroBubble2: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: 80,
    right: -15,
  },
  heroBubble3: {
    position: 'absolute',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    bottom: 25,
    left: 70,
  },
  heroContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    gap: 4,
  },
  skipText: {
    color: SpotColors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  heroTextContainer: {
    alignItems: 'center',
    marginTop: 10,
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
  signUpButton: {
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
    color: SpotColors.secondary,
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
  signInLink: {
    fontSize: 14,
    color: SpotColors.secondary,
    fontWeight: '700',
  },
}); 