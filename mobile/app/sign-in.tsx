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
import { ShieldCheck } from 'lucide-react-native';
import { useAuth } from '@/components/AuthProvider';

export default function SignInScreen() {
  const { user, isLoading, signInWithPassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const isDisabled = !identifier.trim() || !password || isSubmitting;

  const handleSubmit = async () => {
    if (isDisabled) return;

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

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <LinearGradient
            colors={['#11233C', '#0B4C57', '#082C33']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.badge}>
              <ShieldCheck color="#D9FFF7" size={16} />
              <Text style={styles.badgeText}>Secure workspace</Text>
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to open your mobile dashboard, products, scans, and dossier workflow.
            </Text>
          </LinearGradient>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Sign in</Text>
            <Text style={styles.formText}>
              Use your existing TulliCheck account. You can sign in with the same username or email you use on web.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username or email</Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="john or you@company.com"
                placeholderTextColor="#5F728E"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Enter your password"
                placeholderTextColor="#5F728E"
                style={styles.input}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.submitButton, isDisabled && styles.submitButtonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={isDisabled}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#06131A" />
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
    backgroundColor: '#07111E',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#07111E',
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
    gap: 18,
  },
  heroCard: {
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginBottom: 18,
  },
  badgeText: {
    color: '#E7FFFA',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: '#D4E6E9',
    fontSize: 15,
    lineHeight: 24,
  },
  formCard: {
    backgroundColor: '#0A1627',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 16,
  },
  formTitle: {
    color: '#F8FBFF',
    fontSize: 24,
    fontWeight: '800',
  },
  formText: {
    color: '#8C9AB0',
    fontSize: 14,
    lineHeight: 21,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: '#D7E1EF',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#07111E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: '#F8FBFF',
    fontSize: 15,
  },
  errorText: {
    color: '#F5A4A4',
    fontSize: 13,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#8DEBDA',
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: '#06131A',
    fontSize: 15,
    fontWeight: '800',
  },
});
