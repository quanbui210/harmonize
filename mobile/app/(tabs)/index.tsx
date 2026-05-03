import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  BadgeCheck,
  ChevronRight,
  FileBadge2,
  FileCheck2,
  Files,
  Menu,
  ScanSearch,
  UserCircle2,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';
import { lightTheme } from '@/constants/mobile-theme';
import { formatClassificationCode, getPreferredClassificationCode } from '@/lib/classification-code';

const { colors, radius } = lightTheme;

export default function DashboardScreen() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
  const metricCards = useMemo(
    () => [
      {
        label: 'Saved results',
        value: (overview?.approvedCount ?? 0) + (overview?.pendingCount ?? 0),
        tone: colors.surface,
      },
      {
        label: 'Pending items',
        value: overview?.missingReasonings ?? 0,
        tone: colors.warningSoft,
      },
      {
        label: 'Labels',
        value: overview?.totalLabels ?? 0,
        tone: colors.surface,
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
  const readiness = overview?.auditReadinessScore ?? 0;
  const readinessState = getReadinessState(readiness, overview?.missingReasonings ?? 0);
  const identityName = meQuery.data?.organization.name || meQuery.data?.user.name || 'TulliCheck';
  const totalSavedResults = (overview?.approvedCount ?? 0) + (overview?.pendingCount ?? 0);

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
        <View style={styles.headerCard}>
          <View style={styles.headerIdentity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(identityName)}</Text>
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.workspace}>{meQuery.data?.organization.name ?? 'Workspace'}</Text>
            </View>
          </View>
          <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)}>
            <Menu color={colors.text} size={18} />
          </Pressable>
        </View>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Audit readiness</Text>
          <View style={styles.scoreRowTop}>
            <View style={styles.scoreHeadline}>
              <Text style={styles.scoreHeadlineTitle}>Coverage overview</Text>
              <Text style={styles.scoreHeadlineText}>
                {overview?.approvedCount ?? 0} of {totalSavedResults} saved results are fully covered
              </Text>
            </View>
            <View style={[styles.scoreStatusPill, { backgroundColor: readinessState.pillColor }]}>
              <Text style={styles.scoreStatusText}>{readinessState.label}</Text>
            </View>
          </View>
          <View style={styles.scoreRow}>
            <View style={styles.scoreRing}>
              <View style={styles.scoreRingInner}>
                <Text style={styles.scoreRingValue}>{readiness}%</Text>
                <Text style={styles.scoreRingLabel}>{readinessState.shortLabel}</Text>
              </View>
            </View>
            <View style={styles.scoreCopy}>
              <Bullet text={`${overview?.approvedCount ?? 0} dossiers ready`} />
              <Bullet text={`${overview?.pendingCount ?? 0} saved results`} />
              <Bullet text={readinessState.description} muted />
            </View>
          </View>
        </View>

        <View style={styles.primaryActionGrid}>
          <ActionTile
            title="New Scan"
            description="Classify a product from the package."
            icon={<ScanSearch color="#FFFFFF" size={19} />}
            dark
            onPress={() => router.push('/scan')}
          />
          <ActionTile
            title="New Label"
            description="Start from an original label photo."
            icon={<FileBadge2 color={colors.text} size={19} />}
            onPress={() => router.push('/scan/label')}
          />
        </View>

        <View style={styles.summaryGrid}>
          {metricCards.map((card) => (
            <View key={card.label} style={[styles.summaryCard, { backgroundColor: card.tone }]}>
              <Text style={styles.summaryLabel}>{card.label}</Text>
              <Text style={styles.summaryValue}>{card.value}</Text>
            </View>
          ))}
        </View>

        {overview?.missingReasonings ? (
          <Pressable
            style={styles.actionCard}
            onPress={() => router.push('/library?section=classifications')}
          >
            <Text style={styles.actionEyebrow}>Pending completion</Text>
            <Text style={styles.actionCardTitle}>{overview.missingReasonings} items can be strengthened</Text>
            <Text style={styles.actionCardText}>
              Review the saved results that still need a clarification or dossier.
            </Text>
            <Text style={styles.actionCardLink}>Review now</Text>
          </Pressable>
        ) : null}

        <SectionHeader
          title="Recent activity"
          actionLabel="View all"
          onPress={() => router.push('/library?section=classifications')}
        />
        <View style={styles.sectionCard}>
          {dashboardQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : overview?.actionItems?.length ? (
            overview.actionItems.slice(0, 4).map((item: any) => {
              const tone = getActivityTone(item);
              return (
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
                    <View style={[styles.listDot, tone.dotStyle]} />
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
                  <View style={[styles.listTag, tone.tagStyle]}>
                    <Text style={[styles.listTagText, tone.tagTextStyle]}>{tone.label}</Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No recent activity yet.</Text>
          )}
        </View>

        <Pressable
          style={styles.footerLink}
          onPress={() => {
            if (firstActionItem?.id) {
              router.push(`/classifications/${String(firstActionItem.id)}` as never);
              return;
            }
            router.push('/scan');
          }}
        >
          <Text style={styles.footerLinkText}>
            {firstActionItem?.id ? 'Open latest result' : 'Run your first scan'}
          </Text>
          <ChevronRight color={colors.text} size={16} />
        </Pressable>
      </ScrollView>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.menuIdentity}>
              <View style={styles.menuAvatar}>
                <Text style={styles.menuAvatarText}>{getInitials(identityName)}</Text>
              </View>
              <View style={styles.menuIdentityCopy}>
                <Text style={styles.menuName}>{meQuery.data?.organization.name ?? 'Workspace'}</Text>
                <Text style={styles.menuEmail}>
                  {meQuery.data?.user.email || user.email || 'Signed in'}
                </Text>
              </View>
            </View>

            <MenuItem
              icon={<UserCircle2 color={colors.text} size={18} />}
              label="View account"
              onPress={() => {
                setMenuOpen(false);
                router.push('/account');
              }}
            />
            <MenuItem
              icon={<Files color={colors.text} size={18} />}
              label="All classifications"
              onPress={() => {
                setMenuOpen(false);
                router.push('/library?section=classifications');
              }}
            />
            <MenuItem
              icon={<FileBadge2 color={colors.text} size={18} />}
              label="All labels"
              onPress={() => {
                setMenuOpen(false);
                router.push('/library?section=labels');
              }}
            />
            <MenuItem
              icon={<FileCheck2 color={colors.text} size={18} />}
              label="All dossiers"
              onPress={() => {
                setMenuOpen(false);
                router.push('/library?section=dossiers');
              }}
            />
            <MenuItem
              icon={<ScanSearch color={colors.text} size={18} />}
              label="Start new scan"
              onPress={() => {
                setMenuOpen(false);
                router.push('/scan');
              }}
            />
            <MenuItem
              icon={<BadgeCheck color={colors.text} size={18} />}
              label="Sign out"
              onPress={() => {
                setMenuOpen(false);
                void signOut();
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
      <Text style={[styles.actionTileText, dark && styles.actionTileTextDark]}>{description}</Text>
    </Pressable>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemIcon}>{icon}</View>
      <Text style={styles.menuItemLabel}>{label}</Text>
      <ChevronRight color={colors.textMuted} size={18} />
    </Pressable>
  );
}

function Bullet({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, muted ? styles.bulletDotMuted : styles.bulletDotDefault]} />
      <Text style={[styles.bulletText, muted && styles.bulletTextMuted]}>{text}</Text>
    </View>
  );
}

function getInitials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'TC'
  );
}

function getReadinessState(score: number, missingReasonings: number) {
  if (score >= 80 && missingReasonings === 0) {
    return {
      label: 'Complete',
      shortLabel: 'Complete',
      description: 'Your saved results look well covered right now.',
      pillColor: colors.successSoft,
    };
  }

  if (score >= 45) {
    return {
      label: 'In progress',
      shortLabel: 'In progress',
      description: 'Some saved results are still pending completion.',
      pillColor: colors.warningSoft,
    };
  }

  return {
    label: 'Pending completion',
    shortLabel: 'Pending',
    description: 'Prioritize items that still need clarification or dossier coverage.',
    pillColor: colors.warningSoft,
  };
}

function getActivityTone(item: any) {
  if (item?.dossier) {
    return {
      label: 'Dossier ready',
      dotStyle: styles.listDotReady,
      tagStyle: styles.listTagReady,
      tagTextStyle: styles.listTagTextReady,
    };
  }

  if (item?.refinementQuestion || item?.requiresReview) {
    return {
      label: 'Needs details',
      dotStyle: styles.listDotAttention,
      tagStyle: styles.listTagAttention,
      tagTextStyle: styles.listTagTextAttention,
    };
  }

  return {
    label: 'Saved',
    dotStyle: styles.listDotNeutral,
    tagStyle: styles.listTagNeutral,
    tagTextStyle: styles.listTagTextNeutral,
  };
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
  headerCard: {
    marginTop: 8,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
  },
  welcomeText: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  workspace: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceMuted,
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
    marginBottom: 10,
  },
  scoreRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scoreHeadline: {
    flex: 1,
    paddingRight: 12,
  },
  scoreHeadlineTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  scoreHeadlineText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  scoreStatusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  scoreStatusText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  scoreRing: {
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 7,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  scoreRingInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  scoreRingValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  scoreRingLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  bulletDotMuted: {
    backgroundColor: colors.textMuted,
  },
  bulletText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  actionTitleDark: {
    color: '#FFFFFF',
  },
  actionTileText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  actionTileTextDark: {
    color: 'rgba(255,255,255,0.72)',
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
  summaryValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  actionCard: {
    backgroundColor: '#E7EEF9',
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#D4DDF0',
  },
  actionEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  actionCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  actionCardText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  actionCardLink: {
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
    fontSize: 22,
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
    backgroundColor: colors.success,
  },
  listDotAttention: {
    backgroundColor: colors.warning,
  },
  listDotNeutral: {
    backgroundColor: colors.textMuted,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  listTagReady: {
    backgroundColor: colors.successSoft,
  },
  listTagAttention: {
    backgroundColor: colors.warningSoft,
  },
  listTagNeutral: {
    backgroundColor: colors.surfaceRaised,
  },
  listTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listTagTextReady: {
    color: colors.success,
  },
  listTagTextAttention: {
    color: colors.warning,
  },
  listTagTextNeutral: {
    color: colors.textSecondary,
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
  emptyText: {
    color: colors.textSecondary,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    justifyContent: 'flex-start',
  },
  menuSheet: {
    marginTop: 72,
    marginHorizontal: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  menuIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  menuAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  menuIdentityCopy: {
    flex: 1,
  },
  menuName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  menuEmail: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
    flex: 1,
  },
});
