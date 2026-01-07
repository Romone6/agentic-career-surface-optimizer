import { Logger } from '@ancso/core';
import { AppError } from '@ancso/core';
import { XenovaEmbeddingProvider, CachedXenovaEmbeddingProvider } from '../embeddings/xenova';
import {
  SQLiteBenchmarkSectionRepository,
  SQLiteBenchmarkEmbeddingRepository,
  SQLiteBenchmarkProfileRepository,
} from '@ancso/core';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const DEFAULT_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const DEFAULT_EMBEDDING_DIM = 384;

export interface BenchmarkEmbeddingResult {
  sectionId: string;
  embeddingId: string;
  contentHash: string;
  dimension: number;
  model: string;
}

export class BenchmarkEmbeddingService {
  private logger: Logger;
  private provider: CachedXenovaEmbeddingProvider;
  private sectionRepo: SQLiteBenchmarkSectionRepository;
  private embeddingRepo: SQLiteBenchmarkEmbeddingRepository;
  private profileRepo: SQLiteBenchmarkProfileRepository;

  constructor() {
    this.logger = new Logger('BenchmarkEmbeddingService');
    this.provider = new CachedXenovaEmbeddingProvider(DEFAULT_EMBEDDING_MODEL);
    this.sectionRepo = new SQLiteBenchmarkSectionRepository();
    this.embeddingRepo = new SQLiteBenchmarkEmbeddingRepository();
    this.profileRepo = new SQLiteBenchmarkProfileRepository();
  }

  async initialize(): Promise<void> {
    await this.provider.initialize();
    this.logger.info(`Benchmark embedding service initialized with ${DEFAULT_EMBEDDING_MODEL}`);
  }

  async embedPlatformSections(platform: 'github' | 'linkedin'): Promise<{
    embedded: number;
    skipped: number;
    failed: number;
  }> {
    this.logger.info(`Embedding ${platform} sections`);

    const profiles = await this.profileRepo.findByPlatform(platform);
    let embedded = 0;
    let skipped = 0;
    let failed = 0;

    for (const profile of profiles) {
      const sections = await this.sectionRepo.findByProfileId(profile.id);

      for (const section of sections) {
        try {
          const result = await this.embedSection(section.id, section.content);
          if (result) {
            embedded++;
          } else {
            skipped++;
          }
        } catch (error) {
          this.logger.error(`Failed to embed section ${section.id}: ${error}`);
          failed++;
        }
      }
    }

    this.logger.info(`Embedding complete: ${embedded} embedded, ${skipped} skipped, ${failed} failed`);
    return { embedded, skipped, failed };
  }

  async embedSection(sectionId: string, content: string): Promise<BenchmarkEmbeddingResult | null> {
    try {
      const textHash = crypto.createHash('sha256').update(content).digest('hex');

      const existingEmbedding = await this.embeddingRepo.findBySectionId(sectionId);
      if (existingEmbedding) {
        this.logger.debug(`Section ${sectionId} already has embedding, skipping`);
        return null;
      }

      const output = await this.provider.embed({ texts: [content] });
      const embedding = output.embeddings[0];

      const embeddingId = uuidv4();
      const embeddingBuffer = Buffer.from(new Float32Array(embedding));

      const profile = await this.getProfileForSection(sectionId);

      await this.embeddingRepo.create({
        id: embeddingId,
        profileId: profile?.id || '',
        sectionId,
        embeddingModel: this.provider.getModel(),
        embeddingVector: embeddingBuffer,
        dimension: embedding.length,
        createdAt: new Date().toISOString(),
      });

      await this.sectionRepo.update({
        ...(await this.sectionRepo.findById(sectionId))!,
        embeddingId,
        textHash,
        updatedAt: new Date().toISOString(),
      });

      this.logger.debug(`Embedded section ${sectionId} with dim ${embedding.length}`);

      return {
        sectionId,
        embeddingId,
        contentHash: textHash,
        dimension: embedding.length,
        model: this.provider.getModel(),
      };
    } catch (error) {
      this.logger.error(`Failed to embed section ${sectionId}: ${error}`);
      throw new AppError('EMBEDDING_ERROR', `Failed to embed section: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embedBatch(sections: Array<{ id: string; content: string }>): Promise<BenchmarkEmbeddingResult[]> {
    const results: BenchmarkEmbeddingResult[] = [];

    for (const section of sections) {
      const result = await this.embedSection(section.id, section.content);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  async getEmbedding(sectionId: string): Promise<number[] | null> {
    const section = await this.sectionRepo.findById(sectionId);
    if (!section?.embeddingId) {
      return null;
    }

    const embedding = await this.embeddingRepo.findById(section.embeddingId);
    if (!embedding) {
      return null;
    }

    return Array.from(new Float32Array(embedding.embeddingVector));
  }

  async getCacheStats(): Promise<{ size: number; hits: number; misses: number }> {
    return this.provider.getCacheStats();
  }

  async clearCache(): Promise<void> {
    this.provider.clearCache();
  }

  private async getProfileForSection(sectionId: string): Promise<any | null> {
    const section = await this.sectionRepo.findById(sectionId);
    if (!section) {
      return null;
    }

    return await this.profileRepo.findById(section.profileId);
  }

  getModelInfo(): { model: string; dimensions: number } {
    return {
      model: this.provider.getModel(),
      dimensions: this.provider.getDimensions(),
    };
  }
}