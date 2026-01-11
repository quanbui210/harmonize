"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, MessageSquare, FileText, Sparkles, ChevronDown, ChevronUp, Menu } from "lucide-react";
import { askComplianceQuestionAction } from "@/server/actions/compliance-chat";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const EXAMPLE_QUESTIONS = [
  { question: "What is CN code 8806 00 00?", category: "CN Code" },
  { question: "How does GRI 1 work?", category: "GRI Rules" },
  { question: "What is GRI 3 about sets?", category: "GRI Rules" },
  { question: "What are the notes for Chapter 88?", category: "Chapter Notes" },
  { question: "What is the difference between heading 8806 and 9503?", category: "Classification" },
  { question: "What are end-use arrangements?", category: "Special Provisions" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    sectionPath: string;
    excerpt: string;
    pageStart?: number;
    pageEnd?: number;
  }>;
}

type ComplianceChatProps = {
  organizationId: string;
  userId: string;
  sessionId?: string;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    sources?: Array<{
      sectionPath: string;
      excerpt: string;
      pageStart?: number;
      pageEnd?: number;
    }>;
    createdAt: Date;
  }>;
  onMenuClick?: () => void;
};

export function ComplianceChat({ organizationId, userId, sessionId: initialSessionId, initialMessages, onMenuClick }: ComplianceChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialMessages) {
      return initialMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        sources: msg.sources,
      }));
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(initialSessionId);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (initialSessionId && initialMessages) {
      setCurrentSessionId(initialSessionId);
    }
  }, [initialSessionId, initialMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const queryText = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      const result = await askComplianceQuestionAction({
        query: queryText,
        sessionId: currentSessionId,
        organizationId,
        userId,
      });
      
      setCurrentSessionId(result.sessionId);
      
      // Navigate to the session URL if this is a new session
      if (!currentSessionId) {
        router.push(`/compliance-chat/${result.sessionId}`);
      }
      
      const assistantMessage: Message = {
        role: "assistant",
        content: result.answer,
        sources: result.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (question: string) => {
    setInput(question);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="hidden lg:flex"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Compliance Q&A</h1>
            <p className="text-xs text-muted-foreground">
              Ask questions about EU customs regulations, CN codes, and GRI rules
            </p>
          </div>
        </div>
      </div>

      {/* Messages Container - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-blue-50 p-4 mb-6">
                <Sparkles className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Ask about EU Customs Regulations</h2>
              <p className="text-sm text-muted-foreground mb-8 max-w-md text-center">
                I can help you understand CN codes, GRI rules, chapter notes, and classification guidance from Regulation (EU) 2021/1832.
              </p>

              <div className="w-full max-w-2xl space-y-3">
                <p className="text-xs font-medium text-muted-foreground text-center">Example Questions:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EXAMPLE_QUESTIONS.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleExampleClick(example.question)}
                      className="group rounded-lg border bg-card p-3 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-foreground group-hover:text-blue-700">
                          {example.question}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {example.category}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] space-y-2 rounded-lg px-4 py-3",
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-muted",
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 text-sm leading-relaxed">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-sm">{children}</li>,
                            h1: ({ children }) => <h1 className="mb-2 text-base font-semibold">{children}</h1>,
                            h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold">{children}</h2>,
                            h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
                            code: ({ children }) => (
                              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{children}</code>
                            ),
                            pre: ({ children }) => (
                              <pre className="my-2 overflow-x-auto rounded bg-muted p-2 text-xs">{children}</pre>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                    )}

                    {/* Sources - Collapsible */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <button
                          onClick={() => {
                            setExpandedSources((prev) => {
                              const next = new Set(prev);
                              if (next.has(idx)) {
                                next.delete(idx);
                              } else {
                                next.add(idx);
                              }
                              return next;
                            });
                          }}
                          className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition"
                        >
                          <span>Sources ({message.sources.length})</span>
                          {expandedSources.has(idx) ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                        {expandedSources.has(idx) && (
                          <div className="mt-2 space-y-2">
                            {message.sources.map((source, sourceIdx) => (
                              <div
                                key={sourceIdx}
                                className="rounded border bg-background/50 p-2 text-xs"
                              >
                                <div className="flex items-start gap-2">
                                  <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                                  <div className="flex-1 space-y-1">
                                    <p className="font-mono text-[10px] text-muted-foreground">
                                      {source.sectionPath}
                                    </p>
                                    {source.pageStart && (
                                      <p className="text-[10px] text-muted-foreground">
                                        Pages {source.pageStart}
                                        {source.pageEnd && source.pageEnd !== source.pageStart
                                          ? `-${source.pageEnd}`
                                          : ""}
                                      </p>
                                    )}
                                    <p className="text-muted-foreground">
                                      {source.excerpt}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <span className="text-xs font-medium">You</span>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Searching regulations...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="border-t bg-background">
        <form onSubmit={handleSubmit} className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about CN codes, GRI rules, chapter notes..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Powered by Regulation (EU) 2021/1832 • Answers are based on official legal sources
          </p>
        </form>
      </div>
    </div>
  );
}
