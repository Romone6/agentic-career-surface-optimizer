import { z } from 'zod';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@ancso/core';
import { Logger } from './logger';

// Request schema for validation
const OpenRouterRequestSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant', 'function']),
      content: z.string(),
    })
  ),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  response_format: z
    .object({
      type: z.enum(['json_object', 'text']),
    })
    .optional(),
});

// Response schema for validation
const OpenRouterResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: z.object({
        role: z.string(),
        content: z.string(),
      }),
      finish_reason: z.string(),
    })
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
});

export type OpenRouterRequest = z.infer<typeof OpenRouterRequestSchema>;
export type OpenRouterResponse = z.infer<typeof OpenRouterResponseSchema>;

export class OpenRouterClient {
  private client: AxiosInstance;
  private config;
  private logger: Logger;
  private cacheDir: string;

  constructor() {
    this.config = getConfig();
    this.logger = new Logger('OpenRouterClient');
    this.cacheDir = this.config.CACHE_DIR;

    this.client = axios.create({
      baseURL: this.config.OPENROUTER_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.OPENROUTER_API_KEY}`,
      },
    });

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private generateCacheKey(request: OpenRouterRequest): string {
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(request))
      .digest('hex');
    return `${request.model}_${requestHash}`;
  }

  private getCachePath(cacheKey: string): string {
    return path.join(this.cacheDir, `${cacheKey}.json`);
  }

  private async getFromCache(cacheKey: string): Promise<OpenRouterResponse | null> {
    const cachePath = this.getCachePath(cacheKey);
    
    try {
      if (fs.existsSync(cachePath)) {
        const cachedData = fs.readFileSync(cachePath, 'utf8');
        const parsedData = JSON.parse(cachedData);
        const validation = OpenRouterResponseSchema.safeParse(parsedData);
        
        if (validation.success) {
          this.logger.debug(`Cache hit for key: ${cacheKey}`);
          return validation.data;
        }
      }
    } catch (error) {
      this.logger.error(`Cache read error for key ${cacheKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return null;
  }

  private async saveToCache(cacheKey: string, response: OpenRouterResponse): Promise<void> {
    const cachePath = this.getCachePath(cacheKey);
    
    try {
      fs.writeFileSync(cachePath, JSON.stringify(response, null, 2));
      this.logger.debug(`Saved to cache: ${cacheKey}`);
    } catch (error) {
      this.logger.error(`Cache write error for key ${cacheKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chatCompletion(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    // Validate request
    const validation = OpenRouterRequestSchema.safeParse(request);
    if (!validation.success) {
      throw new Error(`Invalid OpenRouter request: ${validation.error.message}`);
    }

    const validatedRequest = validation.data;
    const cacheKey = this.generateCacheKey(validatedRequest);

    // Try to get from cache first
    const cachedResponse = await this.getFromCache(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Apply defaults from config
    const requestWithDefaults = {
      ...validatedRequest,
      max_tokens: validatedRequest.max_tokens || this.config.OPENROUTER_MAX_TOKENS,
      temperature: validatedRequest.temperature || this.config.OPENROUTER_TEMPERATURE,
      response_format: this.config.OPENROUTER_USE_STRUCTURED_OUTPUT
        ? { type: 'json_object' }
        : undefined,
    };

    try {
      this.logger.info(`Making OpenRouter API call to model: ${requestWithDefaults.model}`);

      const config: AxiosRequestConfig = {
        timeout: 30000, // 30 seconds timeout
      };

      const response: AxiosResponse = await this.client.post('/chat/completions', requestWithDefaults, config);

      // Validate response
      const responseValidation = OpenRouterResponseSchema.safeParse(response.data);
      if (!responseValidation.success) {
        throw new Error(`Invalid OpenRouter response: ${responseValidation.error.message}`);
      }

      const result = responseValidation.data;

      // Cache the response
      await this.saveToCache(cacheKey, result);

      this.logger.info(`OpenRouter API call successful. Used ${result.usage?.total_tokens || 0} tokens.`);

      return result;
    } catch (error) {
      this.logger.error(`OpenRouter API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Try fallback model if available
      if (validatedRequest.model !== this.config.OPENROUTER_FALLBACK_MODEL) {
        this.logger.info(`Trying fallback model: ${this.config.OPENROUTER_FALLBACK_MODEL}`);
        return this.chatCompletion({
          ...validatedRequest,
          model: this.config.OPENROUTER_FALLBACK_MODEL,
        });
      }

      throw new Error(`OpenRouter API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chatCompletionWithFallback(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    try {
      return await this.chatCompletion(request);
    } catch (error) {
      this.logger.error(`All OpenRouter attempts failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that returns structured JSON output.',
      },
      {
        role: 'user',
        content: `${prompt}\n\nContext: ${JSON.stringify(context, null, 2)}`,
      },
    ];

    const response = await this.chatCompletion({
      model: this.config.OPENROUTER_DEFAULT_MODEL,
      messages,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;

    try {
      const parsed = JSON.parse(content);
      const validation = schema.safeParse(parsed);

      if (!validation.success) {
        throw new Error(`Structured output validation failed: ${validation.error.message}`);
      }

      return validation.data;
    } catch (error) {
      this.logger.error(`Failed to parse structured output: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to generate structured output: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}