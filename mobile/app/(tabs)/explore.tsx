import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, History, MessageSquarePlus, MessageSquare, X, Plus, FileBadge2, Files } from 'lucide-react-native';
import { ApiClient } from '@/lib/api-client';
import type { ChatMessageRecord } from '@/types/api';
import { lightTheme } from '@/constants/mobile-theme';

const { colors, radius } = lightTheme;

const QUICK_PROMPTS = [
  'What documents are usually needed for EU import clearance?',
  'How should I interpret CN code notes and GRI rules?',
  'What makes a strong customs defense dossier?',
];

type UiMessage = ChatMessageRecord & { pending?: boolean };

export default function AssistScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [selectedClassifications, setSelectedClassifications] = useState<Set<string>>(new Set());
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());

  const sessionsQuery = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => ApiClient.listChatSessions(12),
    staleTime: 45_000,
  });

  const sessionQuery = useQuery({
    queryKey: ['chat-session', sessionId],
    queryFn: () => ApiClient.getChatSession(sessionId!),
    enabled: !!sessionId,
    staleTime: 10_000,
  });

  const classificationsQuery = useQuery({
    queryKey: ['chat-context-classifications'],
    queryFn: () => ApiClient.listClassifications({ limit: 10 }),
    enabled: isContextOpen,
  });

  const labelsQuery = useQuery({
    queryKey: ['chat-context-labels'],
    queryFn: () => ApiClient.listLabels({ limit: 10 }),
    enabled: isContextOpen,
  });

  const [shouldAutoSelectSession, setShouldAutoSelectSession] = useState(true);

  useEffect(() => {
    if (shouldAutoSelectSession && !sessionId && sessionsQuery.data?.length) {
      setSessionId(sessionsQuery.data[0].id);
    }
  }, [sessionId, sessionsQuery.data, shouldAutoSelectSession]);

  useEffect(() => {
    if (sessionQuery.data?.messages) {
      setMessages(sessionQuery.data.messages);
    }
  }, [sessionQuery.data]);

  const canSend = draft.trim().length > 0 && !isSending;
  const selectedSessionTitle = useMemo(() => {
    if (!sessionId) return 'New session';
    const selected = sessionsQuery.data?.find((item) => item.id === sessionId);
    return selected?.title || 'Current session';
  }, [sessionId, sessionsQuery.data]);

  const sendMessage = async (question?: string) => {
    const query = (question ?? draft).trim();
    if (!query || isSending) {
      return;
    }

    const now = new Date().toISOString();
    const userMessage: UiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      createdAt: now,
    };
    const pendingAssistant: UiMessage = {
      id: `assistant-pending-${Date.now()}`,
      role: 'assistant',
      content: 'Thinking...',
      createdAt: now,
      pending: true,
    };

    setDraft('');
    setIsSending(true);
    setMessages((prev) => [...prev, userMessage, pendingAssistant]);

    try {
      const response = await ApiClient.sendChatMessage(query, sessionId ?? undefined, {
        classificationIds: Array.from(selectedClassifications),
        labelIds: Array.from(selectedLabels),
      });
      setSessionId(response.sessionId);
      setMessages((prev) => [
        ...prev.filter((item) => !item.pending),
        {
          id: response.messageId,
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          createdAt: new Date().toISOString(),
        },
      ]);
      void sessionsQuery.refetch();
    } catch (error) {
      setMessages((prev) => [
        ...prev.filter((item) => !item.pending),
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'I could not answer right now. Please try again.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleNewChat = () => {
    setShouldAutoSelectSession(false);
    setSessionId(null);
    setMessages([]);
    setDraft('');
    setSelectedClassifications(new Set());
    setSelectedLabels(new Set());
  };

  const toggleClassification = (id: string) => {
    const next = new Set(selectedClassifications);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedClassifications(next);
  };

  const toggleLabel = (id: string) => {
    const next = new Set(selectedLabels);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLabels(next);
  };

  const resolveProductName = (id: string, type: 'classification' | 'label') => {
    if (type === 'classification') {
      const item = classificationsQuery.data?.items?.find((i: any) => i.id === id);
      return item?.product?.name || 'Classified product';
    } else {
      const item = labelsQuery.data?.items?.find((i: any) => i.id === id);
      return item?.productId ? `${item.productId} Label` : `Label ${id.slice(-4).toUpperCase()}`;
    }
  };

  const hasContext = selectedClassifications.size > 0 || selectedLabels.size > 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 66}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Assist</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {selectedSessionTitle}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setIsHistoryOpen(true)} style={styles.iconButton}>
              <History color={colors.text} size={20} />
            </Pressable>
            <Pressable onPress={handleNewChat} style={styles.iconButton}>
              <MessageSquarePlus color={colors.text} size={20} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {sessionQuery.isLoading && sessionId ? (
            <ActivityIndicator color={colors.primary} />
          ) : messages.length === 0 ? (
            <View style={styles.emptyCard}>
              <Sparkles color={colors.textMuted} size={18} />
              <Text style={styles.emptyTitle}>Compliance assistant ready</Text>
              <Text style={styles.emptyText}>Ask about classification, labels, duty, or dossier risk.</Text>
            </View>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                {message.role === 'assistant' ? (
                  <MarkdownText
                    content={message.content}
                    textStyle={[styles.messageText, styles.assistantBubbleText]}
                  />
                ) : (
                  <Text style={[styles.messageText, styles.userBubbleText]}>{message.content}</Text>
                )}
                {!!message.sources?.length && (
                  <Text style={styles.sourcesText}>Sources: {message.sources.length}</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>

        <ScrollView
          style={styles.promptsRowWrap}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.promptsRow}
        >
          {QUICK_PROMPTS.map((prompt) => (
            <Pressable key={prompt} style={styles.promptChip} onPress={() => void sendMessage(prompt)}>
              <Text style={styles.promptChipText}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.composerContainer}>
          {hasContext && (
            <View style={styles.contextChipsRow}>
              {Array.from(selectedClassifications).map(id => (
                <View key={`c-${id}`} style={styles.contextChip}>
                  <Text style={styles.contextChipText} numberOfLines={1}>{resolveProductName(id, 'classification')}</Text>
                  <Pressable onPress={() => toggleClassification(id)} hitSlop={10}>
                    <X color={colors.textSecondary} size={12} />
                  </Pressable>
                </View>
              ))}
              {Array.from(selectedLabels).map(id => (
                <View key={`l-${id}`} style={styles.contextChip}>
                  <Text style={styles.contextChipText} numberOfLines={1}>{resolveProductName(id, 'label')}</Text>
                  <Pressable onPress={() => toggleLabel(id)} hitSlop={10}>
                    <X color={colors.textSecondary} size={12} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <View style={styles.composer}>
            <Pressable style={styles.attachButton} onPress={() => setIsContextOpen(true)}>
              <Plus color={hasContext ? colors.primary : colors.textMuted} size={24} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask compliance question..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              maxLength={1200}
            />
            <Pressable
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              disabled={!canSend}
              onPress={() => void sendMessage()}
            >
              <Text style={styles.sendButtonText}>{isSending ? 'Sending' : 'Send'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={isContextOpen} transparent animationType="fade" onRequestClose={() => setIsContextOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setIsContextOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuTitle}>Attach Records</Text>
                <Text style={styles.contextModalSubtitle}>Select records to help the assistant provide specific, grounded answers.</Text>
              </View>
              <Pressable onPress={() => setIsContextOpen(false)} style={styles.menuCloseBtn}>
                <X color={colors.textMuted} size={20} />
              </Pressable>
            </View>
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              <Text style={styles.contextSectionTitle}>Recent Classifications</Text>
              {classificationsQuery.data?.items?.map((item) => {
                const isSelected = selectedClassifications.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.contextListItem, isSelected && styles.contextListItemActive]}
                    onPress={() => toggleClassification(item.id)}
                  >
                    <Files color={isSelected ? colors.primary : colors.textMuted} size={18} />
                    <View style={styles.contextListCopy}>
                      <Text style={styles.contextListTitle} numberOfLines={1}>
                        {item.product?.name || 'Unknown Product'}
                      </Text>
                      <Text style={styles.contextListSub}>
                        {item.cnCode || item.htsCode || 'No code'} • {item.confidence ? `${item.confidence}%` : 'Review needed'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {classificationsQuery.data?.items?.length === 0 && (
                <Text style={styles.historyEmpty}>No classifications found</Text>
              )}

              <Text style={[styles.contextSectionTitle, { marginTop: 16 }]}>Recent Labels</Text>
              {labelsQuery.data?.items?.map((item) => {
                const isSelected = selectedLabels.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.contextListItem, isSelected && styles.contextListItemActive]}
                    onPress={() => toggleLabel(item.id)}
                  >
                    <FileBadge2 color={isSelected ? colors.primary : colors.textMuted} size={18} />
                    <View style={styles.contextListCopy}>
                      <Text style={styles.contextListTitle} numberOfLines={1}>
                        {item.productId ? `${item.productId} Label` : `Label ${item.id.slice(-4).toUpperCase()}`}
                      </Text>
                      <Text style={styles.contextListSub}>
                        Score: {item.complianceScore}%
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {labelsQuery.data?.items?.length === 0 && (
                <Text style={styles.historyEmpty}>No labels found</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isHistoryOpen} transparent animationType="fade" onRequestClose={() => setIsHistoryOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setIsHistoryOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Chat History</Text>
              <Pressable onPress={() => setIsHistoryOpen(false)} style={styles.menuCloseBtn}>
                <X color={colors.textMuted} size={20} />
              </Pressable>
            </View>
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {sessionsQuery.data?.map((session) => (
                <Pressable
                  key={session.id}
                  style={[styles.historyItem, session.id === sessionId && styles.historyItemActive]}
                  onPress={() => {
                    setShouldAutoSelectSession(true);
                    setSessionId(session.id);
                    setIsHistoryOpen(false);
                  }}
                >
                  <MessageSquare
                    color={session.id === sessionId ? '#FFFFFF' : colors.textMuted}
                    size={18}
                  />
                  <View style={styles.historyItemCopy}>
                    <Text
                      style={[
                        styles.historyItemTitle,
                        session.id === sessionId && styles.historyItemTitleActive,
                      ]}
                      numberOfLines={1}
                    >
                      {session.title || 'Untitled'}
                    </Text>
                    <Text
                      style={[
                        styles.historyItemDate,
                        session.id === sessionId && styles.historyItemTitleActive,
                      ]}
                    >
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {sessionsQuery.data?.length === 0 && (
                <Text style={styles.historyEmpty}>No past sessions found.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MarkdownText({
  content,
  textStyle,
}: {
  content: string;
  textStyle: any;
}) {
  const lines = content.split('\n');

  return (
    <View>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={`sp-${index}`} style={styles.mdSpacer} />;
        }

        if (trimmed.startsWith('### ')) {
          return (
            <Text key={`h3-${index}`} style={[textStyle, styles.mdHeading]}>
              {trimmed.replace(/^###\s+/, '')}
            </Text>
          );
        }

        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return (
            <Text key={`h2-${index}`} style={[textStyle, styles.mdHeading]}>
              {trimmed.replace(/^#{1,2}\s+/, '')}
            </Text>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <Text key={`b-${index}`} style={[textStyle, styles.mdListItem]}>
              {'\u2022 '}
              <InlineMarkdownText text={trimmed.replace(/^[-*]\s+/, '')} />
            </Text>
          );
        }

        if (/^\d+\.\s+/.test(trimmed)) {
          const matched = trimmed.match(/^(\d+)\.\s+(.*)$/);
          const number = matched?.[1] ?? '';
          const rest = matched?.[2] ?? '';
          return (
            <Text key={`n-${index}`} style={[textStyle, styles.mdListItem]}>
              {number}. <InlineMarkdownText text={rest} />
            </Text>
          );
        }

        return (
          <Text key={`p-${index}`} style={textStyle}>
            <InlineMarkdownText text={line} />
          </Text>
        );
      })}
    </View>
  );
}

function InlineMarkdownText({ text }: { text: string }) {
  const tokens = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {tokens.map((token, idx) => {
        const isBold = /^\*\*[^*]+\*\*$/.test(token);
        return (
          <Text key={`${idx}-${token}`} style={isBold ? styles.mdBold : undefined}>
            {isBold ? token.replace(/^\*\*|\*\*$/g, '') : token}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  messageBubble: {
    maxWidth: '88%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
  },
  userBubbleText: {
    color: '#FFFFFF',
  },
  assistantBubbleText: {
    color: '#0F172A',
  },
  sourcesText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
  mdHeading: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  mdListItem: {
    marginBottom: 2,
  },
  mdBold: {
    fontWeight: '700',
  },
  mdSpacer: {
    height: 6,
  },
  promptsRowWrap: {
    maxHeight: 48,
  },
  promptsRow: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    paddingTop: 4,
    alignItems: 'center',
  },
  promptChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 34,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  promptChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  composerContainer: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingBottom: 8,
  },
  contextChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 2,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  contextChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    maxWidth: 120,
  },
  composer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  sendButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.page,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  contextModalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    paddingRight: 20,
  },
  menuCloseBtn: {
    padding: 4,
  },
  historyList: {
    flexGrow: 0,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 16,
    borderRadius: radius.md,
    marginBottom: 10,
  },
  historyItemActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  historyItemCopy: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  historyItemTitleActive: {
    color: '#FFFFFF',
  },
  historyItemDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  historyEmpty: {
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: 30,
  },
  contextSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  contextListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 14,
    borderRadius: radius.md,
    marginBottom: 8,
  },
  contextListItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceRaised,
  },
  contextListCopy: {
    flex: 1,
  },
  contextListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  contextListSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
