import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, RefreshCw } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { lightTheme } from '@/constants/mobile-theme';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';

const { colors, radius } = lightTheme;

export default function PreviewScreen() {
  const params = useLocalSearchParams<{ path?: string; title?: string }>();
  const { session } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewPath = getSingleParam(params.path);
  const title = getSingleParam(params.title) || 'Preview';

  const source = useMemo(() => {
    if (!previewPath) {
      return null;
    }

    return {
      uri: ApiClient.resolveUrl(previewPath),
      headers: session?.access_token
        ? {
            Authorization: `Bearer ${session.access_token}`,
          }
        : undefined,
    };
  }, [previewPath, session?.access_token]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <ArrowLeft color={colors.text} size={18} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          style={styles.iconButton}
          onPress={() => {
            setErrorMessage(null);
            setIsLoading(true);
            webViewRef.current?.reload();
          }}
        >
          <RefreshCw color={colors.text} size={18} />
        </Pressable>
      </View>

      {!previewPath ? (
        <EmptyState
          title="Unable to open"
          text="This page could not be opened."
        />
      ) : !session?.access_token ? (
        <EmptyState
          title="Sign in required"
          text="Please sign in again, then try opening this page once more."
        />
      ) : source ? (
        <View style={styles.viewerCard}>
          <WebView
            ref={webViewRef}
            source={source}
            style={styles.webview}
            sharedCookiesEnabled
            originWhitelist={['*']}
            startInLoadingState
            onLoadStart={() => {
              setErrorMessage(null);
              setIsLoading(true);
            }}
            onLoadEnd={() => {
              setIsLoading(false);
            }}
            onError={(event) => {
              setErrorMessage(event.nativeEvent.description || 'Could not open this page.');
              setIsLoading(false);
            }}
            onHttpError={(event) => {
              setErrorMessage(`Could not open this page. Please try again.`);
              setIsLoading(false);
            }}
            renderLoading={() => (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Opening document...</Text>
              </View>
            )}
          />

          {isLoading ? (
            <View pointerEvents="none" style={styles.loadingOverlay}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorTitle}>Unable to open</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  viewerCard: {
    flex: 1,
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.surface,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  errorBanner: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    flex: 1,
    margin: 18,
    padding: 24,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
