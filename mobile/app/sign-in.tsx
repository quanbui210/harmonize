import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { ArrowRight, Lock, Mail } from 'lucide-react-native';
import { useAuth } from '@/components/AuthProvider';
import { BrandMark } from '@/components/BrandMark';
import { lightTheme } from '@/constants/mobile-theme';

const { colors, radius } = lightTheme;

export default function SignInScreen() {
  const { user, isLoading, signInWithPassword, signInWithGoogle } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#8DEBDA" />
      </SafeAreaView>
    );
  }

  if (user) {
    return <Redirect href="/" />;
  }

  const passwordDisabled =
    !identifier.trim() || !password || isSubmitting || isGoogleSubmitting;
  const googleDisabled = isSubmitting || isGoogleSubmitting;

  const handleSubmit = async () => {
    if (passwordDisabled) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await signInWithPassword(identifier, password);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to sign in right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting || isGoogleSubmitting) return;

    try {
      setIsGoogleSubmitting(true);
      setError(null);
      await signInWithGoogle();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Unable to sign in with Google right now.';
      if (message.toLowerCase().includes('cancel')) {
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <LinearGradient
            colors={['#101E35', '#162A4A', '#132847']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.brandRow}>
              <BrandMark size={46} />
              <Text style={styles.appName}>TulliCheck</Text>
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue with product classification, labels, and dossiers.
            </Text>
          </LinearGradient>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Sign in</Text>
            <Text style={styles.formText}>
              Continue with Google or sign in with your existing username/email and password.
            </Text>

            <Pressable
              style={[styles.googleButton, googleDisabled && styles.googleButtonDisabled]}
              onPress={() => void handleGoogleSignIn()}
              disabled={googleDisabled}
            >
              {isGoogleSubmitting ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <View style={styles.googleBadge}>
                    <Text style={styles.googleBadgeText}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                  <ArrowRight color={colors.textMuted} size={16} />
                </>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or use password</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username or email</Text>
              <View style={styles.inputShell}>
                <Mail color={colors.textMuted} size={16} />
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="john or you@company.com"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputShell}>
                <Lock color={colors.textMuted} size={16} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.submitButton, passwordDisabled && styles.submitButtonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={passwordDisabled}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>Open dashboard</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: '#D4E6E9',
    fontSize: 13,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  formTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  formText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  googleButton: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleBadgeText: {
    color: '#DB4437',
    fontSize: 14,
    fontWeight: '800',
  },
  googleButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSoft,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  inputShell: {
    minHeight: 52,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
