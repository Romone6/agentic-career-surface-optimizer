import { getDatabase } from '@ancso/core';
import { Logger } from '@ancso/core';
import { AppError } from '@ancso/core';
import { FeatureExtractor, FEATURE_NAMES } from '../features/extractor';
import {
  SQLiteBenchmarkSectionRepository,
  SQLiteBenchmarkEmbeddingRepository,
  SQLiteBenchmarkProfileRepository,
  SQLiteRankItemRepository,
  SQLiteRankPairRepository,
} from '@ancso/core';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface RankerItem {
  id: string;
  platform: string;
  sectionType: string;
  sourceRef: string;
  content: string;
  embedding?: number[];
  embeddingId?: string;
  metrics: Record<string, number>;
  createdAt: string;
}

export interface RankerPair {
  id: string;
  aItemId: string;
  bItemId: string;
  aMetrics: Record<string, number>;
  bMetrics: Record<string, number>;
  aEmbedding?: number[];
  bEmbedding?: number[];
  label: number;
  source: string;
  reasonTags: string[];
  createdAt: string;
}

export interface DatasetMetadata {
  version: string;
  featureNames: string[];
  embeddingModel: string;
  embeddingDim: number;
  metricsDim: number;
  platform: string;
  itemCount: number;
  pairCount: number;
  datasetHash: string;
  createdAt: string;
  labelDistribution: Record<string, number>;
}

export interface ExportResult {
  datasetPath: string;
  metadataPath: string;
  rowCount: number;
  itemCount: number;
  pairCount: number;
  skippedPairs: number;
  datasetHash: string;
}

export class RankerDataPipelineService {
  private db: ReturnType<typeof getDatabase>;
  private logger: Logger;
  private featureExtractor: FeatureExtractor;
  private sectionRepo: SQLiteBenchmarkSectionRepository;
  private embeddingRepo: SQLiteBenchmarkEmbeddingRepository;
  private profileRepo: SQLiteBenchmarkProfileRepository;
  private itemRepo: SQLiteRankItemRepository;
  private pairRepo: SQLiteRankPairRepository;

  constructor() {
    this.db = getDatabase();
    this.logger = new Logger('RankerDataPipeline');
    this.featureExtractor = new FeatureExtractor(FEATURE_NAMES);
    this.sectionRepo = new SQLiteBenchmarkSectionRepository();
    this.embeddingRepo = new SQLiteBenchmarkEmbeddingRepository();
    this.profileRepo = new SQLiteBenchmarkProfileRepository();
    this.itemRepo = new SQLiteRankItemRepository();
    this.pairRepo = new SQLiteRankPairRepository();
  }

  async createRankItemsFromBenchmarks(platform: 'github' | 'linkedin'): Promise<number> {
    this.logger.info(`Creating rank items from ${platform} benchmarks`);

    const profiles = await this.profileRepo.findByPlatform(platform);
    let created = 0;

    for (const profile of profiles) {
      const sections = await this.sectionRepo.findByProfileId(profile.id);

      for (const section of sections) {
        const existingItem = await this.itemRepo.findByTextHash(platform, this.hashContent(section.content));
        if (existingItem) {
          continue;
        }

        const featureResult = this.featureExtractor.extract(section.content, section.sectionType);

        const embedding = section.embeddingId 
          ? await this.getEmbedding(section.embeddingId) 
          : undefined;

        const item = await this.itemRepo.create({
          id: uuidv4(),
          platform,
          section: section.sectionType,
          sourceRef: `${profile.username}/${section.sectionName || section.sectionType}`,
          textHash: this.hashContent(section.content),
          embeddingId: section.embeddingId,
          metrics: featureResult.features,
          createdAt: new Date().toISOString(),
        });

        created++;
      }
    }

    this.logger.info(`Created ${created} rank items from ${platform} benchmarks`);
    return created;
  }

  async bootstrapPairs(
    platform: 'github' | 'linkedin',
    nPairs: number = 500,
    diversityFactor: number = 0.3
  ): Promise<number> {
    this.logger.info(`Bootstrapping ${nPairs} pairs from ${platform} benchmarks`);

    const items = await this.itemRepo.findByPlatform(platform);
    
    if (items.length < 2) {
      throw new AppError('VALIDATION_ERROR', `Not enough items to create pairs. Need at least 2, got ${items.length}`);
    }

    const qualityScores = items.map(item => ({
      item,
      score: this.computeItemQuality(item),
    }));

    qualityScores.sort((a, b) => b.score - a.score);

    const topItems = qualityScores.slice(0, Math.max(10, Math.floor(items.length * 0.3)));
    const bottomItems = qualityScores.slice(-Math.max(10, Math.floor(items.length * 0.3)));

    let created = 0;
    const createdPairs = new Set<string>();

    for (let attempt = 0; attempt < nPairs * 3 && created < nPairs; attempt++) {
      const useDiversity = Math.random() < diversityFactor;

      let itemA: typeof topItems[0], itemB: typeof bottomItems[0];

      if (useDiversity && topItems.length > 1 && bottomItems.length > 1) {
        const idxA = Math.floor(Math.random() * topItems.length);
        const idxB = Math.floor(Math.random() * bottomItems.length);
        itemA = topItems[idxA];
        itemB = bottomItems[idxB];
      } else {
        const idxA = Math.floor(Math.random() * topItems.length);
        const idxB = Math.floor(Math.random() * topItems.length);
        if (idxA === idxB) continue;
        itemA = topItems[idxA];
        itemB = topItems[idxB];

        if (itemA.score <= itemB.score) {
          [itemA, itemB] = [itemB, itemA];
        }
      }

      const pairKey = [itemA.item.id, itemB.item.id].sort().join('-');
      if (createdPairs.has(pairKey)) continue;

      const embeddingA = await this.getItemEmbedding(itemA.item);
      const embeddingB = await this.getItemEmbedding(itemB.item);

      const reasonTags = this.generateReasonTags(itemA.item, itemB.item);

      await this.pairRepo.create({
        id: uuidv4(),
        aItemId: itemA.item.id,
        bItemId: itemB.item.id,
        label: 1,
        reasonTags,
        source: 'benchmark',
        createdAt: new Date().toISOString(),
      });

      createdPairs.add(pairKey);
      created++;
    }

    this.logger.info(`Created ${created} pairs from ${platform} benchmarks`);
    return created;
  }

  async exportDataset(
    platform: 'github' | 'linkedin',
    outputDir: string = 'data/ranker'
  ): Promise<ExportResult> {
    this.logger.info(`Exporting dataset for ${platform}`);

    const items = await this.itemRepo.findByPlatform(platform);
    const pairs = await this.pairRepo.listAll(10000);

    if (pairs.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'No pairs to export. Run ranker:bootstrap first.');
    }

    const embeddingModel = 'Xenova/all-MiniLM-L6-v2';
    const embeddingDim = 384;

    const outputPath = `${outputDir}/dataset.jsonl`;
    const metadataPath = `${outputDir}/metadata.json`;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(outputPath);
    let exported = 0;
    let skipped = 0;

    for (const pair of pairs) {
      const itemA = items.find(i => i.id === pair.aItemId);
      const itemB = items.find(i => i.id === pair.bItemId);

      if (!itemA || !itemB) {
        skipped++;
        continue;
      }

      const embeddingA = itemA.embeddingId ? await this.getEmbedding(itemA.embeddingId) : undefined;
      const embeddingB = itemB.embeddingId ? await this.getEmbedding(itemB.embeddingId) : undefined;

      const row = {
        a_metrics: FEATURE_NAMES.map(name => itemA.metrics[name] || 0),
        b_metrics: FEATURE_NAMES.map(name => itemB.metrics[name] || 0),
        a_embedding: embeddingA || new Array(embeddingDim).fill(0),
        b_embedding: embeddingB || new Array(embeddingDim).fill(0),
        label: pair.label,
        reason_tags: pair.reasonTags,
        source: pair.source,
      };

      writeStream.write(JSON.stringify(row) + '\n');
      exported++;
    }

    writeStream.end();

    const datasetContent = pairs.map(p => ({ aItemId: p.aItemId, bItemId: p.bItemId, label: p.label }));
    const datasetHash = crypto.createHash('sha256').update(JSON.stringify(datasetContent)).digest('hex');

    const labelDistribution = await this.pairRepo.getLabelDistribution();

    const metadata: DatasetMetadata = {
      version: '1.0',
      featureNames: [...FEATURE_NAMES],
      embeddingModel,
      embeddingDim,
      metricsDim: FEATURE_NAMES.length,
      platform,
      itemCount: items.length,
      pairCount: exported,
      datasetHash,
      createdAt: new Date().toISOString(),
      labelDistribution,
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    this.logger.info(`Exported ${exported} rows to ${outputPath}`);

    return {
      datasetPath: outputPath,
      metadataPath,
      rowCount: exported,
      itemCount: items.length,
      pairCount: exported,
      skippedPairs: skipped,
      datasetHash,
    };
  }

  async validateDataset(datasetPath: string, metadataPath: string): Promise<{
    valid: boolean;
    issues: string[];
    stats: Record<string, number>;
  }> {
    const issues: string[] = [];
    const stats: Record<string, number> = {};

    try {
      const metadata: DatasetMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      
      stats.embeddingDim = metadata.embeddingDim;
      stats.metricsDim = metadata.metricsDim;
      stats.expectedFeatureCount = metadata.featureNames.length;
      stats.expectedEmbeddingDim = metadata.embeddingDim;

      if (metadata.metricsDim !== FEATURE_NAMES.length) {
        issues.push(`Metrics dimension mismatch: expected ${FEATURE_NAMES.length}, got ${metadata.metricsDim}`);
      }

      const rows = fs.readFileSync(datasetPath, 'utf-8').split('\n').filter(line => line.trim());

      stats.actualRowCount = rows.length;

      for (let i = 0; i < Math.min(100, rows.length); i++) {
        const row = JSON.parse(rows[i]);

        if (row.a_metrics?.length !== metadata.metricsDim) {
          issues.push(`Row ${i}: a_metrics length mismatch (${row.a_metrics?.length} != ${metadata.metricsDim})`);
        }

        if (row.b_metrics?.length !== metadata.metricsDim) {
          issues.push(`Row ${i}: b_metrics length mismatch (${row.b_metrics?.length} != ${metadata.metricsDim})`);
        }

        if (row.a_embedding?.length !== metadata.embeddingDim) {
          issues.push(`Row ${i}: a_embedding length mismatch (${row.a_embedding?.length} != ${metadata.embeddingDim})`);
        }

        if (row.b_embedding?.length !== metadata.embeddingDim) {
          issues.push(`Row ${i}: b_embedding length mismatch (${row.b_embedding?.length} != ${metadata.embeddingDim})`);
        }

        if (![-1, 0, 1].includes(row.label)) {
          issues.push(`Row ${i}: invalid label ${row.label}`);
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        stats,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Failed to read/parse dataset: ${error instanceof Error ? error.message : 'Unknown error'}`],
        stats,
      };
    }
  }

  private computeItemQuality(item: RankerItem): number {
    const metrics = item.metrics;
    
    let score = 0;
    score += (metrics.clarity || 0) * 0.25;
    score += (metrics.impact || 0) * 0.30;
    score += (metrics.relevance || 0) * 0.20;
    score += (metrics.completeness || 0) * 0.25;

    return Math.min(1, score);
  }

  private generateReasonTags(itemA: RankerItem, itemB: RankerItem): string[] {
    const tags: string[] = [];

    if ((itemA.metrics.clarity || 0) > (itemB.metrics.clarity || 0)) {
      tags.push('clarity_better');
    }
    if ((itemA.metrics.impact || 0) > (itemB.metrics.impact || 0)) {
      tags.push('impact_better');
    }
    if ((itemA.metrics.relevance || 0) > (itemB.metrics.relevance || 0)) {
      tags.push('relevance_better');
    }

    return tags;
  }

  private async getEmbedding(embeddingId: string): Promise<number[] | undefined> {
    try {
      const embedding = await this.embeddingRepo.findById(embeddingId);
      if (!embedding) return undefined;

      return Array.from(new Float32Array(embedding.embeddingVector));
    } catch (error) {
      return undefined;
    }
  }

  private async getItemEmbedding(item: RankerItem): Promise<number[] | undefined> {
    if (item.embeddingId) {
      return this.getEmbedding(item.embeddingId);
    }
    return item.embedding;
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}