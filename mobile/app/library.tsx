import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  ListRenderItemInfo,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, FileBadge2, FileCheck2, Files, PackageOpen } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { BrandMark } from '@/components/BrandMark';
import { lightTheme } from '@/constants/mobile-theme';
import { formatClassificationCode, getPreferredClassificationCode } from '@/lib/classification-code';
import type { ClassificationRecord, LabelRecord } from '@/types/api';

const { colors, radius } = lightTheme;
const LIBRARY_SECTIONS: LibrarySection[] = ['classifications', 'labels', 'dossiers'];
const PAGE_SIZE = 20;

type LibrarySection = 'classifications' | 'labels' | 'dossiers';
type LibraryListItem =
  | { type: 'classification'; id: string; classification: ClassificationRecord }
  | { type: 'label'; id: string; label: LabelRecord }
  | { type: 'dossier'; id: string; classification: ClassificationRecord };

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const initialSection = normalizeSection(params.section);
  const [section, setSection] = useState<LibrarySection>(initialSection);
  const [openingLabelId, setOpeningLabelId] = useState<string | null>(null);
  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const indicatorProgress = useRef(
    new Animated.Value(LIBRARY_SECTIONS.indexOf(initialSection)),
  ).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;
  const hasMounted = useRef(false);

  const classificationsQuery = useInfiniteQuery({
    queryKey: ['classifications', 'library'],
    queryFn: ({ pageParam }) =>
      ApiClient.listClassifications({ limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
    enabled: section === 'classifications' || section === 'dossiers',
    staleTime: 30_000,
  });
  const labelsQuery = useInfiniteQuery({
    queryKey: ['labels', 'library'],
    queryFn: ({ pageParam }) => ApiClient.listLabels({ limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
    enabled: section === 'labels',
    staleTime: 30_000,
  });
  const classifications = useMemo(
    () => classificationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [classificationsQuery.data],
  );
  const labels = useMemo(
    () => labelsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [labelsQuery.data],
  );

  const dossiers = useMemo(
    () => classifications.filter((item) => Boolean(item.dossier?.id)),
    [classifications],
  );

  const activeQuery = section === 'labels' ? labelsQuery : classificationsQuery;
  const isRefreshing = activeQuery.isRefetching && !activeQuery.isFetchingNextPage;
  const isLoading =
    section === 'labels' ? labelsQuery.isLoading : classificationsQuery.isLoading;
  const hasError = section === 'labels' ? labelsQuery.isError : classificationsQuery.isError;
  const currentSectionIndex = LIBRARY_SECTIONS.indexOf(section);
  const segmentWidth = segmentedWidth > 8 ? (segmentedWidth - 8) / LIBRARY_SECTIONS.length : 0;
  const indicatorTranslateX =
    segmentWidth > 0
      ? indicatorProgress.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [0, segmentWidth, segmentWidth * 2],
        })
      : 0;

  useEffect(() => {
    Animated.timing(indicatorProgress, {
      toValue: currentSectionIndex,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    contentOpacity.setValue(0.82);
    contentTranslateY.setValue(8);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentTranslateY, currentSectionIndex, indicatorProgress]);

  const listData = useMemo<LibraryListItem[]>(() => {
    if (section === 'labels') {
      return labels.map((label) => ({ type: 'label', id: label.id, label }));
    }
    if (section === 'dossiers') {
      return dossiers.map((classification) => ({
        type: 'dossier',
        id: classification.id,
        classification,
      }));
    }
    return classifications.map((classification) => ({
      type: 'classification',
      id: classification.id,
      classification,
    }));
  }, [classifications, dossiers, labels, section]);

  const renderHeader = () => (
    <>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={18} />
          </Pressable>
          <Text style={styles.headerTitle}>Library</Text>
          <View style={styles.headerBrand}>
            <BrandMark size={30} />
          </View>
        </View>

        <Text style={styles.title}>Saved items</Text>

        <View
          style={styles.segmentedControl}
          onLayout={(event) => setSegmentedWidth(event.nativeEvent.layout.width)}
        >
          {segmentWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.segmentIndicator,
                {
                  width: segmentWidth,
                  transform: [{ translateX: indicatorTranslateX }],
                },
              ]}
            />
          ) : null}
          <SegmentButton
            label="Classifications"
            active={section === 'classifications'}
            onPress={() => setSection('classifications')}
          />
          <SegmentButton
            label="Labels"
            active={section === 'labels'}
            onPress={() => setSection('labels')}
          />
          <SegmentButton
            label="Dossiers"
            active={section === 'dossiers'}
            onPress={() => setSection('dossiers')}
          />
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard label="Classifications" value={classifications.length} />
          <SummaryCard label="Labels" value={labels.length} />
          <SummaryCard label="Dossiers" value={dossiers.length} />
        </View>
    </>
  );

  const renderItem = ({ item }: ListRenderItemInfo<LibraryListItem>) => {
    if (item.type === 'label') {
      const label = item.label;
      return (
        <LibraryRow
          icon={<FileBadge2 color={colors.text} size={18} />}
          title={getLabelProductName(label.labelData)}
          subtitle={getLabelSubtitle(label)}
          meta={label.complianceScore != null ? `${Math.round(label.complianceScore)}% score` : 'Saved label'}
          onPress={async () => {
            try {
              setOpeningLabelId(label.id);
              const exportUrls = await ApiClient.getLabelExport(label.id);
              router.push({
                pathname: '/preview',
                params: {
                  path: exportUrls.htmlUrl,
                  title: getLabelProductName(label.labelData),
                },
              });
            } catch (error) {
              Alert.alert(
                'Could not open label',
                error instanceof Error ? error.message : 'Please try again.',
              );
            } finally {
              setOpeningLabelId(null);
            }
          }}
          disabled={openingLabelId === label.id}
          trailing={
            openingLabelId === label.id ? <ActivityIndicator size="small" color={colors.primary} /> : undefined
          }
        />
      );
    }

    if (item.type === 'dossier') {
      const classification = item.classification;
      const thumbnailUrl = getProductThumbnailUrl(classification);
      return (
        <LibraryRow
          icon={<FileCheck2 color={colors.text} size={18} />}
          thumbnailUrl={thumbnailUrl}
          title={classification.product?.name ?? 'Untitled product'}
          subtitle={
            formatClassificationCode(
              getPreferredClassificationCode({
                cnCode: classification.cnCode,
                htsCode: classification.htsCode,
                hsCode: classification.hsCode,
              }),
            ) || 'Classification ready'
          }
          meta="Open dossier"
          onPress={() => router.push(`/classifications/${classification.id}/dossier` as never)}
        />
      );
    }

    const classification = item.classification;
    const thumbnailUrl = getProductThumbnailUrl(classification);
    return (
      <LibraryRow
        icon={<Files color={colors.text} size={18} />}
        thumbnailUrl={thumbnailUrl}
        title={classification.product?.name ?? 'Untitled product'}
        subtitle={
          formatClassificationCode(
            getPreferredClassificationCode({
              cnCode: classification.cnCode,
              htsCode: classification.htsCode,
              hsCode: classification.hsCode,
            }),
          ) || 'Classification pending'
        }
        meta={classification.dossier?.id ? 'Dossier ready' : classification.refinementQuestion ? 'Needs clarification' : 'Saved result'}
        onPress={() => router.push(`/classifications/${classification.id}` as never)}
      />
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (hasError) {
      return (
        <EmptyState
          title="Could not load this section"
          text={
            classificationsQuery.error instanceof Error
              ? classificationsQuery.error.message
              : labelsQuery.error instanceof Error
                ? labelsQuery.error.message
                : 'Please pull to refresh and try again.'
          }
        />
      );
    }
    if (section === 'labels') {
      return (
        <EmptyState
          title="No labels yet"
          text="Generate a label after classification and it will appear here."
        />
      );
    }
    if (section === 'dossiers') {
      return (
        <EmptyState
          title="No dossiers yet"
          text="Once a classification has a dossier, you can reopen it here."
        />
      );
    }
    return (
      <EmptyState
        title="No classifications yet"
        text="Run your first scan and the result will appear here."
      />
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Animated.View
        style={[
          styles.animatedShell,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
          },
        ]}
      >
        <FlatList
          data={listData}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            activeQuery.isFetchingNextPage ? (
              <View style={styles.centeredState}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!activeQuery.hasNextPage || activeQuery.isFetchingNextPage) return;
            void activeQuery.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void activeQuery.refetch()}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

function LibraryRow({
  icon,
  title,
  subtitle,
  meta,
  onPress,
  disabled,
  trailing,
  thumbnailUrl,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  meta: string;
  onPress: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
  thumbnailUrl?: string | null;
}) {
  return (
    <Pressable
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.rowIcon}>
        {thumbnailUrl ? <Image source={{ uri: thumbnailUrl }} style={styles.rowThumbnail} /> : icon}
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      {trailing ?? <ChevronRight color={colors.textMuted} size={18} />}
    </Pressable>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <PackageOpen color={colors.textMuted} size={24} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function normalizeSection(value?: string | string[]): LibrarySection {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === 'labels' || normalized === 'dossiers') return normalized;
  return 'classifications';
}

function getLabelProductName(labelData: unknown) {
  if (!labelData || typeof labelData !== 'object') return 'Generated label';
  const record = labelData as Record<string, unknown>;
  const productName = record.productName;

  if (typeof productName === 'string' && productName.trim().length > 0) {
    return productName.trim();
  }

  if (productName && typeof productName === 'object') {
    const nested = productName as Record<string, unknown>;
    if (typeof nested.original === 'string' && nested.original.trim().length > 0) {
      return nested.original.trim();
    }
    const translations =
      nested.translations && typeof nested.translations === 'object'
        ? Object.values(nested.translations as Record<string, unknown>)
        : [];
    const firstTranslation = translations.find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );
    if (typeof firstTranslation === 'string') {
      return firstTranslation.trim();
    }
  }

  return 'Generated label';
}

function getLabelSubtitle(label: LabelRecord) {
  const date = new Date(label.generatedAt);
  const formattedDate = Number.isNaN(date.getTime())
    ? 'Saved label'
    : date.toLocaleDateString();

  return `Generated ${formattedDate}`;
}

function getProductThumbnailUrl(classification: ClassificationRecord) {
  const images = classification.product?.images;
  if (!images?.length) return null;
  return images[0]?.signedUrl ?? null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 42,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
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
  iconSpacer: {
    width: 42,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerBrand: {
    width: 42,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 14,
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  segmentButtonActive: {
    backgroundColor: 'transparent',
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  centeredState: {
    paddingVertical: 34,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  rowDisabled: {
    opacity: 0.65,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  rowThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
