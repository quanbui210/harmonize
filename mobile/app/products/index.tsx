import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowRight, History, ScanSearch, Search } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';
import { lightTheme } from '@/constants/mobile-theme';
import type { ProductRecord } from '@/types/api';

const { colors, radius } = lightTheme;
const PAGE_SIZE = 20;

export default function ProductsScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const [query, setQuery] = useState('');

  const productsQuery = useInfiniteQuery({
    queryKey: ['products'],
    queryFn: ({ pageParam }) =>
      ApiClient.listProducts({ limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : null,
    enabled: !!user,
    staleTime: 30_000,
  });
  const products = useMemo(
    () => productsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [productsQuery.data],
  );

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;

    return products.filter((product) => {
      const haystack = [
        product.name,
        product.description,
        product.intendedUse ?? '',
        ...(product.targetMarkets ?? []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [products, query]);

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Saved History</Text>
        <Text style={styles.subtitle}>
          Products are your saved items and photo history after a scan, not the first step.
        </Text>
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerCopy}>
          <Text style={styles.bannerTitle}>Start new work from scan</Text>
          <Text style={styles.bannerText}>
            Use history when you want to reopen a saved product, add more photos, or continue
            where you left off.
          </Text>
        </View>
        <Pressable style={styles.bannerButton} onPress={() => router.push('/scan')}>
          <ScanSearch color={colors.text} size={16} />
          <Text style={styles.bannerButtonText}>Start scan</Text>
        </Pressable>
      </View>

      <View style={styles.searchShell}>
        <Search color={colors.textMuted} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, market or intended use"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.summaryRow}>
        <SummaryPill label="Total loaded" value={products.length} />
        <SummaryPill label="Visible" value={filteredProducts.length} />
        <SummaryPill
          label="With materials"
          value={products.filter((item) => (item.materials?.length ?? 0) > 0).length}
        />
      </View>
    </>
  );

  const renderProductItem = ({ item: product }: ListRenderItemInfo<ProductRecord>) => (
    <Pressable
      key={product.id}
      style={styles.productCard}
      onPress={() => router.push(`/products/${product.id}` as never)}
    >
      <View style={styles.productTopRow}>
        <Text style={styles.productTitle}>{product.name}</Text>
        <ArrowRight color={colors.textMuted} size={18} />
      </View>
      <Text style={styles.productDescription} numberOfLines={2}>
        {product.description}
      </Text>

      <View style={styles.metaRow}>
        {(product.targetMarkets ?? []).slice(0, 3).map((market) => (
          <View key={market} style={styles.marketTag}>
            <Text style={styles.marketTagText}>{market}</Text>
          </View>
        ))}
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.footerValue}>{product.materials?.length ?? 0}</Text>
          <Text style={styles.footerLabel}>materials</Text>
        </View>
        <Pressable
          style={styles.scanButton}
          onPress={(event) => {
            event.stopPropagation();
            router.push(`/products/${product.id}/scan` as never);
          }}
        >
          <History color="#FFFFFF" size={16} />
          <Text style={styles.scanButtonText}>Add photos</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  const renderEmpty = () => {
    if (authLoading || productsQuery.isLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    if (productsQuery.isError) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Unable to load products</Text>
          <Text style={styles.emptyText}>
            {productsQuery.error instanceof Error
              ? productsQuery.error.message
              : 'The products request failed. Pull to refresh after the API is ready.'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No saved products</Text>
        <Text style={styles.emptyText}>
          Start with a new scan and your saved product will appear here afterward.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProductItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          productsQuery.isFetchingNextPage ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        onEndReachedThreshold={0.45}
        onEndReached={() => {
          if (!productsQuery.hasNextPage || productsQuery.isFetchingNextPage) return;
          void productsQuery.fetchNextPage();
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={productsQuery.isRefetching && !productsQuery.isFetchingNextPage}
            onRefresh={() => void productsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
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
    paddingBottom: 110,
  },
  header: {
    marginTop: 6,
    marginBottom: 18,
  },
  title: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  banner: {
    backgroundColor: colors.accentStrong,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 16,
  },
  bannerCopy: {
    marginBottom: 18,
  },
  bannerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  bannerText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  bannerButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerButtonText: {
    color: colors.text,
    fontWeight: '800',
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  summaryPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  loadingState: {
    paddingVertical: 46,
    alignItems: 'center',
  },
  loadingMore: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 20,
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
  productCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 12,
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  productTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
  },
  productDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  marketTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
  },
  marketTagText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  footerValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  footerLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
