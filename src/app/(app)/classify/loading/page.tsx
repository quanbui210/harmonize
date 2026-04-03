"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingScreen } from "@/components/ui/loading-screen";
import {
  answerRefinementQuestionAction,
  searchAndClassifyAction,
} from "@/server/actions/classification-search";

type ClassifyFlow = "manual" | "scan" | "refinement";

export default function ClassificationLoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasStartedRef = useRef(false);

  const flow = (searchParams.get("flow") || "manual") as ClassifyFlow;
  const payloadKey = searchParams.get("payloadKey");

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const run = async () => {
      if (!payloadKey || typeof window === "undefined") {
        router.replace("/classify?classificationError=Missing%20classification%20payload");
        return;
      }

      const payloadRaw = window.sessionStorage.getItem(payloadKey);
      window.sessionStorage.removeItem(payloadKey);

      if (!payloadRaw) {
        router.replace("/classify?classificationError=Classification%20payload%20expired.%20Please%20retry.");
        return;
      }

      try {
        if (flow === "refinement") {
          const payload = JSON.parse(payloadRaw) as {
            classificationId: string;
            answer: string;
            field: string;
          };

          const updated = await answerRefinementQuestionAction(payload);
          router.replace(`/classify/${updated.classificationId}`);
          return;
        }

        const payload = JSON.parse(payloadRaw) as Parameters<typeof searchAndClassifyAction>[0];
        const result = await searchAndClassifyAction(payload);

        if (!result.needsRefinement) {
          router.replace(`/classify/${result.classificationId}`);
          return;
        }

        const refinementKey = `classify_refinement_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        window.sessionStorage.setItem(refinementKey, JSON.stringify(result));
        router.replace(`/classify?refinementKey=${encodeURIComponent(refinementKey)}`);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to classify product. Please try again.";
        router.replace(`/classify?classificationError=${encodeURIComponent(message)}`);
      }
    };

    void run();
  }, [flow, payloadKey, router]);

  const message =
    flow === "refinement" ? "Refining Classification" : "Classifying Product";
  const subMessage =
    flow === "refinement"
      ? "Applying your answer and finalizing the best code."
      : "This can take up to 30-90 seconds depending on product complexity.";

  return (
    <LoadingScreen
      variant="fullscreen"
      message={message}
      subMessage={subMessage}
      steps={[
        "Analyzing product details",
        "Checking legal classification rules",
        "Generating decision rationale",
        "Preparing final result",
      ]}
    />
  );
}
