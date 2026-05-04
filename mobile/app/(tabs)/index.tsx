import { useState, type ReactNode } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import Svg, { Circle } from 'react-native-svg';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';
import { BrandMark } from '@/components/BrandMark';
import { lightTheme } from '@/constants/mobile-theme';

const { colors, radius } = lightTheme;

export default function DashboardScreen() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => ApiClient.getMe(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => ApiClient.getDashboard(),
    enabled: !!user,
    staleTime: 45_000,
  });

  const isRefreshing = dashboardQuery.isRefetching || meQuery.isRefetching;
  const overview = dashboardQuery.data;
  if (authLoading || !user) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const readiness = overview?.auditReadinessScore ?? 0;
  const identityName = meQuery.data?.organization.name || meQuery.data?.user.name || 'TulliCheck';
  const totalSavedResults = (overview?.approvedCount ?? 0) + (overview?.pendingCount ?? 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <GridBackdrop />
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
            <BrandMark size={46} />
            <View style={styles.headerCopy}>
              <Text style={styles.welcomeText}>TulliCheck</Text>
              <Text style={styles.workspace}>{meQuery.data?.organization.name ?? 'Workspace'}</Text>
            </View>
          </View>
          <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)}>
            <Menu color={colors.text} size={18} />
          </Pressable>
        </View>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Audit readiness</Text>
          <AuditProgressRing progress={readiness} size={214} strokeWidth={10} />
        </View>

        <View style={styles.primaryActionGrid}>
          <ActionTile
            title="New Scan"
            icon={<ScanSearch color="#FFFFFF" size={19} />}
            dark
            onPress={() => router.push('/scan')}
          />
          <ActionTile
            title="New Label"
            icon={<FileBadge2 color={colors.text} size={16} />}
            onPress={() => router.push('/scan/label')}
          />
        </View>

        <View style={styles.summaryLines}>
          <SummaryLine label="Saved Results" value={totalSavedResults} />
          <SummaryLine label="Active Labels" value={overview?.totalLabels ?? 0} />
          <SummaryLine label="Pending Reviews" value={overview?.missingReasonings ?? 0} />
          <SummaryLine label="Dossiers" value={overview?.approvedCount ?? 0} />
        </View>

        <SectionHeader title="Quick menu" />
        <View style={styles.sectionCard}>
          <QuickMenuItem
            icon={<Files color={colors.text} size={16} />}
            label="Classifications"
            subtitle="Open all saved classification results"
            onPress={() => router.push('/library?section=classifications')}
          />
          <QuickMenuItem
            icon={<FileBadge2 color={colors.text} size={16} />}
            label="Labels"
            subtitle="Open generated and saved labels"
            onPress={() => router.push('/library?section=labels')}
          />
          <QuickMenuItem
            icon={<FileCheck2 color={colors.text} size={16} />}
            label="Dossiers"
            subtitle="Open dossiers ready for review"
            onPress={() => router.push('/library?section=dossiers')}
          />
        </View>
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
    </View>
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
  icon,
  dark,
  onPress,
}: {
  title: string;
  icon: ReactNode;
  dark?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.actionTile, dark && styles.actionTileDark]} onPress={onPress}>
      <View style={[styles.actionIcon, dark && styles.actionIconDark]}>{icon}</View>
      <Text style={[styles.actionTitle, dark && styles.actionTitleDark]}>{title}</Text>
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

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLineLabel}>{label}</Text>
      <Text style={styles.summaryLineValue}>{value.toLocaleString()}</Text>
    </View>
  );
}

function AuditProgressRing({
  progress,
  size,
  strokeWidth,
}: {
  progress: number;
  size: number;
  strokeWidth: number;
}) {
  const normalized = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalized / 100);

  return (
    <View style={[styles.scoreRingMinimal, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#DFE7F4"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#0B0F17"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          originX={size / 2}
          originY={size / 2}
          rotation={-90}
        />
      </Svg>
      <View style={styles.scoreRingMinimalInner}>
        <Text style={styles.scoreRingValue}>{normalized}%</Text>
      </View>
    </View>
  );
}

function QuickMenuItem({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickMenuItem} onPress={onPress}>
      <View style={styles.quickMenuIcon}>{icon}</View>
      <View style={styles.quickMenuCopy}>
        <Text style={styles.quickMenuLabel}>{label}</Text>
        <Text style={styles.quickMenuSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight color={colors.textMuted} size={16} />
    </Pressable>
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

function GridBackdrop() {
  const verticalLines = Array.from({ length: 14 });
  const horizontalLines = Array.from({ length: 28 });

  return (
    <View pointerEvents="none" style={styles.gridBackdrop}>
      {verticalLines.map((_, index) => (
        <View
          key={`v-${index}`}
          style={[
            styles.gridLineVertical,
            {
              left: `${(index / (verticalLines.length - 1)) * 100}%`,
            },
          ]}
        />
      ))}
      {horizontalLines.map((_, index) => (
        <View
          key={`h-${index}`}
          style={[
            styles.gridLineHorizontal,
            {
              top: `${(index / (horizontalLines.length - 1)) * 100}%`,
            },
          ]}
        />
      ))}
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
  gridBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#E2E9F5',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E2E9F5',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    zIndex: 1,
  },
  headerCard: {
    marginTop: 8,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerCopy: {
    flex: 1,
  },
  welcomeText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  workspace: {
    color: colors.text,
    fontSize: 16,
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
    paddingTop: 8,
    paddingBottom: 18,
    marginBottom: 10,
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  scoreRingMinimal: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingMinimalInner: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  scoreRingValue: {
    color: '#0B0F17',
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 42,
  },
  primaryActionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDE5F2',
    paddingHorizontal: 14,
    paddingVertical: 18,
    minHeight: 114,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTileDark: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionIconDark: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  actionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  actionTitleDark: {
    color: '#FFFFFF',
  },
  summaryLines: {
    marginBottom: 18,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5EAF4',
  },
  summaryLineLabel: {
    color: '#48556A',
    fontSize: 13,
    fontWeight: '500',
  },
  summaryLineValue: {
    color: '#0B0F17',
    fontSize: 22,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E6ECF8',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 14,
  },
  quickMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6ECF8',
  },
  quickMenuIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickMenuCopy: {
    flex: 1,
    paddingRight: 10,
  },
  quickMenuLabel: {
    color: '#0B0F17',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  quickMenuSubtitle: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionAction: {
    color: colors.textSecondary,
    fontWeight: '700',
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
    fontSize: 16,
    fontWeight: '800',
  },
  menuEmail: {
    color: colors.textSecondary,
    fontSize: 12,
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
    fontSize: 14,
    flex: 1,
  },
});
