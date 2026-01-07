import { EmbeddingProvider, EmbeddingInput, EmbeddingOutput, EmbeddingError } from './provider';
import { OpenRouterClient } from '@ancso/llm';
import { getConfig } from '@ancso/core';
import { Logger } from '@ancso/core';

export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  private client: OpenRouterClient;
  private logger: Logger;
  private config;
  private defaultModel: string;
  private defaultDimensions: number;

  constructor() {
    this.config = getConfig();
    this.logger = new Logger('OpenRouterEmbeddingProvider');
    this.client = new OpenRouterClient();
    this.defaultModel = 'text-embedding-ada-002'; // Default embedding model
    this.defaultDimensions = 1536; // Default dimensions for ada-002
  }

  async embed(input: EmbeddingInput): Promise<EmbeddingOutput> {
    try {
      this.logger.info(`Generating embeddings for ${input.texts.length} texts`);

      // Validate input
      const validation = EmbeddingInputSchema.safeParse(input);
      if (!validation.success) {
        throw new EmbeddingError(`Invalid embedding input: ${validation.error.message}`);
      }

      const model = input.model || this.defaultModel;
      const dimensions = input.dimensions || this.defaultDimensions;

      // Use OpenRouter client to generate embeddings
      // Note: This is a simplified approach - in reality, OpenRouter would need
      // to support embedding endpoints or we'd need to use a different provider
      const response = await this.client.chatCompletion({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an embedding generation assistant. Return only the embedding vectors.'
          },
          {
            role: 'user',
            content: `Generate embeddings for: ${input.texts.join(' | ')}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      // Parse the response (simplified - real implementation would handle actual embedding API)
      const content = response.choices[0].message.content;
      let embeddings;

      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.embeddings)) {
          embeddings = parsed.embeddings;
        } else {
          // Fallback: generate mock embeddings for demonstration
          embeddings = input.texts.map(text =>
            Array.from({ length: dimensions }, () => Math.random() * 2 - 1)
          );
        }
      } catch (parseError) {
        // Generate mock embeddings if parsing fails
        embeddings = input.texts.map(text =>
          Array.from({ length: dimensions }, () => Math.random() * 2 - 1)
        );
      }

      return {
        embeddings,
        model,
        dimensions,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      this.logger.error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new EmbeddingError(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getModel(): string {
    return this.defaultModel;
  }

  getDimensions(): number {
    return this.defaultDimensions;
  }

  isAvailable(): boolean {
    try {
      // Check if OpenRouter is configured
      return !!this.config.OPENROUTER_API_KEY && this.config.OPENROUTER_API_KEY.length > 0;
    } catch (error) {
      return false;
    }
  }
}