import { EmbeddingProvider, EmbeddingInput, EmbeddingOutput } from '../embeddings/provider';
import { OpenRouterEmbeddingProvider } from '../embeddings/openrouter';
import { StubEmbeddingProvider } from '../embeddings/stub';
import { EmbeddingRepository, EmbeddingRecord } from '../storage/embeddings-repo';
import { CosineSimilarity } from '../similarity/cosine';
import { Logger } from '@ancso/core';
import { AppError } from '@ancso/core';

export class EmbeddingService {
  private provider: EmbeddingProvider;
  private repository: EmbeddingRepository;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('EmbeddingService');
    this.repository = new EmbeddingRepository();

    // Initialize provider - try OpenRouter first, fall back to stub
    try {
      const openRouterProvider = new OpenRouterEmbeddingProvider();
      if (openRouterProvider.isAvailable()) {
        this.provider = openRouterProvider;
        this.logger.info('Using OpenRouter embedding provider');
      } else {
        this.provider = new StubEmbeddingProvider();
        this.logger.warn('OpenRouter not configured, using stub embedding provider');
      }
    } catch (error) {
      this.logger.error(`Failed to initialize OpenRouter provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.provider = new StubEmbeddingProvider();
    }
  }

  async generateAndStoreEmbeddings(
    userId: string,
    input: EmbeddingInput,
    metadata?: Record<string, any>
  ): Promise<EmbeddingRecord[]> {
    try {
      this.logger.info(`Generating and storing embeddings for user: ${userId}`);

      // Generate embeddings
      const output = await this.provider.embed(input);

      // Store each embedding
      const records: EmbeddingRecord[] = [];

      for (let i = 0; i < input.texts.length; i++) {
        const record = await this.repository.storeEmbedding({
          userId,
          textContent: input.texts[i],
          embedding: output.embeddings[i],
          model: output.model,
          dimensions: output.dimensions,
          metadata: {
            ...metadata,
            inputIndex: i,
            provider: this.provider.getModel()
          }
        });

        records.push(record);
      }

      this.logger.info(`Stored ${records.length} embeddings for user: ${userId}`);
      return records;
    } catch (error) {
      this.logger.error(`Generate and store embeddings failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('EMBEDDING_ERROR', `Failed to generate and store embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findSimilarTexts(
    userId: string,
    queryText: string,
    model: string,
    k: number = 5
  ): Promise<Array<{ text: string; similarity: number; metadata?: any }>> {
    try {
      this.logger.info(`Finding similar texts for user: ${userId}`);

      // Generate embedding for query text
      const queryOutput = await this.provider.embed({
        texts: [queryText],
        model: model
      });

      const queryEmbedding = queryOutput.embeddings[0];

      // Find similar embeddings
      const similar = await this.repository.findSimilarEmbeddings(
        queryEmbedding,
        userId,
        model,
        k
      );

      // Format results
      return similar.map(item => ({
        text: item.embedding.textContent,
        similarity: item.similarity,
        metadata: item.embedding.metadata
      }));
    } catch (error) {
      this.logger.error(`Find similar texts failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('EMBEDDING_ERROR', `Failed to find similar texts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async calculateTextSimilarity(textA: string, textB: string): Promise<number> {
    try {
      this.logger.info('Calculating text similarity');

      // Generate embeddings for both texts
      const output = await this.provider.embed({
        texts: [textA, textB]
      });

      // Calculate cosine similarity
      const similarity = CosineSimilarity.calculate(
        output.embeddings[0],
        output.embeddings[1]
      );

      return similarity;
    } catch (error) {
      this.logger.error(`Calculate text similarity failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('EMBEDDING_ERROR', `Failed to calculate text similarity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStoredEmbeddings(userId: string): Promise<EmbeddingRecord[]> {
    try {
      this.logger.info(`Getting stored embeddings for user: ${userId}`);
      return await this.repository.getEmbeddingsByUser(userId);
    } catch (error) {
      this.logger.error(`Get stored embeddings failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('EMBEDDING_ERROR', `Failed to get stored embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteEmbedding(id: string): Promise<void> {
    try {
      this.logger.info(`Deleting embedding: ${id}`);
      await this.repository.deleteEmbedding(id);
    } catch (error) {
      this.logger.error(`Delete embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('EMBEDDING_ERROR', `Failed to delete embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getProviderInfo(): { model: string; dimensions: number; type: string } {
    return {
      model: this.provider.getModel(),
      dimensions: this.provider.getDimensions(),
      type: this.provider instanceof OpenRouterEmbeddingProvider ? 'openrouter' : 'stub'
    };
  }
}