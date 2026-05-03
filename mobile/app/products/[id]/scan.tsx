import { useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { ArrowLeft, Camera, CheckCircle2, CircleHelp, ImagePlus } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { lightTheme } from '@/constants/mobile-theme';
import { parseRefinementQuestion } from '@/lib/refinement-question';
import type { ClassificationRecord, CursorPaginatedResponse, ProductRecord } from '@/types/api';

const { colors, radius } = lightTheme;

type UploadPreview = {
  uri: string;
  extractedData?: Record<string, unknown>;
  ocrText?: string;
  confidence?: number;
};

export default function ProductScanScreen() {
  const params = useLocalSearchParams<{ id: string; classificationId?: string }>();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id;
  const classificationId = Array.isArray(params.classificationId)
    ? params.classificationId[0]
    : params.classificationId;
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [originCountry, setOriginCountry] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('Finland');
  const productQuery = useQuery({
    queryKey: ['product', productId],
    queryFn: () => ApiClient.getProduct(productId),
    enabled: !!productId,
  });
  const clarificationQuery = useQuery({
    queryKey: ['classification', classificationId],
    queryFn: () => ApiClient.getClassification(classificationId),
    enabled: !!classificationId,
  });
  const activeQuestion = parseRefinementQuestion(clarificationQuery.data?.refinementQuestion);

  useEffect(() => {
    if (!productQuery.data) return;
    const metadata =
      productQuery.data.metadata && typeof productQuery.data.metadata === 'object'
        ? (productQuery.data.metadata as Record<string, unknown>)
        : {};
    const currentOriginCountry = stringValue(metadata.originCountry);
    const currentDestinationCountry = stringValue(metadata.destinationCountry);
    if (currentOriginCountry && originCountry.trim().length === 0) {
      setOriginCountry(currentOriginCountry);
    }
    if (currentDestinationCountry && destinationCountry.trim().length === 0) {
      setDestinationCountry(currentDestinationCountry);
    }
  }, [destinationCountry, originCountry, productQuery.data]);

  const uploadMutation = useMutation({
    mutationFn: async (asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
      return ApiClient.uploadProductImage(productId, {
        uri: asset.uri,
        name: asset.fileName || `scan-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
    },
    onSuccess: async (result, variables) => {
      setPreview({
        uri: variables.uri,
        extractedData: result.extractedData,
        ocrText: result.ocrText,
        confidence: result.confidence,
      });
      queryClient.setQueryData(['product', productId], (current: unknown) =>
        appendProductImageInProductCache(current, result.image),
      );
    },
    onError: (error: Error) => {
      Alert.alert('Upload failed', error.message);
    },
  });

  const classifyMutation = useMutation({
    mutationFn: async () => {
      const normalizedOriginCountry = originCountry.trim();
      const normalizedDestinationCountry = destinationCountry.trim();
      if (!normalizedOriginCountry || !normalizedDestinationCountry) {
        throw new Error('Please set both origin and destination countries before rechecking.');
      }

      const product = productQuery.data;
      if (!product) {
        throw new Error('Product details are still loading. Please try again.');
      }

      await ApiClient.updateProduct(productId, {
        name: product.name,
        description: product.description,
        intendedUse: product.intendedUse ?? undefined,
        targetMarkets: product.targetMarkets ?? ['EU'],
        metadata: {
          ...(product.metadata || {}),
          originCountry: normalizedOriginCountry,
          destinationCountry: normalizedDestinationCountry,
        },
        materials: product.materials ?? [],
      });

      return ApiClient.classifyProduct(productId);
    },
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
          queryClient.invalidateQueries({ queryKey: ['products'] }),
        ]);
      }
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      const classificationId = String(
        response.result?.classification?.id || response.result?.classificationId || '',
      );

      if (!classificationId) {
        Alert.alert('Product updated', 'This product was checked again using the new photo.');
        return;
      }

      router.replace(`/classifications/${classificationId}` as never);
    },
    onError: (error: Error) => {
      Alert.alert('Classification failed', error.message);
    },
  });

  const handleCameraCapture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Please allow camera access to scan packaging.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) return;
    await uploadMutation.mutateAsync(result.assets[0]);
  };

  const handleLibraryPick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo library permission needed',
        'Please allow photo library access to upload packaging images.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) return;
    await uploadMutation.mutateAsync(result.assets[0]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={18} />
          </Pressable>
          <Text style={styles.brand}>TulliCheck</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.pageTitle}>Add More Photos</Text>
        <Text style={styles.pageSubtitle}>Use this when one more detail is needed.</Text>

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

        {classificationId && activeQuestion ? (
          <View style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <CircleHelp color={colors.primary} size={16} />
              <Text style={styles.questionTitle}>Current question</Text>
            </View>
            <Text style={styles.questionText}>{activeQuestion.question}</Text>
            {activeQuestion.explanation ? (
              <Text style={styles.questionExplanation}>{activeQuestion.explanation}</Text>
            ) : null}
            {activeQuestion.options.length ? (
              <View style={styles.questionOptions}>
                {activeQuestion.options.map((option) => (
                  <View key={`${option.value}-${option.label}`} style={styles.questionOption}>
                    <Text style={styles.questionOptionText}>{option.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.questionHint}>
              Add a clearer photo if the answer is visible on packaging.
            </Text>
            <Pressable
              style={styles.questionBackButton}
              onPress={() => router.replace(`/classifications/${classificationId}` as never)}
            >
              <Text style={styles.questionBackButtonText}>Back to clarification</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.frameCard}>
          <View style={styles.detectingBadge}>
            <Text style={styles.detectingText}>Detecting text...</Text>
          </View>
          {preview ? (
            <Image source={{ uri: preview.uri }} style={styles.previewFrameImage} />
          ) : (
            <View style={styles.framePlaceholder}>
              <Text style={styles.framePlaceholderText}>Photo will appear here</Text>
            </View>
          )}
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => void handleCameraCapture()}
          disabled={uploadMutation.isPending}
        >
          <Camera color="#FFFFFF" size={17} />
          <Text style={styles.primaryButtonText}>
            {uploadMutation.isPending ? 'Uploading...' : 'Take photo'}
          </Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void handleLibraryPick()}
            disabled={uploadMutation.isPending}
          >
            <ImagePlus color={colors.text} size={16} />
            <Text style={styles.secondaryButtonText}>Upload image</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              Alert.alert(
                'More file options next',
                'Adding product sheets can come next. For now, please upload a photo from your gallery.',
              )
            }
          >
            <Text style={styles.secondaryButtonText}>Drop spec sheet</Text>
          </Pressable>
        </View>

        {uploadMutation.isPending ? (
          <View style={styles.processingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.processingTitle}>Uploading photo...</Text>
            <Text style={styles.processingText}>Reading and attaching details.</Text>
          </View>
        ) : null}

        {preview ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Latest upload</Text>
              <View style={styles.successBadge}>
                <CheckCircle2 color={colors.success} size={14} />
                <Text style={styles.successText}>Saved to product</Text>
              </View>
            </View>

            <InfoRow label="Text reading quality" value={`${Math.round((preview.confidence ?? 0) * 100)}%`} />
            <InfoRow label="Origin country" value={originCountry.trim() || 'Not detected'} />
            <InfoRow label="Destination country" value={destinationCountry.trim() || 'Not detected'} />
            <InfoRow label="Detected product" value={stringValue(preview.extractedData?.productName)} />
            <InfoRow label="Detected origin country" value={stringValue(preview.extractedData?.originCountry)} />
            <InfoRow label="Intended use" value={stringValue(preview.extractedData?.intendedUse)} />
            <InfoRow label="Description" value={stringValue(preview.extractedData?.description)} />

            {preview.ocrText ? (
              <View style={styles.ocrBox}>
                <Text style={styles.ocrTitle}>Text found in photo</Text>
                <Text style={styles.ocrText} numberOfLines={8}>
                  {preview.ocrText}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={styles.primaryButton}
              onPress={() => void classifyMutation.mutate()}
              disabled={classifyMutation.isPending}
            >
              <Text style={styles.primaryButtonText}>
                {classifyMutation.isPending ? 'Checking this product...' : 'Use this photo and check again'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryReturnButton}
              onPress={() => router.replace(`/products/${productId}` as never)}
            >
              <Text style={styles.secondaryReturnButtonText}>Return to product</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No scans yet</Text>
            <Text style={styles.emptyText}>Add packaging, ingredient, or label photos.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function stringValue(value: unknown) {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return 'Not detected';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function appendProductImageInProductCache(cache: unknown, image: unknown) {
  if (!cache || typeof cache !== 'object') return cache;
  if (!image || typeof image !== 'object') return cache;

  const product = cache as ProductRecord;
  const uploadedImage = image as Record<string, unknown>;
  const existingImages = Array.isArray(product.images) ? product.images : [];
  const uploadedId = typeof uploadedImage.id === 'string' ? uploadedImage.id : null;
  const deduped = uploadedId
    ? existingImages.filter((item) => item.id !== uploadedId)
    : existingImages;

  return {
    ...product,
    images: [uploadedImage, ...deduped] as ProductRecord['images'],
  } as ProductRecord;
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
  secondaryReturnButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryReturnButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 44,
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
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSpacer: {
    width: 42,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  pageSubtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },
  contextCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
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
  questionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  questionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  questionText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  questionExplanation: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  questionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  questionOption: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  questionOptionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  questionHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  questionBackButton: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionBackButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  frameCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  detectingBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  detectingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  framePlaceholder: {
    height: 360,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  framePlaceholderText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
  },
  previewFrameImage: {
    width: '100%',
    height: 360,
    borderRadius: radius.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 12,
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
    fontWeight: '600',
  },
  ocrBox: {
    marginTop: 14,
    marginBottom: 18,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: 14,
  },
  ocrTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: 8,
  },
  ocrText: {
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
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
