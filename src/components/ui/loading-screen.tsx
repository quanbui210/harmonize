"use client";

import { Scale } from "lucide-react";
import { useEffect, useState } from "react";

type LoadingScreenProps = {
  message?: string;
  subMessage?: string;
  variant?: "fullscreen" | "overlay";
  steps?: string[];
};

export function LoadingScreen({ 
  message = "Loading", 
  subMessage,
  variant = "fullscreen",
  steps = [],
}: LoadingScreenProps = {}) {
  const [progress, setProgress] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    // Simulate progress animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev; // Cap at 90% until actual load completes
        return prev + Math.random() * 15;
      });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!steps.length) return;
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % steps.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [steps]);

  const containerClassName =
    variant === "overlay"
      ? "fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center"
      : "min-h-screen bg-background flex items-center justify-center";

  return (
    <div className={containerClassName}>
      <div className="flex flex-col items-center gap-6">
        {/* Minimal Icon Animation */}
        <div className="relative">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-spin" style={{ animationDuration: '3s', width: '80px', height: '80px', margin: '-8px' }}></div>
          
          {/* Inner icon container */}
          <div className="relative rounded-full bg-primary/5 p-4">
            <Scale className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Minimal Loading Message */}
        <div className="text-center space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {message}
          </p>
          {subMessage && (
            <p className="text-xs text-muted-foreground/60">
              {subMessage}
            </p>
          )}
          {steps.length > 0 && (
            <p className="text-xs text-muted-foreground/80">
              {steps[activeStepIndex]}
            </p>
          )}
        </div>

        {/* Minimal Progress Indicator */}
        <div className="w-32 space-y-1.5">
          <div className="h-0.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
