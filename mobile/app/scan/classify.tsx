import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, ImagePlus, ScanSearch } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { lightTheme } from '@/constants/mobile-theme';

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
};

export default function ClassificationScanScreen() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ClassificationScanResult | null>(null);

  const classifyFromScanMutation = useMutation({
    mutationFn: async (asset: ScanAsset) => {
      const fallbackName = `Scanned product ${new Date().toLocaleDateString()}`;
      const createdProduct = await ApiClient.createProduct({
        name: fallbackName,
        description: 'Created from mobile packaging scan.',
        intendedUse: 'To be confirmed from the scanned packaging',
        targetMarkets: ['EU'],
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
      const extractedMaterials = extractMaterials(upload.extractedData?.materials);
      const compositionText = buildCompositionText(upload.extractedData, upload.ocrText);

      if (
        extractedName !== createdProduct.name ||
        extractedDescription !== createdProduct.description ||
        extractedIntendedUse !== (createdProduct.intendedUse || undefined) ||
        extractedOriginCountry ||
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
            originCountry: extractedOriginCountry,
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
        originCountry: extractedOriginCountry,
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
      };
    },
    onSuccess: async (nextResult) => {
      setResult(nextResult);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['classifications'] }),
      ]);
    },
    onError: (error: Error) => {
      Alert.alert('Scan failed', error.message);
    },
  });

  const handlePick = async (mode: 'camera' | 'library') => {
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
      await classifyFromScanMutation.mutateAsync(capture.assets[0]);
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
    await classifyFromScanMutation.mutateAsync(selection.assets[0]);
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
            <Text style={styles.heroBadgeText}>Start here</Text>
          </View>
          <Text style={styles.heroTitle}>Capture the product before anything exists.</Text>
          <Text style={styles.heroText}>
            TulliCheck saves the product from this photo, reads the visible details, and takes you
            straight to the result.
          </Text>
        </View>

        <View style={styles.captureCard}>
          {result ? (
            <Image source={{ uri: result.previewUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.framePlaceholder}>
              <Text style={styles.framePlaceholderTitle}>Packaging front, ingredients, or spec sheet</Text>
              <Text style={styles.framePlaceholderText}>
                Use the clearest photo you have. Clear text helps the app understand the product
                better.
              </Text>
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
            <Text style={styles.processingText}>
              We are saving the photo and reviewing the product details.
            </Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Classification ready to review</Text>
            <InfoRow label="Product" value={result.productName} />
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
            <Text style={styles.emptyText}>
              Once the scan finishes, you go straight into the classification result and can continue
              into dossier or label generation from there.
            </Text>
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
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroText: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 14,
    lineHeight: 21,
  },
  captureCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
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
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  framePlaceholderText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
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
    fontSize: 15,
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
    fontSize: 14,
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
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  processingText: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    fontSize: 14,
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
    fontSize: 24,
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
    fontSize: 14,
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
    fontSize: 13,
    lineHeight: 20,
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
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
});
