import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, FileCheck2, ScanSearch } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';
import { lightTheme } from '@/constants/mobile-theme';
import { formatClassificationCode, getPreferredClassificationCode } from '@/lib/classification-code';
import type { ClassificationRecord, CursorPaginatedResponse, ProductRecord } from '@/types/api';

const { colors, radius } = lightTheme;

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();

  const productQuery = useQuery({
    queryKey: ['product', productId],
    queryFn: () => ApiClient.getProduct(productId),
    enabled: !!user && !!productId,
    staleTime: 20_000,
  });

  const classificationsQuery = useQuery({
    queryKey: ['classifications', 'for-product', productId],
    queryFn: () => ApiClient.listClassifications({ limit: 100 }),
    enabled: !!user && !!productId,
    staleTime: 20_000,
  });

  const productClassifications = useMemo(
    () =>
      (classificationsQuery.data?.items ?? []).filter(
        (item) => item.productId === productId,
      )
        .slice()
        .sort((a: any, b: any) => {
          const left = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
          const right = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
          return left - right;
        }),
    [classificationsQuery.data, productId],
  );

  const latestClassification = productClassifications[0] ?? null;

  const classifyMutation = useMutation({
    mutationFn: () => ApiClient.classifyProduct(productId),
    onSuccess: async (response) => {
      const classification =
        response.result?.classification && typeof response.result.classification === 'object'
          ? (response.result.classification as ClassificationRecord)
          : null;

      if (classification) {
        queryClient.setQueryData(['classification', classification.id], classification);
        queryClient.setQueriesData(
          { queryKey: ['classifications'] },
          (current: unknown) =>
            replaceOrInsertClassificationInCollectionCache(current, classification),
        );
        queryClient.setQueriesData(
          { queryKey: ['classifications', 'for-product', productId] },
          (current: unknown) =>
            replaceOrInsertClassificationInCollectionCache(current, classification),
        );
        if (classification.product) {
          queryClient.setQueryData(['product', productId], classification.product);
          queryClient.setQueriesData(
            { queryKey: ['products'] },
            (current: unknown) =>
              replaceOrInsertProductInCollectionCache(
                current,
                classification.product as ProductRecord,
              ),
          );
        }
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['classifications'] }),
          queryClient.invalidateQueries({
            queryKey: ['classifications', 'for-product', productId],
          }),
          queryClient.invalidateQueries({ queryKey: ['product', productId] }),
        ]);
      }

      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert('Classification complete', 'A refreshed classification result is available for review.');
    },
    onError: (error: Error) => {
      Alert.alert('Classification failed', error.message);
    },
  });

  const isRefreshing = productQuery.isRefetching || classificationsQuery.isRefetching;

  if (authLoading || productQuery.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (productQuery.isError) {
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.errorCard}>
          <Text style={styles.emptyTitle}>Unable to load product</Text>
          <Text style={styles.emptyText}>
            {productQuery.error instanceof Error
              ? productQuery.error.message
              : 'The product request failed.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const product = productQuery.data;
  if (!product) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Product not found</Text>
      </SafeAreaView>
    );
  }

  const heroImage = product.images?.[0]?.signedUrl ?? null;

  const openClassification = () => {
    if (!latestClassification?.id) return;
    router.push(`/classifications/${latestClassification.id}` as never);
  };

  const handleClassify = () => {
    if (!latestClassification) {
      void classifyMutation.mutate();
      return;
    }

    Alert.alert(
      'Classification already exists',
      'Open the current result first, or re-run classification if the product data has changed.',
      [
        { text: 'Open current', onPress: openClassification },
        { text: 'Reclassify', style: 'destructive', onPress: () => void classifyMutation.mutate() },
        { text: 'Cancel', style: 'cancel' },
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
            refreshing={isRefreshing}
            onRefresh={() => {
              void productQuery.refetch();
              void classificationsQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={18} />
          </Pressable>
          <Text style={styles.brand}>TulliCheck</Text>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.push(`/products/${product.id}/scan` as never)}
          >
            <ScanSearch color={colors.text} size={17} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Saved product</Text>
          <Text style={styles.heroTitle}>{product.name}</Text>
          <Text style={styles.heroDescription}>{product.description}</Text>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderText}>Product photo will appear here.</Text>
            </View>
          )}
        </View>

        <View style={styles.actionGrid}>
          <ActionCard
            title="Add more photos"
            subtitle="Upload more package, label, or ingredient photos."
            onPress={() => router.push(`/products/${product.id}/scan` as never)}
            dark
          />
          <ActionCard
            title={
              latestClassification
                ? 'Open classification'
                : classifyMutation.isPending
                  ? 'Classifying...'
                  : 'Run classification'
            }
            subtitle={
              latestClassification
                ? 'Review the latest customs result.'
                : 'Get a customs code suggestion from this product.'
            }
            onPress={latestClassification ? openClassification : handleClassify}
          />
        </View>

        <View style={styles.metricRow}>
          <MetricCard label="Markets" value={String(product.targetMarkets?.length ?? 0)} />
          <MetricCard label="Materials" value={String(product.materials?.length ?? 0)} />
          <MetricCard label="Classifications" value={String(productClassifications.length)} />
        </View>

        <Section title="Latest classification">
          {classificationsQuery.isError ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoBody}>
                {classificationsQuery.error instanceof Error
                  ? classificationsQuery.error.message
                  : 'Unable to load classifications for this product.'}
              </Text>
            </View>
          ) : latestClassification ? (
            <View style={styles.classificationCard}>
              <View style={styles.classificationHeader}>
                <Text style={styles.classificationCode}>
                  {formatClassificationCode(
                    getPreferredClassificationCode({
                      cnCode: latestClassification.cnCode,
                      htsCode: latestClassification.htsCode,
                      hsCode: latestClassification.hsCode,
                    }),
                  ) || 'Pending code'}
                </Text>
                <ChevronRight color={colors.textMuted} size={18} />
              </View>
              <Text style={styles.classificationSummary}>
                {latestClassification.summary || 'Open the detail page to review why this code was suggested.'}
              </Text>
              <View style={styles.classificationMeta}>
                <Text style={styles.metaPill}>
                  {latestClassification.requiresReview ? 'Needs review' : 'Ready for review'}
                </Text>
                <Text style={styles.metaPill}>
                  {latestClassification.dossier?.id ? 'Dossier ready' : 'Dossier pending'}
                </Text>
              </View>
              <View style={styles.inlineButtonRow}>
                <Pressable style={styles.secondaryInlineButton} onPress={openClassification}>
                  <Text style={styles.secondaryInlineButtonText}>Open detail</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryInlineButton}
                  onPress={() => router.push(`/classifications/${latestClassification.id}/dossier` as never)}
                >
                  <FileCheck2 color="#FFFFFF" size={15} />
                  <Text style={styles.primaryInlineButtonText}>Open dossier</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoBody}>
                No result yet. Add more photos if needed, then run classification from this saved
                product.
              </Text>
              <Pressable style={styles.secondaryInlineButton} onPress={handleClassify}>
                <Text style={styles.secondaryInlineButtonText}>
                  {classifyMutation.isPending ? 'Classifying...' : 'Run classification'}
                </Text>
              </Pressable>
            </View>
          )}
        </Section>

        <Section title="Intended use">
          <View style={styles.infoCard}>
            <Text style={styles.infoBody}>{product.intendedUse || 'No intended use provided yet.'}</Text>
          </View>
        </Section>

        <Section title="Materials">
          {product.materials?.length ? (
            <View style={styles.infoCard}>
              {product.materials.map((material, index) => (
                <View key={`${material.material}-${index}`} style={styles.materialRow}>
                  <Text style={styles.materialName}>{material.material}</Text>
                  <Text style={styles.materialValue}>{material.percentage}%</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoBody}>No material composition has been captured yet.</Text>
            </View>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({
  title,
  subtitle,
  onPress,
  dark,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  dark?: boolean;
}) {
  return (
    <Pressable style={[styles.actionCard, dark && styles.actionCardDark]} onPress={onPress}>
      <Text style={[styles.actionCardTitle, dark && styles.actionCardTitleDark]}>{title}</Text>
      <Text style={[styles.actionCardSubtitle, dark && styles.actionCardSubtitleDark]}>{subtitle}</Text>
    </Pressable>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function replaceOrInsertClassificationInCollectionCache(
  cache: unknown,
  updated: ClassificationRecord,
) {
  if (!cache || typeof cache !== 'object') return cache;
  const value = cache as Record<string, unknown>;

  if (Array.isArray(value.pages)) {
    let found = false;
    const pages = (value.pages as unknown[]).map((page, index) => {
      if (!page || typeof page !== 'object') return page;
      const pageRecord = page as Record<string, unknown>;
      if (!Array.isArray(pageRecord.items)) return page;
      const mappedItems = (pageRecord.items as unknown[]).map((item) => {
        if (item && typeof item === 'object' && (item as ClassificationRecord).id === updated.id) {
          found = true;
          return updated;
        }
        return item;
      });
      if (!found && index === 0) {
        return { ...pageRecord, items: [updated, ...mappedItems] };
      }
      return { ...pageRecord, items: mappedItems };
    });
    return { ...value, pages } as InfiniteData<CursorPaginatedResponse<ClassificationRecord>>;
  }

  if (Array.isArray(value.items)) {
    const items = value.items as unknown[];
    const hasMatch = items.some(
      (item) => item && typeof item === 'object' && (item as ClassificationRecord).id === updated.id,
    );
    return {
      ...value,
      items: hasMatch
        ? items.map((item) =>
            item && typeof item === 'object' && (item as ClassificationRecord).id === updated.id
              ? updated
              : item,
          )
        : [updated, ...items],
    } as CursorPaginatedResponse<ClassificationRecord>;
  }

  return cache;
}

function replaceOrInsertProductInCollectionCache(cache: unknown, updated: ProductRecord) {
  if (!cache || typeof cache !== 'object') return cache;
  const value = cache as Record<string, unknown>;

  if (Array.isArray(value.pages)) {
    let found = false;
    const pages = (value.pages as unknown[]).map((page, index) => {
      if (!page || typeof page !== 'object') return page;
      const pageRecord = page as Record<string, unknown>;
      if (!Array.isArray(pageRecord.items)) return page;
      const mappedItems = (pageRecord.items as unknown[]).map((item) => {
        if (item && typeof item === 'object' && (item as ProductRecord).id === updated.id) {
          found = true;
          return { ...(item as ProductRecord), ...updated };
        }
        return item;
      });
      if (!found && index === 0) {
        return { ...pageRecord, items: [{ ...updated }, ...mappedItems] };
      }
      return { ...pageRecord, items: mappedItems };
    });
    return { ...value, pages } as InfiniteData<CursorPaginatedResponse<ProductRecord>>;
  }

  if (Array.isArray(value.items)) {
    const items = value.items as unknown[];
    const hasMatch = items.some(
      (item) => item && typeof item === 'object' && (item as ProductRecord).id === updated.id,
    );
    return {
      ...value,
      items: hasMatch
        ? items.map((item) =>
            item && typeof item === 'object' && (item as ProductRecord).id === updated.id
              ? { ...(item as ProductRecord), ...updated }
              : item,
          )
        : [{ ...updated }, ...items],
    } as CursorPaginatedResponse<ProductRecord>;
  }

  return cache;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 60,
  },
  headerRow: {
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: colors.accentStrong,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
  },
  heroEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  heroImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
  },
  heroPlaceholder: {
    height: 180,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  heroPlaceholderText: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    minHeight: 114,
  },
  actionCardDark: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  actionCardTitleDark: {
    color: '#FFFFFF',
  },
  actionCardSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  actionCardSubtitleDark: {
    color: 'rgba(255,255,255,0.72)',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
  },
  classificationCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
  },
  classificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  classificationCode: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  classificationSummary: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  classificationMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  inlineButtonRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaPill: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryInlineButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  primaryInlineButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryInlineButton: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryInlineButtonText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  infoBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  materialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  materialName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  materialValue: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 22,
    marginHorizontal: 18,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
});
