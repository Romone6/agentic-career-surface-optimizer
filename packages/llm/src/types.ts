import { z } from 'zod';

// Common types for LLM operations
export const GenerationOptionsSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(0).max(2).optional(),
  presencePenalty: z.number().min(0).max(2).optional(),
  stopSequences: z.array(z.string()).optional(),
});

export type GenerationOptions = z.infer<typeof GenerationOptionsSchema>;

export const CacheOptionsSchema = z.object({
  enabled: z.boolean().default(true),
  ttl: z.number().positive().optional(), // in seconds
});

export type CacheOptions = z.infer<typeof CacheOptionsSchema>;

export const LLMConfigSchema = z.object({
  defaultModel: z.string(),
  fallbackModel: z.string(),
  maxRetries: z.number().min(0).max(5).default(2),
  timeout: z.number().positive().default(30000), // in ms
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export interface LLMResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  tokensUsed?: number;
  modelUsed?: string;
  timestamp: string;
  durationMs: number;
}

export interface StructuredGenerationResult<T = any> extends LLMResult<T> {
  rawResponse?: string;
  validationErrors?: z.ZodError;
}

export interface PromptContext {
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface GenerationRequest {
  prompt: string;
  options?: GenerationOptions;
  cacheOptions?: CacheOptions;
  context?: PromptContext;
}

export interface StructuredGenerationRequest<T> extends GenerationRequest {
  schema: z.ZodSchema<T>;
}