import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, FileBadge2, FileCheck2, Files, PackageOpen } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { lightTheme } from '@/constants/mobile-theme';
import { formatClassificationCode, getPreferredClassificationCode } from '@/lib/classification-code';
import type { ClassificationRecord, LabelRecord } from '@/types/api';

const { colors, radius } = lightTheme;
const LIBRARY_SECTIONS: LibrarySection[] = ['classifications', 'labels', 'dossiers'];

type LibrarySection = 'classifications' | 'labels' | 'dossiers';

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

  const classificationsQuery = useQuery({
    queryKey: ['classifications', 'library'],
    queryFn: () => ApiClient.listClassifications(100),
  });
  const labelsQuery = useQuery({
    queryKey: ['labels', 'library'],
    queryFn: () => ApiClient.listLabels(100),
  });

  const dossiers = useMemo(
    () => (classificationsQuery.data ?? []).filter((item) => Boolean(item.dossier?.id)),
    [classificationsQuery.data],
  );

  const isRefreshing = classificationsQuery.isRefetching || labelsQuery.isRefetching;
  const isLoading =
    classificationsQuery.isLoading || (section === 'labels' && labelsQuery.isLoading);
  const hasError = classificationsQuery.isError || (section === 'labels' && labelsQuery.isError);
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

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void classificationsQuery.refetch();
              void labelsQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={18} />
          </Pressable>
          <Text style={styles.headerTitle}>Library</Text>
          <View style={styles.iconSpacer} />
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
          <SummaryCard label="Classifications" value={classificationsQuery.data?.length ?? 0} />
          <SummaryCard label="Labels" value={labelsQuery.data?.length ?? 0} />
          <SummaryCard label="Dossiers" value={dossiers.length} />
        </View>

        <Animated.View
          style={[
            styles.sectionCard,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          {isLoading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : hasError ? (
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
          ) : section === 'classifications' ? (
            <ClassificationSection items={classificationsQuery.data ?? []} />
          ) : section === 'labels' ? (
            <LabelsSection
              items={labelsQuery.data ?? []}
              openingLabelId={openingLabelId}
              onOpen={async (label) => {
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
            />
          ) : (
            <DossiersSection items={dossiers} />
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ClassificationSection({ items }: { items: ClassificationRecord[] }) {
  if (!items.length) {
    return (
      <EmptyState
        title="No classifications yet"
        text="Run your first scan and the result will appear here."
      />
    );
  }

  return (
    <>
      {items.map((item) => (
        <LibraryRow
          key={item.id}
          icon={<Files color={colors.text} size={18} />}
          title={item.product?.name ?? 'Untitled product'}
          subtitle={
            formatClassificationCode(
              getPreferredClassificationCode({
                cnCode: item.cnCode,
                htsCode: item.htsCode,
                hsCode: item.hsCode,
              }),
            ) || 'Classification pending'
          }
          meta={item.dossier?.id ? 'Dossier ready' : item.refinementQuestion ? 'Needs clarification' : 'Saved result'}
          onPress={() => router.push(`/classifications/${item.id}` as never)}
        />
      ))}
    </>
  );
}

function LabelsSection({
  items,
  openingLabelId,
  onOpen,
}: {
  items: LabelRecord[];
  openingLabelId: string | null;
  onOpen: (label: LabelRecord) => Promise<void>;
}) {
  if (!items.length) {
    return (
      <EmptyState
        title="No labels yet"
        text="Generate a label after classification and it will appear here."
      />
    );
  }

  return (
    <>
      {items.map((label) => (
        <LibraryRow
          key={label.id}
          icon={<FileBadge2 color={colors.text} size={18} />}
          title={getLabelProductName(label.labelData)}
          subtitle={getLabelSubtitle(label)}
          meta={label.complianceScore != null ? `${Math.round(label.complianceScore)}% score` : 'Saved label'}
          onPress={() => void onOpen(label)}
          disabled={openingLabelId === label.id}
          trailing={
            openingLabelId === label.id ? <ActivityIndicator size="small" color={colors.primary} /> : undefined
          }
        />
      ))}
    </>
  );
}

function DossiersSection({ items }: { items: ClassificationRecord[] }) {
  if (!items.length) {
    return (
      <EmptyState
        title="No dossiers yet"
        text="Once a classification has a dossier, you can reopen it here."
      />
    );
  }

  return (
    <>
      {items.map((item) => (
        <LibraryRow
          key={item.id}
          icon={<FileCheck2 color={colors.text} size={18} />}
          title={item.product?.name ?? 'Untitled product'}
          subtitle={
            formatClassificationCode(
              getPreferredClassificationCode({
                cnCode: item.cnCode,
                htsCode: item.htsCode,
                hsCode: item.hsCode,
              }),
            ) || 'Classification ready'
          }
          meta="Open dossier"
          onPress={() => router.push(`/classifications/${item.id}/dossier` as never)}
        />
      ))}
    </>
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
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  meta: string;
  onPress: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.rowIcon}>{icon}</View>
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
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 24,
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
    fontSize: 20,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
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
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
