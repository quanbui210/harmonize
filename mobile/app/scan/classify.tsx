import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { ArrowLeft, Camera, ImagePlus, ScanSearch } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { lightTheme } from '@/constants/mobile-theme';
import type { ClassificationRecord, CursorPaginatedResponse, ProductRecord } from '@/types/api';

const { colors, radius } = lightTheme;

type ScanAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

type ClassificationScanResult = {
  previewUri: string;
  productId: string;
  classificationId: string;
  productName: string;
  ocrText?: string;
  confidence?: number;
  classification?: ClassificationRecord | null;
};

export default function ClassificationScanScreen() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ClassificationScanResult | null>(null);
  const [originCountry, setOriginCountry] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('Finland');

  const classifyFromScanMutation = useMutation({
    mutationFn: async (input: {
      asset: ScanAsset;
      originCountry: string;
      destinationCountry: string;
    }) => {
      const { asset, originCountry: selectedOriginCountry, destinationCountry: selectedDestinationCountry } = input;
      const fallbackName = `Scanned product ${new Date().toLocaleDateString()}`;
      const createdProduct = await ApiClient.createProduct({
        name: fallbackName,
        description: 'Created from mobile packaging scan.',
        intendedUse: 'To be confirmed from the scanned packaging',
        targetMarkets: ['EU'],
        metadata: {
          originCountry: selectedOriginCountry,
          destinationCountry: selectedDestinationCountry,
        },
      });

      const upload = await ApiClient.uploadProductImage(createdProduct.id, {
        uri: asset.uri,
        name: asset.fileName || `classification-scan-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });

      const extractedName =
        stringValue(upload.extractedData?.productName) ||
        stringValue(upload.extractedData?.name) ||
        createdProduct.name;
      const extractedDescription =
        stringValue(upload.extractedData?.description) ||
        extractDescriptionFromOcr(upload.ocrText) ||
        createdProduct.description;
      const extractedIntendedUse =
        stringValue(upload.extractedData?.intendedUse) || createdProduct.intendedUse || undefined;
      const extractedOriginCountry = stringValue(upload.extractedData?.originCountry) || undefined;
      const resolvedOriginCountry = selectedOriginCountry || extractedOriginCountry;
      const extractedMaterials = extractMaterials(upload.extractedData?.materials);
      const compositionText = buildCompositionText(upload.extractedData, upload.ocrText);

      if (
        extractedName !== createdProduct.name ||
        extractedDescription !== createdProduct.description ||
        extractedIntendedUse !== (createdProduct.intendedUse || undefined) ||
        resolvedOriginCountry ||
        extractedMaterials.length > 0 ||
        compositionText
      ) {
        await ApiClient.updateProduct(createdProduct.id, {
          name: extractedName,
          description: extractedDescription,
          intendedUse: extractedIntendedUse,
          targetMarkets: createdProduct.targetMarkets,
          metadata: {
            ...(createdProduct.metadata || {}),
            originCountry: resolvedOriginCountry,
            destinationCountry: selectedDestinationCountry,
            compositionText: compositionText || undefined,
          },
          materials: extractedMaterials,
        });
      }

      const classificationResponse = await ApiClient.classifyProduct({
        productId: createdProduct.id,
        productName: extractedName,
        description: extractedDescription,
        intendedUse: extractedIntendedUse,
        materials: extractedMaterials.length > 0 ? extractedMaterials : undefined,
        compositionText: compositionText || undefined,
        originCountry: resolvedOriginCountry,
        destinationCountry: selectedDestinationCountry,
        imageIds: upload.image?.id ? [String(upload.image.id)] : undefined,
        market: 'EU',
      });
      const classificationId = String(
        classificationResponse.result?.classification?.id ||
          classificationResponse.result?.classificationId ||
          '',
      );
      const finalProductId = String(
        classificationResponse.result?.classification?.productId ||
          classificationResponse.result?.productId ||
          createdProduct.id,
      );

      if (!classificationId) {
        throw new Error('Classification finished without a valid result id.');
      }

      return {
        previewUri: asset.uri,
        productId: finalProductId,
        classificationId,
        productName: extractedName,
        ocrText: upload.ocrText,
        confidence: upload.confidence,
        classification:
          classificationResponse.result?.classification &&
          typeof classificationResponse.result.classification === 'object'
            ? (classificationResponse.result.classification as ClassificationRecord)
            : null,
      };
    },
    onSuccess: async (nextResult) => {
      setResult(nextResult);
      if (nextResult.classification) {
        queryClient.setQueryData(
          ['classification', nextResult.classification.id],
          nextResult.classification,
        );
        queryClient.setQueriesData(
          { queryKey: ['classifications'] },
          (current: unknown) =>
            replaceOrInsertClassificationInCollectionCache(current, nextResult.classification!),
        );
        queryClient.setQueriesData(
          { queryKey: ['classifications', 'for-product', nextResult.productId] },
          (current: unknown) =>
            replaceOrInsertClassificationInCollectionCache(current, nextResult.classification!),
        );
        if (nextResult.classification.product) {
          queryClient.setQueriesData(
            { queryKey: ['products'] },
            (current: unknown) =>
              replaceOrInsertProductInCollectionCache(
                current,
                nextResult.classification!.product as ProductRecord,
              ),
          );
        }
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['classifications'] }),
          queryClient.invalidateQueries({
            queryKey: ['classifications', 'for-product', nextResult.productId],
          }),
          queryClient.invalidateQueries({ queryKey: ['products'] }),
        ]);
      }
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      Alert.alert('Scan failed', error.message);
    },
  });

  const handlePick = async (mode: 'camera' | 'library') => {
    const normalizedOriginCountry = originCountry.trim();
    const normalizedDestinationCountry = destinationCountry.trim();
    if (!normalizedOriginCountry || !normalizedDestinationCountry) {
      Alert.alert(
        'Origin and destination needed',
        'Please set both origin and destination countries before scanning.',
      );
      return;
    }

    if (mode === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to scan packaging.');
        return;
      }

      const capture = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
      });

      if (capture.canceled || !capture.assets[0]) return;
      await classifyFromScanMutation.mutateAsync({
        asset: capture.assets[0],
        originCountry: normalizedOriginCountry,
        destinationCountry: normalizedDestinationCountry,
      });
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Library permission needed', 'Allow photo library access to upload packaging.');
      return;
    }

    const selection = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
    });

    if (selection.canceled || !selection.assets[0]) return;
    await classifyFromScanMutation.mutateAsync({
      asset: selection.assets[0],
      originCountry: normalizedOriginCountry,
      destinationCountry: normalizedDestinationCountry,
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={18} />
          </Pressable>
          <Text style={styles.brand}>Classify by scan</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <ScanSearch color="#FFFFFF" size={16} />
            <Text style={styles.heroBadgeText}>Product scan</Text>
          </View>
          <Text style={styles.heroTitle}>Scan product details.</Text>
          <Text style={styles.heroText}>Clear text improves the result.</Text>
        </View>

        <View style={styles.contextCard}>
          <Text style={styles.contextTitle}>Trade context</Text>
          <Text style={styles.contextText}>Used for duty and VAT estimates.</Text>
          <Text style={styles.fieldLabel}>Origin country</Text>
          <TextInput
            value={originCountry}
            onChangeText={setOriginCountry}
            placeholder="e.g. Vietnam"
            placeholderTextColor={colors.textMuted}
            style={styles.fieldInput}
            autoCapitalize="words"
          />
          <Text style={styles.fieldLabel}>Destination country</Text>
          <TextInput
            value={destinationCountry}
            onChangeText={setDestinationCountry}
            placeholder="e.g. Finland"
            placeholderTextColor={colors.textMuted}
            style={styles.fieldInput}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.captureCard}>
          {result ? (
            <Image source={{ uri: result.previewUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.framePlaceholder}>
              <Text style={styles.framePlaceholderTitle}>Packaging or ingredient panel</Text>
              <Text style={styles.framePlaceholderText}>Use a clear, readable image.</Text>
            </View>
          )}
        </View>

        <Pressable
          style={styles.primaryButton}
          disabled={classifyFromScanMutation.isPending}
          onPress={() => void handlePick('camera')}
        >
          <Camera color="#FFFFFF" size={17} />
          <Text style={styles.primaryButtonText}>
            {classifyFromScanMutation.isPending ? 'Processing scan...' : 'Take photo'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          disabled={classifyFromScanMutation.isPending}
          onPress={() => void handlePick('library')}
        >
          <ImagePlus color={colors.text} size={17} />
          <Text style={styles.secondaryButtonText}>Upload from library</Text>
        </Pressable>

        {classifyFromScanMutation.isPending ? (
          <View style={styles.processingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.processingTitle}>Saving photo and checking product...</Text>
            <Text style={styles.processingText}>Reviewing product details.</Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Classification ready to review</Text>
            <InfoRow label="Product" value={result.productName} />
            <InfoRow label="Origin country" value={originCountry.trim() || 'Not set'} />
            <InfoRow label="Destination country" value={destinationCountry.trim() || 'Not set'} />
            <InfoRow
              label="Text reading quality"
              value={`${Math.round((result.confidence ?? 0) * 100)}%`}
            />

            {result.ocrText ? (
              <View style={styles.ocrCard}>
                <Text style={styles.ocrTitle}>Text found in photo</Text>
                <Text style={styles.ocrText} numberOfLines={7}>
                  {result.ocrText}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace(`/classifications/${result.classificationId}` as never)}
            >
              <Text style={styles.primaryButtonText}>Open classification</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing scanned yet</Text>
            <Text style={styles.emptyText}>Your first result will appear here.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function extractMaterials(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;
      const material = stringValue(record.name) || stringValue(record.material);
      const percentageValue =
        typeof record.percentage === 'number'
          ? record.percentage
          : typeof record.percentage === 'string'
            ? Number.parseFloat(record.percentage)
            : Number.NaN;

      if (!material) return null;

      return {
        material,
        percentage: Number.isFinite(percentageValue) ? percentageValue : 0,
      };
    })
    .filter((item): item is { material: string; percentage: number } => Boolean(item));
}

function buildCompositionText(
  extractedData: Record<string, unknown>,
  ocrText?: string | null,
) {
  const sections: string[] = [];
  const directComposition = stringValue(extractedData?.compositionText);

  if (directComposition) {
    sections.push(directComposition);
  }

  const specifications = extractedData?.specifications;
  if (specifications && typeof specifications === 'object' && !Array.isArray(specifications)) {
    const specLines = Object.entries(specifications as Record<string, unknown>)
      .map(([key, value]) => {
        const normalizedValue = stringValue(value);
        return normalizedValue ? `${key}: ${normalizedValue}` : null;
      })
      .filter((line): line is string => Boolean(line));

    if (specLines.length > 0) {
      sections.push(specLines.join('\n'));
    }
  }

  const normalizedOcr = stringValue(ocrText);
  if (normalizedOcr) {
    sections.push(normalizedOcr);
  }

  const merged = sections.join('\n\n').trim();
  if (!merged) return null;

  return merged.slice(0, 6000);
}

function extractDescriptionFromOcr(ocrText?: string | null) {
  const normalized = stringValue(ocrText);
  if (!normalized) return null;

  return normalized.slice(0, 320);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  content: {
    paddingHorizontal: 18,
    paddingBottom: 40,
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
  headerSpacer: {
    width: 42,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroText: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 17,
  },
  captureCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  contextCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  contextTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  contextText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  fieldInput: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 360,
    borderRadius: radius.md,
  },
  framePlaceholder: {
    height: 360,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  framePlaceholderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  framePlaceholderText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    marginBottom: 14,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  processingCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  processingTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  processingText: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 12,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 10,
  },
  infoRow: {
    paddingVertical: 10,
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
    fontSize: 13,
    fontWeight: '700',
  },
  ocrCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: 14,
    marginVertical: 14,
  },
  ocrTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  ocrText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
