import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FileBadge2, ScanSearch, ShieldCheck } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';
import { lightTheme } from '@/constants/mobile-theme';
import { formatClassificationCode, getPreferredClassificationCode } from '@/lib/classification-code';

const { colors, radius } = lightTheme;

export default function ScanHubScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => ApiClient.getDashboard(),
    enabled: !!user,
  });

  const overview = dashboardQuery.data;
  const latestClassificationId = overview?.actionItems?.[0]?.id
    ? String(overview.actionItems[0].id)
    : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={dashboardQuery.isRefetching}
            onRefresh={() => void dashboardQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Quick scan</Text>
          <Text style={styles.title}>Choose a scan flow.</Text>
          <Text style={styles.subtitle}>Classify a product, then generate label.</Text>
        </View>

        <IntentCard
          title="Classify product"
          description="Scan packaging and get a customs result."
          footer="Use for new products."
          dark
          onPress={() => router.push('/scan/classify')}
          icon={<ScanSearch color="#FFFFFF" size={20} />}
        />

        <IntentCard
          title="Generate EU label"
          description="Scan the current label, then complete required fields."
          footer="Use for market-ready labels."
          onPress={() => router.push('/scan/label')}
          icon={<FileBadge2 color={colors.text} size={20} />}
        />

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <ShieldCheck color={colors.success} size={18} />
            <Text style={styles.infoTitle}>After scan</Text>
          </View>
          <InfoLine text="Classification opens the result immediately." />
          <InfoLine text="Label flow pre-fills data. You confirm the final details." />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Continue recent work</Text>
          <Pressable onPress={() => router.push('/products')}>
            <Text style={styles.sectionAction}>History</Text>
          </Pressable>
        </View>

        <View style={styles.historyCard}>
          {dashboardQuery.isLoading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : overview?.actionItems?.length ? (
            overview.actionItems.slice(0, 3).map((item: any) => {
              const classificationId = item?.id ? String(item.id) : null;
              return (
                <Pressable
                  key={item.id}
                  style={styles.historyRow}
                  onPress={() => {
                    if (!classificationId) return;
                    router.push(`/classifications/${classificationId}` as never);
                  }}
                >
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyTitle}>{item.product?.name ?? 'Untitled product'}</Text>
                    <Text style={styles.historySubtitle}>
                      {formatClassificationCode(
                        getPreferredClassificationCode({
                          cnCode: item.cnCode,
                          htsCode: item.htsCode,
                          hsCode: item.hsCode,
                        }),
                      ) || 'Classification pending'}
                    </Text>
                  </View>
                  <ArrowRight color={colors.textMuted} size={18} />
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No scans yet</Text>
              <Text style={styles.emptyText}>
                Start with a classification scan and your first result will appear here.
              </Text>
            </View>
          )}
        </View>

        <Pressable
          style={styles.inlineLink}
          disabled={!latestClassificationId}
          onPress={() => {
            if (!latestClassificationId) return;
            router.push(`/classifications/${latestClassificationId}` as never);
          }}
        >
          <Text style={[styles.inlineLinkText, !latestClassificationId && styles.inlineLinkTextDisabled]}>
            {latestClassificationId ? 'Open latest classification result' : 'Run your first scan'}
          </Text>
          <ArrowRight color={latestClassificationId ? colors.text : colors.textMuted} size={16} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function IntentCard({
  title,
  description,
  footer,
  icon,
  dark,
  onPress,
}: {
  title: string;
  description: string;
  footer: string;
  icon: React.ReactNode;
  dark?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.intentCard, dark && styles.intentCardDark]} onPress={onPress}>
      <View style={[styles.intentIcon, dark && styles.intentIconDark]}>{icon}</View>
      <Text style={[styles.intentTitle, dark && styles.intentTitleDark]}>{title}</Text>
      <Text style={[styles.intentDescription, dark && styles.intentDescriptionDark]}>{description}</Text>
      <Text style={[styles.intentFooter, dark && styles.intentFooterDark]}>{footer}</Text>
    </Pressable>
  );
}

function InfoLine({ text }: { text: string }) {
  return (
    <View style={styles.infoLine}>
      <View style={styles.infoDot} />
      <Text style={styles.infoLineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  header: {
    marginTop: 6,
    marginBottom: 18,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  intentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 12,
  },
  intentCardDark: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  intentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  intentIconDark: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  intentTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  intentTitleDark: {
    color: '#FFFFFF',
  },
  intentDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  intentDescriptionDark: {
    color: 'rgba(255,255,255,0.78)',
  },
  intentFooter: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  intentFooterDark: {
    color: 'rgba(255,255,255,0.62)',
  },
  infoCard: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#CFEADB',
    padding: 18,
    marginBottom: 18,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  infoLine: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    backgroundColor: colors.success,
  },
  infoLineText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionAction: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  centeredState: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  historyCopy: {
    flex: 1,
  },
  historyTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  historySubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  inlineLink: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  inlineLinkText: {
    color: colors.text,
    fontWeight: '700',
  },
  inlineLinkTextDisabled: {
    color: colors.textMuted,
  },
});
