import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/components/AuthProvider';
import { lightTheme } from '@/constants/mobile-theme';

const { colors } = lightTheme;

export default function AuthCallbackScreen() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.text}>Completing sign in...</Text>
      </View>
    );
  }

  if (user) {
    return <Redirect href="/" />;
  }

  return <Redirect href="/sign-in" />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
