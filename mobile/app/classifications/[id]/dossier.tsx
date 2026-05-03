import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, Share2, ShieldCheck } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { lightTheme } from '@/constants/mobile-theme';

const { colors, radius } = lightTheme;

export default function ClassificationDossierScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const classificationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();

  const classificationQuery = useQuery({
    queryKey: ['classification', classificationId],
    queryFn: () => ApiClient.getClassification(classificationId),
    enabled: !!classificationId,
  });

  const dossierQuery = useQuery({
    queryKey: ['classification', classificationId, 'dossier'],
    queryFn: () => ApiClient.getClassificationDossier(classificationId),
    enabled: !!classificationId,
  });

  const generateMutation = useMutation({
    mutationFn: () => ApiClient.generateDossier(classificationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['classification', classificationId] }),
        queryClient.invalidateQueries({ queryKey: ['classification', classificationId, 'dossier'] }),
        queryClient.invalidateQueries({ queryKey: ['classifications'] }),
      ]);
    },
    onError: (error: Error) => {
      Alert.alert('Unable to generate dossier', error.message);
    },
  });

  const dossier = dossierQuery.data?.dossier ?? null;
  const productName = classificationQuery.data?.product?.name ?? 'Classification dossier';
  const openPreview = () => {
    if (!dossier) return;

    router.push({
      pathname: '/preview',
      params: {
        path: `/api/dossier/${dossier.id}/preview`,
        title: 'Dossier preview',
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={classificationQuery.isRefetching || dossierQuery.isRefetching}
            onRefresh={() => {
              void classificationQuery.refetch();
              void dossierQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={18} />
          </Pressable>
          <Text style={styles.brand}>TulliCheck</Text>
          <View style={styles.placeholder} />
        </View>

        <Text style={styles.pageTitle}>Ready to Clear</Text>
        <Text style={styles.pageSubtitle}>
          Review the support file for {productName} before exporting it for customs, brokers,
          or forwarders.
        </Text>

        <Pressable
          style={[styles.previewCard, dossier && styles.previewCardInteractive]}
          onPress={dossier ? openPreview : undefined}
          disabled={!dossier}
        >
          <View style={styles.previewHeader}>
            <View style={styles.previewBadge}>
              <FileText color={colors.textSecondary} size={14} />
              <Text style={styles.previewBadgeText}>Defense dossier</Text>
            </View>
            <View
              style={[
                styles.verificationBadge,
                dossier ? styles.verificationBadgeReady : styles.verificationBadgePending,
              ]}
            >
              <Text
                style={[
                  styles.verificationText,
                  dossier ? styles.verificationTextReady : styles.verificationTextPending,
                ]}
              >
                {dossier ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>

          <View style={styles.previewFrame}>
            <ShieldCheck color={dossier ? colors.success : colors.textMuted} size={42} />
            <Text style={styles.previewFrameTitle}>
              {dossier ? 'Tap to open dossier' : 'Create dossier to view it'}
            </Text>
            <Text style={styles.previewFrameText}>
              {dossier
                ? 'Open and read the dossier here.'
                : 'After it is ready, tap here to open it.'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Included documents</Text>
          <ChecklistItem text="Customs code summary" />
          <ChecklistItem text="Why this result was chosen" />
          <ChecklistItem text="Product details" />
          {classificationQuery.data?.sources?.length ? <ChecklistItem text="Supporting references" /> : null}
        </View>

        {classificationQuery.isLoading || dossierQuery.isLoading ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Checking dossier...</Text>
          </View>
        ) : dossier ? (
          <>
            <Pressable
              style={styles.primaryButton}
              onPress={() => void openUrl(ApiClient.resolveUrl(dossier.pdfUrl))}
            >
              <Text style={styles.primaryButtonText}>Export PDF</Text>
              <ExternalLink color="#FFFFFF" size={16} />
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => void shareDossier(ApiClient.resolveUrl(dossier.exportUrl))}
            >
              <Share2 color={colors.text} size={16} />
              <Text style={styles.secondaryButtonText}>Share with forwarder</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.calloutCard}>
              <Text style={styles.calloutTitle}>No dossier yet</Text>
              <Text style={styles.calloutText}>
                Create the support file after you review the result and product details.
              </Text>
            </View>
            <Pressable
              style={styles.primaryButton}
              onPress={() => void generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              <Text style={styles.primaryButtonText}>
                {generateMutation.isPending ? 'Generating dossier...' : 'Generate dossier'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <View style={styles.checkItem}>
      <CheckCircle2 color={colors.text} size={18} />
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

async function openUrl(url: string) {
  await WebBrowser.openBrowserAsync(url);
}

async function shareDossier(url: string) {
  await Share.share({ message: url, url });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 44,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 18,
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
  brand: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 42,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    marginBottom: 8,
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 18,
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  previewCardInteractive: {
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  previewBadgeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  verificationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  verificationBadgeReady: {
    backgroundColor: colors.successSoft,
  },
  verificationBadgePending: {
    backgroundColor: colors.warningSoft,
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  verificationTextReady: {
    color: colors.success,
  },
  verificationTextPending: {
    color: colors.warning,
  },
  previewFrame: {
    height: 220,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  previewFrameTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
    textAlign: 'center',
  },
  previewFrameText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  checkText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  calloutCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 14,
  },
  calloutTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  calloutText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
});
