"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, MessageSquare, X, Trash2, Loader2 } from "lucide-react";
import { listChatSessionsAction, deleteChatSessionAction } from "@/server/actions/compliance-chat";
import { cn } from "@/lib/utils";

/**
 * Strip markdown syntax from text for preview
 */
function stripMarkdown(text: string): string {
  return text
    // Remove bold/italic markdown (**text**, *text*, __text__, _text_)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Remove headers (# Header, ## Header, etc.)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove code blocks (```code```)
    .replace(/```[\s\S]*?```/g, "")
    // Remove inline code (`code`)
    .replace(/`([^`]+)`/g, "$1")
    // Remove links [text](url)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1")
    // Remove horizontal rules (---, ***)
    .replace(/^[-*]{3,}$/gm, "")
    // Remove list markers (-, *, +, 1.)
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Clean up extra whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ChatSession = {
  id: string;
  title: string | null;
  lastMessage: string | null;
  updatedAt: Date;
  createdAt: Date;
};

type ChatSessionsSidebarProps = {
  organizationId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
};

export function ChatSessionsSidebar({ organizationId, userId, isOpen, onClose }: ChatSessionsSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId]);

  async function loadSessions() {
    try {
      setIsLoading(true);
      const data = await listChatSessionsAction({ organizationId, userId, limit: 50 });
      setSessions(data);
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleNewChat = () => {
    router.push("/compliance-chat");
  };

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return;

    try {
      setDeletingSessionId(sessionToDelete);
      await deleteChatSessionAction({
        sessionId: sessionToDelete,
        organizationId,
        userId,
      });
      
      // If deleting the current session, redirect to new chat
      const currentSessionId = pathname.split("/").pop();
      if (currentSessionId === sessionToDelete) {
        router.push("/compliance-chat");
      }
      
      // Reload sessions
      await loadSessions();
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    } catch (error) {
      console.error("Failed to delete chat session:", error);
      alert("Failed to delete chat session. Please try again.");
    } finally {
      setDeletingSessionId(null);
    }
  };

  const currentSessionId = pathname.split("/").pop();
  const sessionToDeleteTitle = sessions.find(s => s.id === sessionToDelete)?.title || 
    sessions.find(s => s.id === sessionToDelete)?.lastMessage?.slice(0, 50) || 
    "this chat session";

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{sessionToDeleteTitle}</strong>? 
              This action cannot be undone and all messages in this session will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSessionId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deletingSessionId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSessionId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Sidebar */}
      <div className={cn(
        "flex h-full w-64 flex-col border-r bg-background transition-transform duration-200",
        isOpen 
          ? "fixed left-0 top-0 z-50 shadow-lg lg:relative lg:z-auto lg:shadow-none" 
          : "hidden lg:flex"
      )}>
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Chat History</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="lg:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="border-b p-4">
          <Button
            onClick={handleNewChat}
            className="w-full justify-start gap-2"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading chats...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No chat history yet. Start a new conversation!
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => {
              const isActive = currentSessionId === session.id || (!currentSessionId && sessions[0]?.id === session.id);
              const title = session.title || session.lastMessage?.slice(0, 50) || "New Chat";
              const isDeleting = deletingSessionId === session.id;
              
              return (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-start gap-2 rounded-lg p-3 text-sm transition hover:bg-muted",
                    isActive && "bg-muted",
                  )}
                >
                  <Link
                    href={`/compliance-chat/${session.id}`}
                    className="flex min-w-0 flex-1 items-start gap-2"
                  >
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{title}</p>
                      {session.lastMessage && (
                        <p className="truncate text-xs text-muted-foreground">
                          {stripMarkdown(session.lastMessage).slice(0, 60)}
                        </p>
                      )}
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => handleDeleteClick(e, session.id)}
                    disabled={isDeleting}
                    title="Delete chat session"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : (
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

