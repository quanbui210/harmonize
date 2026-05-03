import { useEffect, useMemo, useState } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  FileBadge2,
  ImagePlus,
  ShieldCheck,
} from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { lightTheme } from '@/constants/mobile-theme';
import { isInvalidZeroCode } from '@/lib/classification-code';

const { colors, radius } = lightTheme;

type ScanAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

type LabelFormState = {
  productName: string;
  description: string;
  originCountry: string;
  destinationCountry: string;
  cnCode: string;
  productCategory: string;
  endUse: 'B2C' | 'B2B' | 'internal';
  bestBeforeDate: string;
  netQuantity: string;
  originalLabelText: string;
  importerCompany: string;
  importerStreet: string;
  importerPostalCode: string;
  importerCity: string;
  importerCountry: string;
};

type UploadedLabelPreview = {
  imageUri: string;
  ocrText: string;
  confidence: number;
};

const initialForm: LabelFormState = {
  productName: '',
  description: '',
  originCountry: '',
  destinationCountry: 'Finland',
  cnCode: '',
  productCategory: 'food',
  endUse: 'B2C',
  bestBeforeDate: '',
  netQuantity: '',
  originalLabelText: '',
  importerCompany: '',
  importerStreet: '',
  importerPostalCode: '',
  importerCity: '',
  importerCountry: 'Finland',
};

export default function LabelScanScreen() {
  const params = useLocalSearchParams<{ classificationId?: string }>();
  const classificationId = Array.isArray(params.classificationId)
    ? params.classificationId[0]
    : params.classificationId;

  const [form, setForm] = useState<LabelFormState>(initialForm);
  const [preview, setPreview] = useState<UploadedLabelPreview | null>(null);

  const classificationQuery = useQuery({
    queryKey: ['classification', classificationId, 'label-prefill'],
    queryFn: () => ApiClient.getClassification(classificationId as string),
    enabled: !!classificationId,
  });

  useEffect(() => {
    if (!classificationQuery.data) return;
    const classification = classificationQuery.data;

    setForm((current) => ({
      ...current,
      productName: current.productName || classification.product?.name || '',
      description: current.description || classification.product?.description || '',
      originCountry:
        current.originCountry ||
        stringValue(classification.product?.metadata?.originCountry) ||
        stringValue(classification.product?.metadata?.countryOfOrigin) ||
        '',
      cnCode:
        current.cnCode ||
        (isInvalidZeroCode(classification.cnCode) ? '' : classification.cnCode || '') ||
        (isInvalidZeroCode(classification.htsCode?.slice(0, 8))
          ? ''
          : classification.htsCode?.slice(0, 8) || ''),
    }));
  }, [classificationQuery.data]);

  const uploadLabelMutation = useMutation({
    mutationFn: async (asset: ScanAsset) => {
      const createdProduct = await ApiClient.createProduct({
        name: `Label scan ${new Date().toLocaleDateString()}`,
        description: 'Created from mobile label scan.',
        intendedUse: 'Original label captured for EU label generation',
        targetMarkets: ['EU'],
      });

      const upload = await ApiClient.uploadProductImage(createdProduct.id, {
        uri: asset.uri,
        name: asset.fileName || `label-scan-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });

      return {
        imageUri: asset.uri,
        ocrText: upload.ocrText || '',
        confidence: upload.confidence ?? 0,
        extractedData: upload.extractedData,
      };
    },
    onSuccess: (result) => {
      setPreview({
        imageUri: result.imageUri,
        ocrText: result.ocrText,
        confidence: result.confidence,
      });

      setForm((current) => ({
        ...current,
        productName:
          current.productName ||
          stringValue(result.extractedData?.productName) ||
          stringValue(result.extractedData?.name) ||
          '',
        description:
          current.description || stringValue(result.extractedData?.description) || '',
        originCountry:
          current.originCountry || stringValue(result.extractedData?.originCountry) || '',
        bestBeforeDate:
          current.bestBeforeDate || stringValue(result.extractedData?.bestBeforeDate) || '',
        netQuantity: current.netQuantity || stringValue(result.extractedData?.netQuantity) || '',
        originalLabelText: current.originalLabelText || result.ocrText || '',
      }));
    },
    onError: (error: Error) => {
      Alert.alert('Label scan failed', error.message);
    },
  });

  const generateLabelMutation = useMutation({
    mutationFn: () =>
      ApiClient.generateLabel({
        productName: form.productName.trim(),
        description: emptyAsUndefined(form.description),
        originCountry: emptyAsUndefined(form.originCountry),
        destinationCountry: emptyAsUndefined(form.destinationCountry),
        cnCode: emptyAsUndefined(form.cnCode),
        originalLabelText: emptyAsUndefined(form.originalLabelText),
        productCategory: form.productCategory,
        endUse: form.endUse,
        labelSize: { width: 100, height: 150 },
        importerAddress: formatImporterAddress(form),
        bestBeforeDate: emptyAsUndefined(form.bestBeforeDate),
        netQuantity: emptyAsUndefined(form.netQuantity),
        classificationId: classificationId || undefined,
        save: true,
      }),
    onError: (error: Error) => {
      Alert.alert('Label generation failed', error.message);
    },
  });

  const failedChecks = useMemo(() => {
    const checks = generateLabelMutation.data?.complianceResults ?? [];
    return checks.filter((item: any) => item && item.passed === false);
  }, [generateLabelMutation.data]);

  const canGenerate =
    form.productName.trim().length > 0 &&
    form.destinationCountry.trim().length > 0 &&
    form.bestBeforeDate.trim().length > 0 &&
    form.netQuantity.trim().length > 0 &&
    form.originalLabelText.trim().length > 0 &&
    form.importerCompany.trim().length > 0 &&
    form.importerStreet.trim().length > 0 &&
    form.importerPostalCode.trim().length > 0 &&
    form.importerCity.trim().length > 0 &&
    form.importerCountry.trim().length > 0;

  const handlePick = async (mode: 'camera' | 'library') => {
    if (mode === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to scan the original label.');
        return;
      }

      const capture = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
      });

      if (capture.canceled || !capture.assets[0]) return;
      await uploadLabelMutation.mutateAsync(capture.assets[0]);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Library permission needed', 'Allow photo library access to upload label images.');
      return;
    }

    const selection = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
    });

    if (selection.canceled || !selection.assets[0]) return;
    await uploadLabelMutation.mutateAsync(selection.assets[0]);
  };

  const openSavedLabel = async (mode: 'html' | 'pdf') => {
    const labelId = generateLabelMutation.data?.labelId;
    if (!labelId) return;

    try {
      if (mode === 'html') {
        router.push({
          pathname: '/preview',
          params: {
            path: `/api/label/${labelId}/export`,
            title: 'Label preview',
          },
        });
        return;
      }

      const exportUrls = await ApiClient.getLabelExport(labelId);
      await WebBrowser.openBrowserAsync(ApiClient.resolveUrl(exportUrls.pdfUrl));
    } catch (error) {
      Alert.alert(
        'Unable to open label',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={18} />
          </Pressable>
          <Text style={styles.brand}>Generate EU label</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <FileBadge2 color={colors.text} size={16} />
            <Text style={styles.heroBadgeText}>Next step</Text>
          </View>
          <Text style={styles.heroTitle}>Scan the original label, then finish the missing details.</Text>
          <Text style={styles.heroText}>
            We fill in what we can from the photo. You still need to check the address, dates,
            quantity, and any missing details.
          </Text>
        </View>

        {classificationId ? (
          <View style={styles.prefillCard}>
            {classificationQuery.isLoading ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.inlineLoadingText}>Loading product details...</Text>
              </View>
            ) : classificationQuery.data ? (
              <>
                <Text style={styles.prefillTitle}>Using saved product details</Text>
                <Text style={styles.prefillText}>
                  {classificationQuery.data.product?.name ?? 'Product'} will fill in the basic
                  product details while you complete the label information below.
                </Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.captureCard}>
          {preview ? (
            <Image source={{ uri: preview.imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.framePlaceholder}>
              <Text style={styles.framePlaceholderTitle}>Original product label</Text>
              <Text style={styles.framePlaceholderText}>
                Scan the current label first so we can fill in the product text before you complete
                the fields below.
              </Text>
            </View>
          )}
        </View>

        <Pressable
          style={styles.primaryButton}
          disabled={uploadLabelMutation.isPending}
          onPress={() => void handlePick('camera')}
        >
          <Camera color="#FFFFFF" size={17} />
          <Text style={styles.primaryButtonText}>
            {uploadLabelMutation.isPending ? 'Reading label...' : 'Take label photo'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          disabled={uploadLabelMutation.isPending}
          onPress={() => void handlePick('library')}
        >
          <ImagePlus color={colors.text} size={17} />
          <Text style={styles.secondaryButtonText}>Upload label image</Text>
        </Pressable>

        {preview ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Scanned label result</Text>
            <InfoRow label="Text reading quality" value={`${Math.round(preview.confidence * 100)}%`} />
            <View style={styles.ocrCard}>
              <Text style={styles.ocrTitle}>Text found on label</Text>
              <Text style={styles.ocrText} numberOfLines={8}>
                {preview.ocrText || 'No text was found in this scan.'}
              </Text>
            </View>
          </View>
        ) : null}

        <Section title="Product basics">
          <Field label="Product name *" value={form.productName} onChangeText={(value) => updateForm(setForm, 'productName', value)} />
          <Field label="Description" value={form.description} onChangeText={(value) => updateForm(setForm, 'description', value)} multiline />
          <Field label="Origin country" value={form.originCountry} onChangeText={(value) => updateForm(setForm, 'originCountry', value)} />
          <Field label="Destination country *" value={form.destinationCountry} onChangeText={(value) => updateForm(setForm, 'destinationCountry', value)} />
          <Field label="CN code" value={form.cnCode} onChangeText={(value) => updateForm(setForm, 'cnCode', value)} />
        </Section>

        <Section title="Required label details">
          <Field label="Best before date *" value={form.bestBeforeDate} onChangeText={(value) => updateForm(setForm, 'bestBeforeDate', value)} placeholder="YYYY-MM-DD" />
          <Field label="Net quantity *" value={form.netQuantity} onChangeText={(value) => updateForm(setForm, 'netQuantity', value)} placeholder="e.g. 200 g" />
          <Field
            label="Original label text *"
            value={form.originalLabelText}
            onChangeText={(value) => updateForm(setForm, 'originalLabelText', value)}
            multiline
            placeholder="Paste or review the text from the label before generating"
          />
        </Section>

        <Section title="EU importer address">
          <Field label="Company *" value={form.importerCompany} onChangeText={(value) => updateForm(setForm, 'importerCompany', value)} />
          <Field label="Street *" value={form.importerStreet} onChangeText={(value) => updateForm(setForm, 'importerStreet', value)} />
          <Field label="Postal code *" value={form.importerPostalCode} onChangeText={(value) => updateForm(setForm, 'importerPostalCode', value)} />
          <Field label="City *" value={form.importerCity} onChangeText={(value) => updateForm(setForm, 'importerCity', value)} />
          <Field label="Country *" value={form.importerCountry} onChangeText={(value) => updateForm(setForm, 'importerCountry', value)} />
        </Section>

        <View style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <ShieldCheck color={colors.success} size={18} />
            <Text style={styles.tipTitle}>Before you generate</Text>
          </View>
          <Text style={styles.tipText}>
            This step helps you get started from the label photo, but you still need to check the
            business details before generating the final label.
          </Text>
        </View>

        <Pressable
          style={[styles.primaryButton, !canGenerate && styles.primaryButtonDisabled]}
          disabled={!canGenerate || generateLabelMutation.isPending}
          onPress={() => void generateLabelMutation.mutate()}
        >
          {generateLabelMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Generate label</Text>
          )}
        </Pressable>

        {!canGenerate ? (
          <Text style={styles.helperText}>
            Fill all starred fields and make sure the original label text is present before
            generation.
          </Text>
        ) : null}

        {generateLabelMutation.data ? (
          <View style={styles.generatedCard}>
            <Text style={styles.generatedTitle}>Label generated</Text>
            <InfoRow
              label="Label check score"
              value={`${generateLabelMutation.data.complianceScore}%`}
            />
            <InfoRow
              label="Label file"
              value={generateLabelMutation.data.labelId ? 'Ready to open' : 'Generated only'}
            />
            {failedChecks.length ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Still needs attention</Text>
                {failedChecks.slice(0, 3).map((item: any, index: number) => (
                  <Text key={`${item?.checkId || 'check'}-${index}`} style={styles.warningText}>
                    - {extractIssueText(item)}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.generatedButtonRow}>
              <Pressable style={styles.generatedButton} onPress={() => void openSavedLabel('html')}>
                <ExternalLink color={colors.text} size={16} />
                <Text style={styles.generatedButtonText}>View label</Text>
              </Pressable>
              <Pressable style={styles.generatedButton} onPress={() => void openSavedLabel('pdf')}>
                <ExternalLink color={colors.text} size={16} />
                <Text style={styles.generatedButtonText}>Open PDF</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function updateForm(
  setForm: React.Dispatch<React.SetStateAction<LabelFormState>>,
  key: keyof LabelFormState,
  value: string,
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function emptyAsUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function formatImporterAddress(form: LabelFormState) {
  return [
    form.importerCompany.trim(),
    form.importerStreet.trim(),
    `${form.importerPostalCode.trim()} ${form.importerCity.trim()}`.trim(),
    form.importerCountry.trim(),
  ]
    .filter(Boolean)
    .join(', ');
}

function extractIssueText(item: any) {
  return item?.message || item?.summary || item?.title || item?.checkId || 'Review compliance details.';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
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
    paddingBottom: 42,
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
    backgroundColor: colors.accentStrong,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  heroBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  prefillCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  prefillTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  prefillText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineLoadingText: {
    color: colors.textSecondary,
    fontSize: 13,
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
    height: 320,
    borderRadius: radius.md,
  },
  framePlaceholder: {
    height: 320,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  framePlaceholderTitle: {
    color: colors.text,
    fontSize: 20,
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
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    marginBottom: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
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
    fontSize: 14,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 22,
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
    marginTop: 14,
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputMultiline: {
    minHeight: 120,
  },
  tipCard: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#CFEADB',
    padding: 18,
    marginBottom: 12,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tipTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  tipText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  generatedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  generatedTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 14,
  },
  warningTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  warningText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  generatedButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  generatedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  generatedButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
});
