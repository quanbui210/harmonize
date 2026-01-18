/**
 * OpenAI client wrapper with Langfuse tracing
 * Automatically traces all OpenAI API calls when Langfuse is configured
 * 
 * Uses @langfuse/openai's observeOpenAI function which wraps OpenAI client
 * with OpenTelemetry instrumentation. The instrumentation.ts file initializes
 * the OpenTelemetry SDK with LangfuseSpanProcessor.
 */

import OpenAI from "openai";

// Try to import observeOpenAI from @langfuse/openai
let observeOpenAI: ((client: OpenAI) => OpenAI) | null = null;
try {
  const langfuseModule = require("@langfuse/openai");
  observeOpenAI = langfuseModule.observeOpenAI || null;
} catch {
  // @langfuse/openai not available, will fall back to regular OpenAI
}

/**
 * Create an OpenAI client with Langfuse tracing enabled
 * Falls back to regular OpenAI client if Langfuse is not configured
 * 
 * @param options - OpenAI client options
 * @param traceOptions - Optional Langfuse trace metadata (currently unused but kept for API compatibility)
 */
export function createTracedOpenAIClient(
  options?: ConstructorParameters<typeof OpenAI>[0],
  traceOptions?: {
    name?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }
): OpenAI {
  // Create base OpenAI client
  const client = new OpenAI({
    apiKey: options?.apiKey || process.env.OPENAI_API_KEY,
    ...options,
  });

  // If observeOpenAI is available and Langfuse is configured, wrap the client
  // This will automatically instrument all OpenAI calls via OpenTelemetry
  if (observeOpenAI && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
    return observeOpenAI(client);
  }

  // Return unwrapped client if Langfuse is not configured
  return client;
}

/**
 * Create a traced OpenAI client for a specific feature/operation
 * This is a convenience function that sets appropriate metadata
 */
export function createFeatureOpenAIClient(
  feature: string,
  options?: {
    userId?: string;
    organizationId?: string;
    productId?: string;
    classificationId?: string;
    metadata?: Record<string, unknown>;
  }
): OpenAI {
  return createTracedOpenAIClient(
    undefined,
    {
      name: feature,
      userId: options?.userId,
      sessionId: options?.organizationId || options?.classificationId,
      metadata: {
        feature,
        ...(options?.organizationId && { organizationId: options.organizationId }),
        ...(options?.productId && { productId: options.productId }),
        ...(options?.classificationId && { classificationId: options.classificationId }),
        ...options?.metadata,
      },
    }
  );
}

