"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { generateDossierAction } from "@/server/actions/dossier";

export default function DossierLoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasStartedRef = useRef(false);

  const classificationId = searchParams.get("classificationId");

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const run = async () => {
      if (!classificationId) {
        router.replace("/classify?classificationError=Missing%20classification%20id%20for%20dossier");
        return;
      }

      try {
        await generateDossierAction({ classificationId });
        router.replace(`/classify/${classificationId}/dossier`);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to generate dossier. Please try again.";
        router.replace(
          `/classify/${classificationId}/dossier?dossierError=${encodeURIComponent(message)}`,
        );
      }
    };

    void run();
  }, [classificationId, router]);

  return (
    <LoadingScreen
      variant="fullscreen"
      message="Generating Defense Dossier"
      subMessage="Preparing legal rationale, source citations, and audit-ready document."
      steps={[
        "Collecting classification evidence",
        "Compiling legal rationale",
        "Formatting dossier document",
        "Finalizing preview and export",
      ]}
    />
  );
}
