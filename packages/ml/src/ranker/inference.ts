import { getDatabase } from '@ancso/core';
import { Logger } from '@ancso/core';
import crypto from 'crypto';
import path from 'path';

export interface RankerConfig {
  modelPath: string;
  metadataPath: string;
  embeddingDim: number;
  metricsDim: number;
  featureNames: string[];
}

export interface ScoredItem {
  id: string;
  platform: string;
  section: string;
  sourceRef: string;
  score: number;
  embedding?: number[];
  metrics: Record<string, number>;
}

export interface ComparisonResult {
  aScore: number;
  bScore: number;
  preference: number;
  confidence: number;
  provenance: 'ranker' | 'heuristic';
  details?: {
    embeddingSimilarity?: number;
    metricsDifference?: Record<string, number>;
  };
}

export interface RankerMetadata {
  version: string;
  embeddingDim: number;
  metricsDim: number;
  featureNames: string[];
  datasetHash: string;
  trainMetrics: {
    valAccuracy: number;
    valLoss: number;
    trainAccuracy: number;
    trainLoss: number;
  };
  createdAt: string;
  onnxOpSet: number;
}

export class RankerInferenceService {
  private db;
  private logger: Logger;
  private config: RankerConfig | null = null;
  private runtime: any = null;
  private session: any = null;
  private heuristicsEnabled: boolean = true;

  private static readonly MODELS_DIR = 'models';
  private static readonly ACTIVE_MODEL_FILE = 'models/active_model.json';

  constructor() {
    this.db = getDatabase();
    this.logger = new Logger('RankerInference');
  }

  async initialize(): Promise<boolean> {
    try {
      const activeModel = await this.loadActiveModel();
      if (!activeModel) {
        this.logger.info('No active ranker model found, using heuristics only');
        return false;
      }

      this.config = activeModel.config;

      const onnxRuntime = await this.loadOnnxRuntime();
      if (!onnxRuntime) {
        this.logger.warn('ONNX Runtime not available, falling back to heuristics');
        this.heuristicsEnabled = true;
        return false;
      }

      this.runtime = onnxRuntime;
      this.session = await this.runtime.InferenceSession.load(this.config.modelPath);
      
      this.logger.info(`Ranker model loaded: ${this.config.modelPath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize ranker: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.heuristicsEnabled = true;
      return false;
    }
  }

  private async loadOnnxRuntime(): Promise<any | null> {
    try {
      const onnxruntime = await import('onnxruntime-node');
      return onnxruntime;
    } catch (error) {
      this.logger.debug('ONNX Runtime not available');
      return null;
    }
  }

  private async loadActiveModel(): Promise<{ config: RankerConfig; metadata: RankerMetadata } | null> {
    try {
      const activePath = RankerInferenceService.ACTIVE_MODEL_FILE;
      if (!fs.existsSync(activePath)) {
        return null;
      }

      const activeData = JSON.parse(fs.readFileSync(activePath, 'utf-8'));
      if (!activeData.activeModel) {
        return null;
      }

      const modelPath = path.join(RankerInferenceService.MODELS_DIR, activeData.activeModel);
      const metadataPath = path.join(RankerInferenceService.MODELS_DIR, activeData.metadata);

      if (!fs.existsSync(modelPath) || !fs.existsSync(metadataPath)) {
        return null;
      }

      const metadata: RankerMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

      const config: RankerConfig = {
        modelPath,
        metadataPath,
        embeddingDim: metadata.embeddingDim,
        metricsDim: metadata.metricsDim,
        featureNames: metadata.featureNames,
      };

      return { config, metadata };
    } catch (error) {
      this.logger.error(`Failed to load active model: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  isActive(): boolean {
    return this.session !== null && this.runtime !== null;
  }

  getStatus(): { active: boolean; provenance: string; modelVersion?: string; metrics?: Record<string, number> } {
    if (this.isActive()) {
      return {
        active: true,
        provenance: 'ranker',
        modelVersion: this.config?.metadataPath ? path.basename(this.config.metadataPath) : undefined,
      };
    }
    return {
      active: false,
      provenance: 'heuristic',
    };
  }

  async scoreItem(item: ScoredItem): Promise<{ score: number; provenance: string }> {
    if (this.isActive() && this.session && this.config) {
      return this.scoreWithRanker(item);
    }
    return this.scoreWithHeuristics(item);
  }

  private async scoreWithRanker(item: ScoredItem): Promise<{ score: number; provenance: string }> {
    try {
      const embedding = item.embedding || this.getZeroEmbedding(this.config!.embeddingDim);
      const metrics = this.extractMetricsVector(item.metrics, this.config!.featureNames);

      const inputTensor = this.createInputTensor(embedding, metrics);
      
      const feeds = { input: inputTensor };
      const outputs = await this.session.run(feeds);
      const score = outputs.output?.data?.[0] || 0;

      return { score, provenance: 'ranker' };
    } catch (error) {
      this.logger.error(`Ranker scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.scoreWithHeuristics(item);
    }
  }

  private scoreWithHeuristics(item: ScoredItem): { score: number; provenance: string } {
    let score = 0;

    if (item.metrics) {
      const clarityScore = this.computeClarityScore(item);
      const impactScore = this.computeImpactScore(item);
      const keywordScore = this.computeKeywordScore(item);
      
      score = clarityScore * 0.3 + impactScore * 0.4 + keywordScore * 0.3;
    }

    return { score: Math.min(1, Math.max(0, score)), provenance: 'heuristic' };
  }

  async compare(itemA: ScoredItem, itemB: ScoredItem): Promise<ComparisonResult> {
    if (this.isActive() && this.session && this.config) {
      return this.compareWithRanker(itemA, itemB);
    }
    return this.compareWithHeuristics(itemA, itemB);
  }

  private async compareWithRanker(itemA: ScoredItem, itemB: ScoredItem): Promise<ComparisonResult> {
    try {
      const scoreA = await this.scoreWithRanker(itemA);
      const scoreB = await this.scoreWithRanker(itemB);

      const preference = Math.sign(scoreA.score - scoreB.score);
      const confidence = Math.abs(scoreA.score - scoreB.score);

      return {
        aScore: scoreA.score,
        bScore: scoreB.score,
        preference,
        confidence: Math.min(1, confidence),
        provenance: 'ranker',
      };
    } catch (error) {
      this.logger.error(`Ranker comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.compareWithHeuristics(itemA, itemB);
    }
  }

  private compareWithHeuristics(itemA: ScoredItem, itemB: ScoredItem): ComparisonResult {
    const scoreA = this.scoreWithHeuristics(itemA);
    const scoreB = this.scoreWithHeuristics(itemB);

    const preference = Math.sign(scoreA.score - scoreB.score);
    const confidence = Math.abs(scoreA.score - scoreB.score);

    return {
      aScore: scoreA.score,
      bScore: scoreB.score,
      preference,
      confidence: Math.min(1, confidence),
      provenance: 'heuristic',
      details: {
        metricsDifference: this.computeMetricsDifference(itemA.metrics, itemB.metrics),
      },
    };
  }

  async scoreItemWithEmbedding(item: ScoredItem, embedding: number[]): Promise<{ score: number; provenance: string }> {
    if (this.isActive() && this.session && this.config) {
      return this.scoreWithRankerWithEmbedding(item, embedding);
    }
    return this.scoreWithHeuristics(item);
  }

  private async scoreWithRankerWithEmbedding(item: ScoredItem, embedding: number[]): Promise<{ score: number; provenance: string }> {
    try {
      const metrics = this.extractMetricsVector(item.metrics, this.config!.featureNames);

      const inputTensor = this.createInputTensorWithEmbedding(embedding, metrics);
      
      const feeds = { input: inputTensor };
      const outputs = await this.session.run(feeds);
      const score = outputs.output?.data?.[0] || 0;

      return { score, provenance: 'ranker' };
    } catch (error) {
      this.logger.error(`Ranker scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.scoreWithHeuristics(item);
    }
  }

  private createInputTensorWithEmbedding(embedding: number[], metrics: number[]): any {
    const onnx = this.runtime;
    const inputData = new Float32Array(embedding.length + metrics.length);
    
    for (let i = 0; i < embedding.length; i++) {
      inputData[i] = embedding[i];
    }
    for (let i = 0; i < metrics.length; i++) {
      inputData[embedding.length + i] = metrics[i];
    }

    return new onnx.Tensor('float32', inputData, [1, inputData.length]);
  }

  async compareWithEmbeddings(
    itemA: ScoredItem, 
    embeddingA: number[],
    itemB: ScoredItem, 
    embeddingB: number[]
  ): Promise<ComparisonResult> {
    if (this.isActive() && this.session && this.config) {
      return this.compareWithRankerAndEmbeddings(itemA, embeddingA, itemB, embeddingB);
    }
    return this.compareWithHeuristics(itemA, itemB);
  }

  private async compareWithRankerAndEmbeddings(
    itemA: ScoredItem,
    embeddingA: number[],
    itemB: ScoredItem,
    embeddingB: number[]
  ): Promise<ComparisonResult> {
    try {
      const scoreA = await this.scoreWithRankerWithEmbedding(itemA, embeddingA);
      const scoreB = await this.scoreWithRankerWithEmbedding(itemB, embeddingB);

      const preference = Math.sign(scoreA.score - scoreB.score);
      const confidence = Math.abs(scoreA.score - scoreB.score);

      return {
        aScore: scoreA.score,
        bScore: scoreB.score,
        preference,
        confidence: Math.min(1, confidence),
        provenance: 'ranker',
      };
    } catch (error) {
      this.logger.error(`Ranker comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.compareWithHeuristics(itemA, itemB);
    }
  }

  private createInputTensor(embedding: number[], metrics: number[]): any {
    const onnx = this.runtime;
    const inputData = new Float32Array(embedding.length + metrics.length);
    
    for (let i = 0; i < embedding.length; i++) {
      inputData[i] = embedding[i];
    }
    for (let i = 0; i < metrics.length; i++) {
      inputData[embedding.length + i] = metrics[i];
    }

    return new onnx.Tensor('float32', inputData, [1, inputData.length]);
  }

  private getZeroEmbedding(dim: number): number[] {
    return new Array(dim).fill(0);
  }

  private extractMetricsVector(metrics: Record<string, number>, featureNames: string[]): number[] {
    return featureNames.map(name => metrics[name] || 0);
  }

  private computeClarityScore(item: ScoredItem): number {
    if (!item.metrics) return 0.5;
    
    const length = item.sourceRef.length + (item.section?.length || 0);
    const optimalLength = 200;
    const lengthScore = Math.min(1, length / optimalLength);
    
    const completeness = Object.keys(item.metrics).length / 10;
    
    return Math.min(1, (lengthScore * 0.5 + completeness * 0.5));
  }

  private computeImpactScore(item: ScoredItem): number {
    if (!item.metrics) return 0.5;
    
    let impact = 0;
    const metrics = item.metrics;
    
    if (metrics.clarity !== undefined) impact += metrics.clarity * 0.3;
    if (metrics.impact !== undefined) impact += metrics.impact * 0.4;
    if (metrics.relevance !== undefined) impact += metrics.relevance * 0.3;
    
    return Math.min(1, impact);
  }

  private computeKeywordScore(item: ScoredItem): number {
    if (!item.metrics) return 0.5;
    
    const keywords = item.metrics.keyword_density || 0;
    const optimalKeywordDensity = 0.05;
    
    if (keywords === 0) return 0.5;
    const score = Math.min(1, Math.abs(keywords - optimalKeywordDensity) < 0.02 ? 1 : 0.7);
    
    return score;
  }

  private computeMetricsDifference(metricsA: Record<string, number>, metricsB: Record<string, number>): Record<string, number> {
    const allKeys = new Set([...Object.keys(metricsA), ...Object.keys(metricsB)]);
    const difference: Record<string, number> = {};
    
    allKeys.forEach(key => {
      const valA = metricsA[key] || 0;
      const valB = metricsB[key] || 0;
      difference[key] = valA - valB;
    });
    
    return difference;
  }

  async getModelInfo(): Promise<RankerMetadata | null> {
    try {
      const activePath = RankerInferenceService.ACTIVE_MODEL_FILE;
      if (!fs.existsSync(activePath)) {
        return null;
      }

      const activeData = JSON.parse(fs.readFileSync(activePath, 'utf-8'));
      if (!activeData.metadata || !fs.existsSync(activeData.metadata)) {
        return null;
      }

      return JSON.parse(fs.readFileSync(activeData.metadata, 'utf-8'));
    } catch (error) {
      this.logger.error(`Failed to get model info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
}

export class RankerConfigService {
  private db;
  private logger: Logger;
  private static readonly CONFIG_TABLE = 'ranker_config';
  private static readonly ACTIVE_MODEL_KEY = 'active_model';

  constructor() {
    this.db = getDatabase();
    this.logger = new Logger('RankerConfig');
    
    this.ensureConfigTable();
  }

  private ensureConfigTable(): void {
    try {
      this.db.execute(`
        CREATE TABLE IF NOT EXISTS ${RankerConfigService.CONFIG_TABLE} (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    } catch (error) {
      this.logger.error(`Failed to ensure config table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  setActiveModel(modelFilename: string, metadataFilename: string): void {
    const now = new Date().toISOString();
    const value = JSON.stringify({
      activeModel: modelFilename,
      metadata: metadataFilename,
    });

    this.db.execute(
      `INSERT OR REPLACE INTO ${RankerConfigService.CONFIG_TABLE} (key, value, updated_at) VALUES (?, ?, ?)`,
      [RankerConfigService.ACTIVE_MODEL_KEY, value, now]
    );

    this.logger.info(`Active model set to: ${modelFilename}`);
  }

  getActiveModel(): { model: string; metadata: string } | null {
    try {
      const row = this.db.queryOne<{ value: string }>(
        `SELECT value FROM ${RankerConfigService.CONFIG_TABLE} WHERE key = ?`,
        [RankerConfigService.ACTIVE_MODEL_KEY]
      );

      if (!row) return null;

      const value = JSON.parse(row.value);
      return { model: value.activeModel, metadata: value.metadata };
    } catch (error) {
      this.logger.error(`Failed to get active model: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  clearActiveModel(): void {
    this.db.execute(
      `DELETE FROM ${RankerConfigService.CONFIG_TABLE} WHERE key = ?`,
      [RankerConfigService.ACTIVE_MODEL_KEY]
    );
    this.logger.info('Active model cleared');
  }
}
