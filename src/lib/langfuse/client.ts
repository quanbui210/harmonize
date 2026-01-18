/**
 * Langfuse client wrapper for LLM observability
 * 
 * Note: With OpenTelemetry setup (instrumentation.ts), we don't need the base Langfuse client
 * The @langfuse/openai wrapper + OpenTelemetry handles all tracing automatically
 * 
 * This file is kept for backwards compatibility but may not be needed
 */

/**
 * Check if Langfuse is configured and available
 */
export function isLangfuseEnabled(): boolean {
  return !!(
    process.env.LANGFUSE_PUBLIC_KEY && 
    process.env.LANGFUSE_SECRET_KEY
  );
}

