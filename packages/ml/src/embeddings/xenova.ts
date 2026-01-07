import { EmbeddingProvider, EmbeddingInput, EmbeddingOutput, EmbeddingError } from './provider';
import { Logger } from '@ancso/core';

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const DEFAULT_DIMENSIONS = 384;

export class XenovaEmbeddingProvider implements EmbeddingProvider {
  private logger: Logger;
  private pipeline: any = null;
  private model: string;
  private dimensions: number;

  constructor(model: string = DEFAULT_MODEL) {
    this.logger = new Logger('XenovaEmbeddingProvider');
    this.model = model;
    this.dimensions = DEFAULT_DIMENSIONS;
  }

  async initialize(): Promise<void> {
    try {
      const { pipeline } = await import('@xenova/transformers');
      
      this.logger.info(`Loading embedding model: ${this.model}`);
      this.pipeline = await pipeline('feature-extraction', this.model, {
        quantized: true,
      });
      
      this.logger.info('Xenova embedding provider initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Xenova provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new EmbeddingError(`Failed to initialize embedding model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embed(input: EmbeddingInput): Promise<EmbeddingOutput> {
    if (!this.pipeline) {
      await this.initialize();
    }

    try {
      const embeddings: number[][] = [];

      for (const text of input.texts) {
        const output = await this.pipeline(text, {
          pooling: 'mean',
          normalize: true,
        });

        const embedding = Array.from(output.data);
        embeddings.push(embedding);
      }

      return {
        embeddings,
        model: this.model,
        dimensions: embeddings[0]?.length || this.dimensions,
        usage: {
          prompt_tokens: input.texts.join(' ').split(/\s+/).length,
          total_tokens: input.texts.join(' ').split(/\s+/).length,
        },
      };
    } catch (error) {
      this.logger.error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new EmbeddingError(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getModel(): string {
    return this.model;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  isAvailable(): boolean {
    return this.pipeline !== null;
  }

  async unload(): Promise<void> {
    if (this.pipeline) {
      this.logger.info('Unloading Xenova embedding model');
      this.pipeline = null;
    }
  }
}

export class CachedXenovaEmbeddingProvider implements EmbeddingProvider {
  private provider: XenovaEmbeddingProvider;
  private cache: Map<string, number[]> = new Map();
  private logger: Logger;

  constructor(model: string = DEFAULT_MODEL) {
    this.provider = new XenovaEmbeddingProvider(model);
    this.logger = new Logger('CachedXenovaEmbeddingProvider');
  }

  async embed(input: EmbeddingInput): Promise<EmbeddingOutput> {
    const uncachedTexts: string[] = [];
    const results: number[][] = [];
    const textHashes: string[] = [];

    for (const text of input.texts) {
      const hash = this.hashText(text);
      textHashes.push(hash);

      if (this.cache.has(hash)) {
        results.push(this.cache.get(hash)!);
      } else {
        uncachedTexts.push(text);
      }
    }

    if (uncachedTexts.length > 0) {
      this.logger.debug(`Generating ${uncachedTexts.length} new embeddings (${results.length} cached)`);
      const output = await this.provider.embed({ texts: uncachedTexts });

      for (let i = 0; i < uncachedTexts.length; i++) {
        const hash = textHashes[input.texts.indexOf(uncachedTexts[i])];
        this.cache.set(hash, output.embeddings[i]);
        results.push(output.embeddings[i]);
      }
    }

    return {
      embeddings: results,
      model: this.provider.getModel(),
      dimensions: this.provider.getDimensions(),
      usage: {
        prompt_tokens: input.texts.join(' ').split(/\s+/).length,
        total_tokens: input.texts.join(' ').split(/\s+/).length,
      },
    };
  }

  getModel(): string {
    return this.provider.getModel();
  }

  getDimensions(): number {
    return this.provider.getDimensions();
  }

  isAvailable(): boolean {
    return this.provider.isAvailable();
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  getCacheStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0,
      misses: 0,
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.info('Embedding cache cleared');
  }
}