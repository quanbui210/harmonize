import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Bot, Check, ChevronRight, CircleHelp, Copy, FileBadge2, FileCheck2, ShieldAlert, Trash2 } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import { lightTheme } from '@/constants/mobile-theme';
import { formatClassificationCode, getPreferredClassificationCode, normalizeCodeDigits } from '@/lib/classification-code';
import { parseRefinementQuestion } from '@/lib/refinement-question';
import type { ClassificationRecord, CursorPaginatedResponse } from '@/types/api';

const { colors, radius } = lightTheme;

export default function ClassificationDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const classificationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();

  const classificationQuery = useQuery({
    queryKey: ['classification', classificationId],
    queryFn: () => ApiClient.getClassification(classificationId),
    enabled: !!classificationId,
    staleTime: 10_000,
  });

  const classification = classificationQuery.data;
  const product = classification?.product;
  const primaryDisplayCode = getSummaryDisplayCode({
    market: classification?.market,
    cnCode: classification?.cnCode,
    htsCode: classification?.htsCode,
    hsCode: classification?.hsCode,
  });
  const dutyRate = numberValue(classification?.dutySummary?.dutyRate);
  const vatRate = numberValue(classification?.dutySummary?.vatRate);
  const supplementaryUnit = stringValue(classification?.dutySummary?.supplementaryUnit);
  const composition = product?.materials?.length
    ? product.materials.map((item) => `${item.material} ${item.percentage}%`).join(', ')
    : 'No material composition captured yet.';
  const originCountry =
    stringValue(product?.metadata?.originCountry) ||
    stringValue(product?.metadata?.countryOfOrigin) ||
    'Not captured';
  const legalRationale =
    textFromUnknown(classification?.legalRationale) ||
    textFromUnknown(classification?.summary) ||
    'TulliCheck has not generated a detailed rationale for this classification yet.';
  const distinctions = normalizeDistinctions(classification?.distinctions);
  const keyFeatures = normalizeStringList(classification?.keyFeatures);
  const notes = textFromUnknown(classification?.notes);
  const importGuidance = classification?.humanNotes?.importGuidance || null;
  const requiredDocuments = normalizeStringList(importGuidance?.requiredDocuments);
  const recommendedTests = normalizeStringList(importGuidance?.recommendedTests);
  const labellingRequirements = normalizeStringList(importGuidance?.labellingRequirements);
  const nextActions = normalizeStringList(importGuidance?.nextActions);
  const foodSafetyRisks = normalizeFoodSafetyRisks(importGuidance?.foodSafetyRisks);
  const riskFlags = normalizeRiskFlags(classification?.riskFlags);
  const refinementQuestion = useMemo(
    () => parseRefinementQuestion(classification?.refinementQuestion),
    [classification?.refinementQuestion],
  );
  const [selectedRefinementAnswer, setSelectedRefinementAnswer] = useState<string | null>(null);
  const [customRefinementAnswer, setCustomRefinementAnswer] = useState('');
  const refinementField = refinementQuestion?.field || 'classification';
  const needsTypedRefinementAnswer =
    refinementField === 'compositionText' &&
    (!refinementQuestion?.options?.length || selectedRefinementAnswer === 'other');
  const resolvedRefinementAnswer =
    selectedRefinementAnswer === 'other'
      ? customRefinementAnswer.trim()
      : selectedRefinementAnswer?.trim() || customRefinementAnswer.trim();

  useEffect(() => {
    setSelectedRefinementAnswer(null);
    setCustomRefinementAnswer('');
  }, [classification?.refinementQuestion]);

  const answerRefinementMutation = useMutation({
    mutationFn: (input: { answer: string; field: string }) =>
      ApiClient.answerClassificationRefinement(classificationId, input),
    onSuccess: async (response) => {
      setSelectedRefinementAnswer(null);
      setCustomRefinementAnswer('');
      const updatedClassification = response.result?.classification;
      if (updatedClassification) {
        queryClient.setQueryData(
          ['classification', classificationId],
          updatedClassification,
        );
        queryClient.setQueryData(
          ['classification', updatedClassification.id],
          updatedClassification,
        );
        queryClient.setQueriesData(
          { queryKey: ['classifications'] },
          (current: unknown) =>
            replaceClassificationInCollectionCache(current, updatedClassification),
        );
      } else {
        await queryClient.invalidateQueries({ queryKey: ['classifications'] });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        classification?.productId
          ? queryClient.invalidateQueries({ queryKey: ['product', classification.productId] })
          : Promise.resolve(),
      ]);

      const nextClassificationId = String(
        response.result?.classification?.id || response.result?.classificationId || classificationId,
      );
      router.replace(`/classifications/${nextClassificationId}` as never);
    },
    onError: (error: Error) => {
      Alert.alert('Could not use that answer', error.message);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => ApiClient.deleteClassification(classificationId),
    onSuccess: async (result) => {
      const deletedId = result.deletedClassificationId;
      queryClient.removeQueries({ queryKey: ['classification', deletedId], exact: true });
      queryClient.setQueriesData(
        { queryKey: ['classifications'] },
        (current: unknown) => removeClassificationFromCollectionCache(current, deletedId),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);
      router.replace('/library?section=classifications');
    },
    onError: (error: Error) => {
      Alert.alert('Delete failed', error.message);
    },
  });

  const confirmDelete = () => {
    if (!classification) return;

    Alert.alert(
      'Delete classification',
      `Delete the classification for ${classification.product?.name ?? 'this product'}? This may also delete the product if it is the only saved classification.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: deleteMutation.isPending ? 'Deleting...' : 'Delete', style: 'destructive', onPress: () => void deleteMutation.mutate() },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={classificationQuery.isRefetching}
            onRefresh={() => void classificationQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={18} />
          </Pressable>
          <Text style={styles.brand}>TulliCheck</Text>
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              if (!classificationId) return;
              router.push(`/classifications/${classificationId}/dossier` as never);
            }}
          >
            <FileCheck2 color={colors.text} size={17} />
          </Pressable>
        </View>

        {classificationQuery.isLoading ? (
          <View style={styles.centeredCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centeredText}>Loading classification...</Text>
          </View>
        ) : classificationQuery.isError || !classification ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load classification</Text>
            <Text style={styles.errorText}>
              {classificationQuery.error instanceof Error
                ? classificationQuery.error.message
                : 'The classification detail request failed.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.heroMetaRow}>
              <View style={styles.badge}>
                <Bot color={colors.textSecondary} size={14} />
                <Text style={styles.badgeText}>
                  {classification.confidence && classification.confidence >= 0.7
                    ? 'AI suggested'
                    : 'Classification result'}
                </Text>
              </View>
              <Text style={styles.reference}>ID: {classification.id.slice(0, 8).toUpperCase()}</Text>
            </View>

            <Text style={styles.productName}>{product?.name ?? 'Untitled product'}</Text>

            <CodeSummaryCard
              badgeLabel={
                classification.confidence && classification.confidence >= 0.7
                  ? 'AI Suggested'
                  : 'Classification Result'
              }
              code={formatClassificationCode(primaryDisplayCode) || 'Still being checked'}
              market={classification.market || product?.targetMarkets?.[0] || 'EU'}
              status={titleCase(classification.status)}
              score={
                classification.confidence != null
                  ? `${Math.round(classification.confidence * 100)}%`
                  : 'Not scored'
              }
              isPlaceholder={!primaryDisplayCode}
              canCopy={Boolean(primaryDisplayCode)}
              onCopy={async () => {
                if (!primaryDisplayCode) return;
                await Clipboard.setStringAsync(
                  formatClassificationCode(primaryDisplayCode) || primaryDisplayCode,
                );
              }}
            />

            <View style={styles.primaryActions}>
              <Pressable
                style={styles.secondaryPrimaryButton}
                onPress={() => router.push(`/scan/label?classificationId=${classification.id}` as never)}
              >
                <FileBadge2 color={colors.text} size={16} />
                <Text style={styles.secondaryPrimaryButtonText}>Generate EU label</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => router.push(`/classifications/${classification.id}/dossier` as never)}
              >
                <Text style={styles.primaryButtonText}>Open dossier</Text>
                <ChevronRight color="#FFFFFF" size={16} />
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Estimated import charges</Text>
              <MetricLine
                label="Estimated customs duty (third-country)"
                value={dutyRate != null ? `${dutyRate}%` : '-'}
              />
              <MetricLine label="Standard VAT" value={vatRate != null ? `${vatRate}%` : '-'} />
              <MetricLine label="Supplementary unit" value={supplementaryUnit || '-'} />
            </View>

            {classification.requiresReview || classification.refinementQuestion ? (
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <CircleHelp color={colors.primary} size={16} />
                  <Text style={styles.reviewTitle}>Clarification required</Text>
                </View>
                <Text style={styles.reviewQuestion}>
                  {refinementQuestion?.question ||
                    'This classification still needs analyst review before you rely on it for customs.'}
                </Text>
                {refinementQuestion?.explanation ? (
                  <Text style={styles.reviewExplanation}>{refinementQuestion.explanation}</Text>
                ) : null}
                {refinementQuestion?.options?.length ? (
                  <View style={styles.reviewOptions}>
                    {refinementQuestion.options.map((option) => (
                      <Pressable
                        key={`${option.value}-${option.label}`}
                        style={[
                          styles.reviewOption,
                          selectedRefinementAnswer === option.value && styles.reviewOptionSelected,
                        ]}
                        onPress={() => setSelectedRefinementAnswer(option.value)}
                      >
                        <Text
                          style={[
                            styles.reviewOptionText,
                            selectedRefinementAnswer === option.value &&
                              styles.reviewOptionTextSelected,
                          ]}
                        >
                          {option.label || option.value}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {needsTypedRefinementAnswer ? (
                  <TextInput
                    value={customRefinementAnswer}
                    onChangeText={setCustomRefinementAnswer}
                    placeholder="Type the material details"
                    placeholderTextColor={colors.textMuted}
                    style={styles.reviewInput}
                    multiline
                  />
                ) : null}
                <Text style={styles.reviewBody}>
                  Answer here if you know it. If not, add another photo that shows the missing
                  detail more clearly.
                </Text>
                <Pressable
                  style={[
                    styles.primaryReviewButton,
                    (!resolvedRefinementAnswer || answerRefinementMutation.isPending) &&
                      styles.primaryReviewButtonDisabled,
                  ]}
                  onPress={() => {
                    if (!resolvedRefinementAnswer) return;
                    void answerRefinementMutation.mutate({
                      answer: resolvedRefinementAnswer,
                      field: refinementField,
                    });
                  }}
                  disabled={!resolvedRefinementAnswer || answerRefinementMutation.isPending}
                >
                  <Text style={styles.primaryReviewButtonText}>
                    {answerRefinementMutation.isPending ? 'Checking your answer...' : 'Use this answer'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    if (!classification.productId) return;
                    router.push(
                      `/products/${classification.productId}/scan?classificationId=${classificationId}` as never,
                    );
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Add another photo instead</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Product details</Text>
              <DetailsGrid
                items={[
                  { label: 'Destination market', value: classification.market || 'EU' },
                  { label: 'Country of origin', value: originCountry },
                  { label: 'End use', value: product?.intendedUse || 'Not captured' },
                  { label: 'Materials / composition', value: composition },
                ]}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>International codes</Text>
              <InfoLine label="HS code (international base)" value={formatClassificationCode(classification.hsCode) || '-'} />
              <InfoLine label="HTS code (USA)" value={formatClassificationCode(classification.htsCode) || '-'} />
              <InfoLine label="CN code (EU)" value={formatClassificationCode(classification.cnCode) || '-'} />
            </View>

            {importGuidance ? (
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Import guidance</Text>
                  {importGuidance.riskLevel ? (
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>
                        {titleCase(importGuidance.riskLevel)} risk
                      </Text>
                    </View>
                  ) : null}
                </View>
                {importGuidance.importStatusMessage ? (
                  <Text style={styles.bodyCopy}>{importGuidance.importStatusMessage}</Text>
                ) : null}
                {importGuidance.borderControlLikelihood ? (
                  <InfoLine
                    label="Border control likelihood"
                    value={`${titleCase(importGuidance.borderControlLikelihood)}${
                      importGuidance.borderControlReason
                        ? ` - ${importGuidance.borderControlReason}`
                        : ''
                    }`}
                  />
                ) : null}
                {requiredDocuments.length ? (
                  <>
                    <Text style={styles.subheading}>Required documents</Text>
                    {requiredDocuments.map((item) => (
                      <BulletRow key={item} text={item} />
                    ))}
                  </>
                ) : null}
                {labellingRequirements.length ? (
                  <>
                    <Text style={styles.subheading}>Label requirements</Text>
                    {labellingRequirements.map((item) => (
                      <BulletRow key={item} text={item} />
                    ))}
                  </>
                ) : null}
                {recommendedTests.length ? (
                  <>
                    <Text style={styles.subheading}>Recommended lab tests</Text>
                    {recommendedTests.map((item) => (
                      <BulletRow key={item} text={item} />
                    ))}
                  </>
                ) : null}
                {foodSafetyRisks.length ? (
                  <>
                    <Text style={styles.subheading}>Food safety risks</Text>
                    {foodSafetyRisks.map((item, index) => (
                      <View key={`${item.risk}-${index}`} style={styles.distinctionCard}>
                        <View style={styles.sectionHeader}>
                          <Text style={styles.distinctionHeading}>{item.risk}</Text>
                          <View style={styles.statusPill}>
                            <Text style={styles.statusPillText}>{titleCase(item.level)}</Text>
                          </View>
                        </View>
                        <Text style={styles.bodyCopy}>{item.reason}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
                {nextActions.length ? (
                  <>
                    <Text style={styles.subheading}>Next actions</Text>
                    {nextActions.map((item) => (
                      <BulletRow key={item} text={item} />
                    ))}
                  </>
                ) : null}
              </View>
            ) : null}

            {riskFlags.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Trade alerts</Text>
                {riskFlags.map((flag, index) => (
                  <View key={`${flag.label}-${index}`} style={styles.distinctionCard}>
                    <Text style={styles.distinctionHeading}>{flag.label}</Text>
                    {flag.details ? <Text style={styles.bodyCopy}>{flag.details}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Legal rationale</Text>
                {!classification.requiresReview ? (
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>Verified flow</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.bodyCopy}>{legalRationale}</Text>
              {distinctions.length ? (
                <>
                  <Text style={styles.subheading}>Distinctions</Text>
                  {distinctions.map((item, index) => (
                    <View key={`${item.heading}-${index}`} style={styles.distinctionCard}>
                      <Text style={styles.distinctionHeading}>{item.heading}</Text>
                      <Text style={styles.bodyCopy}>{item.reason}</Text>
                    </View>
                  ))}
                </>
              ) : null}
              {keyFeatures.length ? (
                <>
                  <Text style={styles.subheading}>Key features</Text>
                  {keyFeatures.map((item) => (
                    <BulletRow key={item} text={item} />
                  ))}
                </>
              ) : null}
              {notes ? (
                <>
                  <Text style={styles.subheading}>Notes</Text>
                  <Text style={styles.bodyCopy}>{notes}</Text>
                </>
              ) : null}
            </View>

            {classification.requiresReview ? (
              <View style={styles.warningCard}>
                <ShieldAlert color={colors.warning} size={18} />
                <Text style={styles.warningText}>
                  This classification needs clarification before it should be treated as customs-ready.
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.deleteButton, deleteMutation.isPending && styles.deleteButtonDisabled]}
              onPress={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 color={colors.danger} size={16} />
              <Text style={styles.deleteButtonText}>
                {deleteMutation.isPending ? 'Deleting classification...' : 'Delete classification'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function CodeSummaryCard({
  badgeLabel,
  code,
  market,
  status,
  score,
  isPlaceholder,
  canCopy,
  onCopy,
}: {
  badgeLabel: string;
  code: string;
  market: string;
  status: string;
  score: string;
  isPlaceholder: boolean;
  canCopy: boolean;
  onCopy: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <View style={styles.codeCard}>
      <View style={styles.codeCardHeader}>
        <View style={styles.codeBadge}>
          <Bot color={colors.textSecondary} size={13} />
          <Text style={styles.codeBadgeText}>{badgeLabel}</Text>
        </View>
        <Pressable
          style={[styles.copyButton, !canCopy && styles.copyButtonDisabled]}
          disabled={!canCopy}
          onPress={() => {
            void onCopy().then(() => setCopied(true));
          }}
        >
          {copied ? <Check color={colors.text} size={17} /> : <Copy color={colors.text} size={17} />}
        </Pressable>
      </View>

      <Text style={styles.codeCardLabel}>Proposed HS/CN Code</Text>
      <Text
        style={[styles.codeHeroValue, isPlaceholder && styles.codeHeroValuePlaceholder]}
        numberOfLines={2}
      >
        {code}
      </Text>

      {isPlaceholder ? (
        <Text style={styles.codeHeroHint}>
          Add clearer product details or answer the question below to narrow down the code.
        </Text>
      ) : null}

      <View style={styles.codeFooter}>
        <View style={styles.codeFooterPill}>
          <Text style={styles.codeFooterLabel}>Market</Text>
          <Text style={styles.codeFooterValue}>{market}</Text>
        </View>
        <View style={styles.codeFooterPill}>
          <Text style={styles.codeFooterLabel}>Status</Text>
          <Text style={styles.codeFooterValue}>{status}</Text>
        </View>
        <View style={styles.codeFooterPill}>
          <Text style={styles.codeFooterLabel}>Match</Text>
          <Text style={styles.codeFooterValue}>{score}</Text>
        </View>
      </View>
    </View>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricLine}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function DetailsGrid({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <View style={styles.detailsGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.detailItem}>
          <Text style={styles.detailLabel}>{item.label}</Text>
          <Text style={styles.detailValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function BulletRow({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bullet} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function textFromUnknown(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string' && item.trim().length > 0) return item;
      if (item && typeof item === 'object') {
        const label =
          textFromUnknown((item as Record<string, unknown>).label) ||
          textFromUnknown((item as Record<string, unknown>).name) ||
          textFromUnknown((item as Record<string, unknown>).title) ||
          textFromUnknown((item as Record<string, unknown>).reason);
        return label;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function normalizeDistinctions(value: unknown): { heading: string; reason: string }[] {
  if (typeof value === "string" && value.trim().length > 0) {
    return [{ heading: 'Distinction', reason: value }];
  }

  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const heading =
        textFromUnknown(record.heading) ||
        textFromUnknown(record.title) ||
        'Distinction';
      const reason =
        textFromUnknown(record.reason) ||
        textFromUnknown(record.description) ||
        textFromUnknown(record.summary);

      if (!reason) return null;
      return { heading, reason };
    })
    .filter((item): item is { heading: string; reason: string } => Boolean(item));
}

function normalizeFoodSafetyRisks(
  value: unknown,
): { risk: string; level: string; reason: string }[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const risk = textFromUnknown(record.risk);
      const level = textFromUnknown(record.level) || 'MEDIUM';
      const reason = textFromUnknown(record.reason);

      if (!risk || !reason) return null;
      return { risk, level, reason };
    })
    .filter((item): item is { risk: string; level: string; reason: string } => Boolean(item));
}

function normalizeRiskFlags(value: unknown): { label: string; details?: string }[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const label =
        textFromUnknown(record.label) ||
        textFromUnknown(record.riskType) ||
        textFromUnknown(record.type);
      if (!label) return null;
      return {
        label,
        details: textFromUnknown(record.details) || undefined,
      };
    })
    .filter((item): item is { label: string; details: string | undefined } => Boolean(item));
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSummaryDisplayCode(input: {
  market?: string | null;
  cnCode?: string | null;
  htsCode?: string | null;
  hsCode?: string | null;
}) {
  const market = String(input.market || '').toUpperCase();
  if (market === 'EU') {
    return input.cnCode || normalizeCodeDigits(input.htsCode).slice(0, 8) || input.hsCode || null;
  }

  return getPreferredClassificationCode({
    cnCode: input.cnCode,
    htsCode: input.htsCode,
    hsCode: input.hsCode,
  });
}

function replaceClassificationInCollectionCache(
  cache: unknown,
  updated: ClassificationRecord,
) {
  if (!cache || typeof cache !== 'object') return cache;
  const value = cache as Record<string, unknown>;

  if (Array.isArray(value.pages)) {
    const pages = (value.pages as unknown[]).map((page) => {
      if (!page || typeof page !== 'object') return page;
      const pageRecord = page as Record<string, unknown>;
      if (!Array.isArray(pageRecord.items)) return page;
      return {
        ...pageRecord,
        items: (pageRecord.items as unknown[]).map((item) =>
          item && typeof item === 'object' && (item as ClassificationRecord).id === updated.id
            ? updated
            : item,
        ),
      };
    });
    return { ...value, pages } as InfiniteData<CursorPaginatedResponse<ClassificationRecord>>;
  }

  if (Array.isArray(value.items)) {
    return {
      ...value,
      items: (value.items as unknown[]).map((item) =>
        item && typeof item === 'object' && (item as ClassificationRecord).id === updated.id
          ? updated
          : item,
      ),
    } as CursorPaginatedResponse<ClassificationRecord>;
  }

  return cache;
}

function removeClassificationFromCollectionCache(cache: unknown, deletedId: string) {
  if (!cache || typeof cache !== 'object') return cache;
  const value = cache as Record<string, unknown>;

  if (Array.isArray(value.pages)) {
    const pages = (value.pages as unknown[]).map((page) => {
      if (!page || typeof page !== 'object') return page;
      const pageRecord = page as Record<string, unknown>;
      if (!Array.isArray(pageRecord.items)) return page;
      return {
        ...pageRecord,
        items: (pageRecord.items as unknown[]).filter(
          (item) =>
            !item ||
            typeof item !== 'object' ||
            (item as ClassificationRecord).id !== deletedId,
        ),
      };
    });
    return { ...value, pages } as InfiniteData<CursorPaginatedResponse<ClassificationRecord>>;
  }

  if (Array.isArray(value.items)) {
    return {
      ...value,
      items: (value.items as unknown[]).filter(
        (item) =>
          !item ||
          typeof item !== 'object' ||
          (item as ClassificationRecord).id !== deletedId,
      ),
    } as CursorPaginatedResponse<ClassificationRecord>;
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
    paddingBottom: 48,
  },
  topBar: {
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  brand: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  centeredCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  centeredText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    padding: 22,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  reference: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  productName: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  codeValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  codeDivider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: 14,
  },
  infoLine: {
    paddingVertical: 9,
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
    fontSize: 15,
    fontWeight: '600',
  },
  metricLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  codeCard: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  codeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  codeBadgeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  copyButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  copyButtonDisabled: {
    opacity: 0.45,
  },
  codeCardLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  codeHeroValue: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  codeHeroValuePlaceholder: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: 0,
    maxWidth: '85%',
    marginBottom: 10,
  },
  codeHeroHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    maxWidth: '88%',
  },
  codeFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  codeFooterPill: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  codeFooterLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  codeFooterValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  reviewCard: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.accentStrong,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  reviewQuestion: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  reviewExplanation: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  reviewOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reviewOption: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reviewOptionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  reviewOptionTextSelected: {
    color: '#FFFFFF',
  },
  reviewInput: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  reviewBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  primaryReviewButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryReviewButtonDisabled: {
    opacity: 0.45,
  },
  primaryReviewButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  detailsGrid: {
    gap: 14,
  },
  detailItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    paddingBottom: 12,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 5,
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusPill: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 12,
  },
  bodyCopy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  distinctionCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  distinctionHeading: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  subheading: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  secondaryPrimaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
  },
  secondaryPrimaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  warningCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 14,
  },
  warningText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  deleteButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#F2C7CB',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
});
