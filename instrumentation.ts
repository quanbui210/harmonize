/**
 * Next.js Instrumentation File
 * Automatically loaded by Next.js to initialize OpenTelemetry and Langfuse
 * 
 * This file runs once when the server starts, before any other code
 */

export async function register() {
  // Only run on server-side
  if (typeof window === "undefined") {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { LangfuseSpanProcessor } = await import("@langfuse/otel");

    // Check if Langfuse is configured
    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      const sdk = new NodeSDK({
        spanProcessors: [
          new LangfuseSpanProcessor({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: process.env.LANGFUSE_SECRET_KEY,
            baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
          }),
        ],
      });

      sdk.start();
      console.log("[Langfuse] OpenTelemetry instrumentation started");
    } else {
      console.warn(
        "[Langfuse] Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY. OpenTelemetry tracing disabled.",
      );
    }
  }
}




