"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatSessionsSidebar } from "./chat-sessions-sidebar";
import { ComplianceChat } from "./compliance-chat";

type ComplianceChatLayoutProps = {
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
};

export function ComplianceChatLayout({
  organizationId,
  userId,
  sessionId,
  initialMessages,
}: ComplianceChatLayoutProps) {
  // Sidebar open by default on desktop, closed on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // On mount, check if we're on desktop and open sidebar
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  return (
    <div className="relative flex h-[calc(100vh-4rem-1.5rem)] w-full -m-6 lg:h-[calc(100vh-4rem-2.5rem)] lg:-m-10">
      {/* Menu Button - Always visible */}
      <div className="absolute left-4 top-4 z-50 lg:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsSidebarOpen(true)}
          className="bg-background shadow-md"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Sidebar */}
      <ChatSessionsSidebar
        organizationId={organizationId}
        userId={userId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <ComplianceChat
          organizationId={organizationId}
          userId={userId}
          sessionId={sessionId}
          initialMessages={initialMessages}
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      </div>
    </div>
  );
}

