import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight, FileBadge2, LogOut, Package2, ScanSearch } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';
import { lightTheme } from '@/constants/mobile-theme';
import { formatClassificationCode, getPreferredClassificationCode } from '@/lib/classification-code';

const { colors, radius } = lightTheme;

export default function DashboardScreen() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => ApiClient.getMe(),
    enabled: !!user,
  });
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => ApiClient.getDashboard(),
    enabled: !!user,
  });

  const isRefreshing = dashboardQuery.isRefetching || meQuery.isRefetching;
  const overview = dashboardQuery.data;
  const topCards = useMemo(
    () => [
      {
        label: 'Active imports',
        value: overview?.activeImports?.length ?? 0,
        tone: colors.surface,
      },
      {
        label: 'Missing data',
        value: overview?.missingReasonings ?? 0,
        tone: colors.dangerSoft,
      },
    ],
    [overview],
  );

  if (authLoading || !user) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const firstActionItem = overview?.actionItems?.[0];
  const firstClassificationId = firstActionItem?.id ? String(firstActionItem.id) : null;
  const readiness = overview?.auditReadinessScore ?? 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void meQuery.refetch();
              void dashboardQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <View style={styles.brandRow}>
            <Text style={styles.brand}>TulliCheck</Text>
            <Text style={styles.workspace}>{meQuery.data?.organization.name ?? 'Workspace'}</Text>
          </View>
          <Pressable style={styles.signOutButton} onPress={() => router.push('/scan')}>
            <ScanSearch color={colors.text} size={16} />
          </Pressable>
        </View>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Audit readiness score</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreRing}>
              <Text style={styles.scoreValue}>{readiness}%</Text>
            </View>
            <View style={styles.scoreCopy}>
              <Bullet text={`${overview?.approvedCount ?? 0} verified items`} />
              <Bullet text={`${overview?.pendingCount ?? 0} items still need review`} danger />
              <Bullet text="Some checks still need attention." muted />
            </View>
          </View>
        </View>

        <View style={styles.primaryActionGrid}>
          <ActionTile
            title="Quick scan"
            description="Start with classification or original label capture."
            icon={<ScanSearch color="#FFFFFF" size={19} />}
            dark
            onPress={() => router.push('/scan')}
          />
          <ActionTile
            title="Saved history"
            description="Review saved products, photos, and earlier customs results."
            icon={<Package2 color={colors.text} size={19} />}
            onPress={() => router.push('/products')}
          />
        </View>

        <View style={styles.secondaryActionCard}>
          <View style={styles.secondaryActionCopy}>
            <Text style={styles.secondaryActionTitle}>Generate label after classification</Text>
            <Text style={styles.secondaryActionText}>
              Keep scan first: classify the product first, then open the EU label flow when you are
              ready to finish the missing details.
            </Text>
          </View>
          <Pressable style={styles.secondaryActionButton} onPress={() => router.push('/scan/label')}>
            <FileBadge2 color={colors.text} size={16} />
            <Text style={styles.secondaryActionButtonText}>Label flow</Text>
          </Pressable>
        </View>

        <View style={styles.summaryGrid}>
          {topCards.map((card) => (
            <View key={card.label} style={[styles.summaryCard, { backgroundColor: card.tone }]}>
              <Text style={styles.summaryLabel}>{card.label}</Text>
              <Text style={styles.summaryValue}>{card.value}</Text>
            </View>
          ))}
        </View>

        {overview?.missingReasonings ? (
          <Pressable style={styles.alertCard} onPress={() => router.push('/products')}>
            <Text style={styles.alertTitle}>{overview.missingReasonings} missing reasonings</Text>
            <Text style={styles.alertText}>
              Critical classifications still lack required evidentiary documentation.
            </Text>
            <Text style={styles.alertAction}>Review missing data</Text>
          </Pressable>
        ) : null}

        <SectionHeader title="Recent classifications" actionLabel="Products" onPress={() => router.push('/products')} />
        <View style={styles.sectionCard}>
          {dashboardQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : overview?.actionItems?.length ? (
            overview.actionItems.slice(0, 4).map((item: any) => (
              <Pressable
                key={item.id}
                style={styles.listRow}
                onPress={() => {
                  const id = String(item.id ?? '');
                  if (!id) return;
                  router.push(`/classifications/${id}` as never);
                }}
              >
                <View style={styles.listDotWrap}>
                  <View
                    style={[
                      styles.listDot,
                      item.dossier ? styles.listDotReady : styles.listDotPending,
                    ]}
                  />
                </View>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{item.product?.name ?? 'Untitled product'}</Text>
                  <Text style={styles.listSubtitle}>
                    {formatClassificationCode(
                      getPreferredClassificationCode({
                        cnCode: item.cnCode,
                        htsCode: item.htsCode,
                        hsCode: item.hsCode,
                      }),
                    ) || 'Classification pending'}
                  </Text>
                </View>
                <View style={styles.listTag}>
                  <Text style={styles.listTagText}>{item.dossier ? 'Ready' : 'Pending'}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent classifications yet.</Text>
          )}
        </View>

        <Pressable
          style={styles.footerLink}
          onPress={() => {
            if (firstClassificationId) {
              router.push(`/classifications/${firstClassificationId}` as never);
              return;
            }
            router.push('/scan');
          }}
        >
          <Text style={styles.footerLinkText}>
            {firstClassificationId ? 'View latest result' : 'Run your first scan'}
          </Text>
          <ChevronRight color={colors.text} size={16} />
        </Pressable>

        <SectionHeader title="Recent shipments" />
        <View style={styles.sectionCard}>
          {overview?.recentShipments?.length ? (
            overview.recentShipments.slice(0, 3).map((shipment: any) => (
              <View key={shipment.id} style={styles.shipmentRow}>
                <View>
                  <Text style={styles.listTitle}>{shipment.shipmentNumber}</Text>
                  <Text style={styles.listSubtitle}>
                    {shipment.items?.length ?? 0} items · {String(shipment.type).toLowerCase()}
                  </Text>
                </View>
                <Text style={styles.shipmentStatus}>{String(shipment.status).replace(/_/g, ' ')}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No active shipments yet.</Text>
          )}
        </View>

        <View style={styles.accountCard}>
          <Text style={styles.accountTitle}>Account</Text>
          <Text style={styles.accountText}>
            Sign out lives here so the top-right action can stay focused on quick scan.
          </Text>
          <Pressable style={styles.accountButton} onPress={() => void signOut()}>
            <LogOut color={colors.text} size={16} />
            <Text style={styles.accountButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onPress ? (
        <Pressable onPress={onPress}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ActionTile({
  title,
  description,
  icon,
  dark,
  onPress,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  dark?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.actionTile, dark && styles.actionTileDark]} onPress={onPress}>
      <View style={[styles.actionIcon, dark && styles.actionIconDark]}>{icon}</View>
      <Text style={[styles.actionTitle, dark && styles.actionTitleDark]}>{title}</Text>
      <Text style={[styles.actionText, dark && styles.actionTextDark]}>{description}</Text>
    </Pressable>
  );
}

function Bullet({ text, danger, muted }: { text: string; danger?: boolean; muted?: boolean }) {
  return (
    <View style={styles.bulletRow}>
      <View
        style={[
          styles.bulletDot,
          danger ? styles.bulletDotDanger : muted ? styles.bulletDotMuted : styles.bulletDotDefault,
        ]}
      />
      <Text
        style={[
          styles.bulletText,
          danger && styles.bulletTextDanger,
          muted && styles.bulletTextMuted,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.page,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  header: {
    marginTop: 6,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 42,
  },
  brandRow: {
    alignItems: 'center',
    flex: 1,
  },
  brand: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  workspace: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  signOutButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 14,
  },
  scoreLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  scoreRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 7,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  scoreCopy: {
    flex: 1,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bulletDotDefault: {
    backgroundColor: colors.text,
  },
  bulletDotDanger: {
    backgroundColor: colors.danger,
  },
  bulletDotMuted: {
    backgroundColor: colors.textMuted,
  },
  bulletText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  bulletTextDanger: {
    color: colors.danger,
  },
  bulletTextMuted: {
    color: colors.textSecondary,
  },
  primaryActionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 132,
  },
  actionTileDark: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  actionIconDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  actionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  actionTitleDark: {
    color: '#FFFFFF',
  },
  actionText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  actionTextDark: {
    color: 'rgba(255,255,255,0.72)',
  },
  secondaryActionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  secondaryActionCopy: {
    flex: 1,
  },
  secondaryActionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  secondaryActionText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  secondaryActionButton: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryActionButtonText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  alertCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#F2C7CB',
  },
  alertTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  alertText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  alertAction: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  sectionAction: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  listDotWrap: {
    width: 28,
    alignItems: 'center',
  },
  listDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  listDotReady: {
    backgroundColor: colors.text,
  },
  listDotPending: {
    backgroundColor: colors.danger,
  },
  listCopy: {
    flex: 1,
    paddingRight: 12,
  },
  listTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  listSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  listTag: {
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  listTagText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 26,
  },
  footerLinkText: {
    color: colors.text,
    fontWeight: '700',
  },
  footerLinkTextDisabled: {
    color: colors.textMuted,
  },
  shipmentRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  shipmentStatus: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emptyText: {
    color: colors.textSecondary,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  accountCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  accountTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  accountText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  accountButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
  },
  accountButtonText: {
    color: colors.text,
    fontWeight: '800',
  },
});
