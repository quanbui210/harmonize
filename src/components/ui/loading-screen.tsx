"use client";

import { Scale } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <div className="relative">
          <div className="rounded-full bg-primary/10 p-6">
            <Scale className="h-10 w-10 text-primary" />
          </div>
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping opacity-30" style={{ animationDuration: '2s' }}></div>
        </div>
        <div className="text-center space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Loading
          </p>
          <p className="text-2xl font-serif font-bold tracking-tight">
            Harmonize<span className="text-primary">AI</span>
          </p>
        </div>
        <div className="flex gap-2">
          <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
          <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
          <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
        </div>
      </div>
    </div>
  );
}
