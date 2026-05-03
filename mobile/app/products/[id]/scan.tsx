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
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, CheckCircle2, ImagePlus } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/components/AuthProvider';
import { lightTheme } from '@/constants/mobile-theme';

const { colors, radius } = lightTheme;

type UploadPreview = {
  uri: string;
  extractedData?: Record<string, unknown>;
  ocrText?: string;
  confidence?: number;
};

export default function ProductScanScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<UploadPreview | null>(null);

  const productQuery = useQuery({
    queryKey: ['product', productId],
    queryFn: () => ApiClient.getProduct(productId),
    enabled: !!user && !!productId,
  });

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['product', productId] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);
    },
    onError: (error: Error) => {
      Alert.alert('Upload failed', error.message);
    },
  });

  const classifyMutation = useMutation({
    mutationFn: () => ApiClient.classifyProduct(productId),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['product', productId] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['classifications'] }),
        queryClient.invalidateQueries({ queryKey: ['classifications', 'for-product', productId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);

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
        <Text style={styles.pageSubtitle}>
          Use this when you want to add more package or label photos to this saved product.
        </Text>

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
            <Text style={styles.processingText}>
              We are reading the photo and adding the details to this product.
            </Text>
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
            <InfoRow label="Detected product" value={stringValue(preview.extractedData?.productName)} />
            <InfoRow label="Origin country" value={stringValue(preview.extractedData?.originCountry)} />
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
                {classifyMutation.isPending ? 'Checking this product...' : 'Use this photo for classification'}
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
            <Text style={styles.emptyText}>
              Use this step for packaging fronts, ingredient panels, nutrition facts, or supplier label photos.
            </Text>
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
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  pageSubtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
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
    fontSize: 14,
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
    fontSize: 15,
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
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  processingText: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
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
    fontSize: 22,
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
    fontSize: 14,
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
