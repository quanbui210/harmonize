import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot, ChevronRight, CircleHelp, FileBadge2, FileCheck2, ShieldAlert, Trash2 } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { lightTheme } from '@/constants/mobile-theme';
import { formatClassificationCode, getPreferredClassificationCode } from '@/lib/classification-code';

const { colors, radius } = lightTheme;

export default function ClassificationDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const classificationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();

  const classificationQuery = useQuery({
    queryKey: ['classification', classificationId],
    queryFn: () => ApiClient.getClassification(classificationId),
    enabled: !!classificationId,
  });

  const classification = classificationQuery.data;
  const product = classification?.product;
  const resolvedCode = getPreferredClassificationCode({
    cnCode: classification?.cnCode,
    htsCode: classification?.htsCode,
    hsCode: classification?.hsCode,
  });
  const dutyRate = numberValue(classification?.dutySummary?.dutyRate);
  const vatRate = numberValue(classification?.dutySummary?.vatRate);
  const supplementaryUnit = stringValue(classification?.dutySummary?.supplementaryUnit);
  const composition = product?.materials?.length
    ? product.materials.map((item) => `${item.material} ${item.percentage}%`).join(', ')
    : 'No material composition captured yet.';
  const originCountry =
    stringValue(product?.metadata?.originCountry) ||
    stringValue(product?.metadata?.countryOfOrigin) ||
    'Not captured';
  const legalRationale =
    textFromUnknown(classification?.legalRationale) ||
    textFromUnknown(classification?.summary) ||
    'TulliCheck has not generated a detailed rationale for this classification yet.';
  const distinctions = normalizeDistinctions(classification?.distinctions);
  const keyFeatures = normalizeStringList(classification?.keyFeatures);
  const notes = textFromUnknown(classification?.notes);
  const deleteMutation = useMutation({
    mutationFn: () => ApiClient.deleteClassification(classificationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['classifications'] }),
      ]);
      router.replace('/scan');
    },
    onError: (error: Error) => {
      Alert.alert('Delete failed', error.message);
    },
  });

  const confirmDelete = () => {
    if (!classification) return;

    Alert.alert(
      'Delete classification',
      `Delete the classification for ${classification.product?.name ?? 'this product'}? This may also delete the product if it is the only saved classification.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: deleteMutation.isPending ? 'Deleting...' : 'Delete', style: 'destructive', onPress: () => void deleteMutation.mutate() },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={classificationQuery.isRefetching}
            onRefresh={() => void classificationQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={18} />
          </Pressable>
          <Text style={styles.brand}>TulliCheck</Text>
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              if (!classificationId) return;
              router.push(`/classifications/${classificationId}/dossier` as never);
            }}
          >
            <FileCheck2 color={colors.text} size={17} />
          </Pressable>
        </View>

        {classificationQuery.isLoading ? (
          <View style={styles.centeredCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centeredText}>Loading classification...</Text>
          </View>
        ) : classificationQuery.isError || !classification ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load classification</Text>
            <Text style={styles.errorText}>
              {classificationQuery.error instanceof Error
                ? classificationQuery.error.message
                : 'The classification detail request failed.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.heroMetaRow}>
              <View style={styles.badge}>
                <Bot color={colors.textSecondary} size={14} />
                <Text style={styles.badgeText}>
                  {classification.confidence && classification.confidence >= 0.7
                    ? 'AI suggested'
                    : 'Classification result'}
                </Text>
              </View>
              <Text style={styles.reference}>ID: {classification.id.slice(0, 8).toUpperCase()}</Text>
            </View>

            <Text style={styles.productName}>{product?.name ?? 'Untitled product'}</Text>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Proposed HS/CN code</Text>
              <Text style={styles.codeValue}>
                {formatClassificationCode(resolvedCode) || 'Still being checked'}
              </Text>
              <View style={styles.codeDivider} />
              <InfoLine
                label="Market"
                value={classification.market || product?.targetMarkets?.[0] || 'EU'}
              />
              <InfoLine label="Status" value={titleCase(classification.status)} />
              <InfoLine
                label="Match score"
                value={
                  classification.confidence != null
                    ? `${Math.round(classification.confidence * 100)}%`
                    : 'Not scored'
                }
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Estimated impact</Text>
              <MetricLine label="Third country duty" value={dutyRate != null ? `${dutyRate}%` : '-'} />
              <MetricLine label="Standard VAT" value={vatRate != null ? `${vatRate}%` : '-'} />
              <MetricLine label="Supplementary unit" value={supplementaryUnit || '-'} />
            </View>

            {classification.requiresReview || classification.refinementQuestion ? (
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <CircleHelp color={colors.primary} size={16} />
                  <Text style={styles.reviewTitle}>Clarification required</Text>
                </View>
                <Text style={styles.reviewQuestion}>
                  {classification.refinementQuestion ||
                    'This classification still needs analyst review before you rely on it for customs.'}
                </Text>
                <Text style={styles.reviewBody}>
                  Review the saved product details, ingredients, and product information before
                  trying again.
                </Text>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    if (!classification.productId) return;
                    router.push(`/products/${classification.productId}` as never);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Review saved product</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Product details</Text>
              <DetailsGrid
                items={[
                  { label: 'Destination market', value: classification.market || 'EU' },
                  { label: 'Country of origin', value: originCountry },
                  { label: 'End use', value: product?.intendedUse || 'Not captured' },
                  { label: 'Materials / composition', value: composition },
                ]}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>International codes</Text>
              <InfoLine label="HS code (international base)" value={formatClassificationCode(classification.hsCode) || '-'} />
              <InfoLine label="HTS code (USA)" value={formatClassificationCode(classification.htsCode) || '-'} />
              <InfoLine label="CN code (EU)" value={formatClassificationCode(classification.cnCode) || '-'} />
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Legal rationale</Text>
                {!classification.requiresReview ? (
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>Verified flow</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.bodyCopy}>{legalRationale}</Text>
              {distinctions.length ? (
                <>
                  <Text style={styles.subheading}>Distinctions</Text>
                  {distinctions.map((item, index) => (
                    <View key={`${item.heading}-${index}`} style={styles.distinctionCard}>
                      <Text style={styles.distinctionHeading}>{item.heading}</Text>
                      <Text style={styles.bodyCopy}>{item.reason}</Text>
                    </View>
                  ))}
                </>
              ) : null}
              {keyFeatures.length ? (
                <>
                  <Text style={styles.subheading}>Key features</Text>
                  {keyFeatures.map((item) => (
                    <BulletRow key={item} text={item} />
                  ))}
                </>
              ) : null}
              {notes ? (
                <>
                  <Text style={styles.subheading}>Notes</Text>
                  <Text style={styles.bodyCopy}>{notes}</Text>
                </>
              ) : null}
            </View>

            <View style={styles.primaryActions}>
              <Pressable
                style={styles.secondaryPrimaryButton}
                onPress={() => router.push(`/scan/label?classificationId=${classification.id}` as never)}
              >
                <FileBadge2 color={colors.text} size={16} />
                <Text style={styles.secondaryPrimaryButtonText}>Generate EU label</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => router.push(`/classifications/${classification.id}/dossier` as never)}
              >
                <Text style={styles.primaryButtonText}>Open dossier</Text>
                <ChevronRight color="#FFFFFF" size={16} />
              </Pressable>
            </View>

            {classification.requiresReview ? (
              <View style={styles.warningCard}>
                <ShieldAlert color={colors.warning} size={18} />
                <Text style={styles.warningText}>
                  This classification needs clarification before it should be treated as customs-ready.
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.deleteButton, deleteMutation.isPending && styles.deleteButtonDisabled]}
              onPress={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 color={colors.danger} size={16} />
              <Text style={styles.deleteButtonText}>
                {deleteMutation.isPending ? 'Deleting classification...' : 'Delete classification'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricLine}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function DetailsGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <View style={styles.detailsGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.detailItem}>
          <Text style={styles.detailLabel}>{item.label}</Text>
          <Text style={styles.detailValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function BulletRow({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bullet} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function textFromUnknown(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string' && item.trim().length > 0) return item;
      if (item && typeof item === 'object') {
        const label =
          textFromUnknown((item as Record<string, unknown>).label) ||
          textFromUnknown((item as Record<string, unknown>).name) ||
          textFromUnknown((item as Record<string, unknown>).title) ||
          textFromUnknown((item as Record<string, unknown>).reason);
        return label;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function normalizeDistinctions(value: unknown): Array<{ heading: string; reason: string }> {
  if (typeof value === "string" && value.trim().length > 0) {
    return [{ heading: 'Distinction', reason: value }];
  }

  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const heading =
        textFromUnknown(record.heading) ||
        textFromUnknown(record.title) ||
        'Distinction';
      const reason =
        textFromUnknown(record.reason) ||
        textFromUnknown(record.description) ||
        textFromUnknown(record.summary);

      if (!reason) return null;
      return { heading, reason };
    })
    .filter((item): item is { heading: string; reason: string } => Boolean(item));
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 48,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 18,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  brand: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  centeredCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  centeredText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    padding: 22,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  reference: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  productName: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  codeValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  codeDivider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: 14,
  },
  infoLine: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  metricLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  reviewCard: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.accentStrong,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  reviewQuestion: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  reviewBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  detailsGrid: {
    gap: 14,
  },
  detailItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    paddingBottom: 12,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 5,
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusPill: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 12,
  },
  bodyCopy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  distinctionCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  distinctionHeading: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  subheading: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryPrimaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
  },
  secondaryPrimaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  warningCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 14,
  },
  warningText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  deleteButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#F2C7CB',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
});
