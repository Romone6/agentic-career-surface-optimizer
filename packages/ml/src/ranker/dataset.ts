import { getDatabase } from '@ancso/core';
import { Logger } from '@ancso/core';
import { AppError } from '@ancso/core';
import { EmbeddingService } from '../services/embedding-service';

export interface RankItem {
  id: string;
  userId: string;
  itemType: string;
  itemReferenceId: string;
  embeddingId?: string;
  metrics: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface RankPair {
  id: string;
  userId: string;
  itemAId: string;
  itemBId: string;
  label: number; // -1, 0, or 1 for preference
  reasonTags?: string[];
  createdAt: string;
}

export interface DatasetExportRow {
  item_a: RankItem;
  item_b: RankItem;
  label: number;
  reason_tags?: string[];
  similarity?: number;
}

export class RankerDatasetService {
  private db;
  private logger: Logger;
  private embeddingService: EmbeddingService;

  constructor() {
    this.db = getDatabase();
    this.logger = new Logger('RankerDatasetService');
    this.embeddingService = new EmbeddingService();
  }

  async addRankItem(item: Omit<RankItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<RankItem> {
    try {
      this.logger.info(`Adding rank item for user: ${item.userId}`);

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      this.db.execute(
        `INSERT INTO rank_items 
         (id, user_id, item_type, item_reference_id, embedding_id, metrics_json, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.userId,
          item.itemType,
          item.itemReferenceId,
          item.embeddingId,
          JSON.stringify(item.metrics),
          now,
          now
        ]
      );

      return {
        id,
        ...item,
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      this.logger.error(`Add rank item failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('RANKER_ERROR', `Failed to add rank item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addRankPair(pair: Omit<RankPair, 'id' | 'createdAt'>): Promise<RankPair> {
    try {
      this.logger.info(`Adding rank pair for user: ${pair.userId}`);

      // Validate that both items exist
      const itemA = this.db.queryOne(
        'SELECT id FROM rank_items WHERE id = ? AND user_id = ?',
        [pair.itemAId, pair.userId]
      );

      const itemB = this.db.queryOne(
        'SELECT id FROM rank_items WHERE id = ? AND user_id = ?',
        [pair.itemBId, pair.userId]
      );

      if (!itemA || !itemB) {
        throw new AppError('VALIDATION_ERROR', 'One or both items do not exist');
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      this.db.execute(
        `INSERT INTO rank_pairs 
         (id, user_id, item_a_id, item_b_id, label, reason_tags_json, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          pair.userId,
          pair.itemAId,
          pair.itemBId,
          pair.label,
          pair.reasonTags ? JSON.stringify(pair.reasonTags) : null,
          now
        ]
      );

      return {
        id,
        ...pair,
        createdAt: now
      };
    } catch (error) {
      this.logger.error(`Add rank pair failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('RANKER_ERROR', `Failed to add rank pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRankItem(id: string): Promise<RankItem | null> {
    try {
      const result = this.db.queryOne(
        'SELECT * FROM rank_items WHERE id = ?',
        [id]
      );

      if (!result) {
        return null;
      }

      return {
        id: result.id,
        userId: result.user_id,
        itemType: result.item_type,
        itemReferenceId: result.item_reference_id,
        embeddingId: result.embedding_id,
        metrics: JSON.parse(result.metrics_json),
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    } catch (error) {
      this.logger.error(`Get rank item failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('RANKER_ERROR', `Failed to get rank item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRankItemsByUser(userId: string): Promise<RankItem[]> {
    try {
      const results = this.db.query(
        'SELECT * FROM rank_items WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );

      return results.map(result => ({
        id: result.id,
        userId: result.user_id,
        itemType: result.item_type,
        itemReferenceId: result.item_reference_id,
        embeddingId: result.embedding_id,
        metrics: JSON.parse(result.metrics_json),
        createdAt: result.created_at,
        updatedAt: result.updated_at
      }));
    } catch (error) {
      this.logger.error(`Get rank items by user failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('RANKER_ERROR', `Failed to get rank items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRankPairsByUser(userId: string): Promise<RankPair[]> {
    try {
      const results = this.db.query(
        'SELECT * FROM rank_pairs WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );

      return results.map(result => ({
        id: result.id,
        userId: result.user_id,
        itemAId: result.item_a_id,
        itemBId: result.item_b_id,
        label: result.label,
        reasonTags: result.reason_tags_json ? JSON.parse(result.reason_tags_json) : undefined,
        createdAt: result.created_at
      }));
    } catch (error) {
      this.logger.error(`Get rank pairs by user failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('RANKER_ERROR', `Failed to get rank pairs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportDataset(userId: string): Promise<DatasetExportRow[]> {
    try {
      this.logger.info(`Exporting dataset for user: ${userId}`);

      // Get all rank pairs for the user
      const pairs = await this.getRankPairsByUser(userId);
      
      if (pairs.length === 0) {
        return [];
      }

      // Get all rank items for the user
      const items = await this.getRankItemsByUser(userId);
      const itemsMap = new Map<string, RankItem>(items.map(item => [item.id, item]));

      // Build export rows
      const exportRows: DatasetExportRow[] = [];

      for (const pair of pairs) {
        const itemA = itemsMap.get(pair.itemAId);
        const itemB = itemsMap.get(pair.itemBId);

        if (!itemA || !itemB) {
          this.logger.warn(`Skipping pair ${pair.id} - missing items`);
          continue;
        }

        // Calculate similarity if embeddings are available
        let similarity: number | undefined = undefined;
        
        if (itemA.embeddingId && itemB.embeddingId) {
          try {
            const embeddingA = await this.embeddingService.getStoredEmbeddings(userId);
            const embeddingB = await this.embeddingService.getStoredEmbeddings(userId);
            
            const embA = embeddingA.find(e => e.id === itemA.embeddingId);
            const embB = embeddingB.find(e => e.id === itemB.embeddingId);
            
            if (embA && embB) {
              similarity = CosineSimilarity.calculate(embA.embedding, embB.embedding);
            }
          } catch (error) {
            this.logger.warn(`Failed to calculate similarity for pair ${pair.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        exportRows.push({
          item_a: itemA,
          item_b: itemB,
          label: pair.label,
          reason_tags: pair.reasonTags,
          similarity
        });
      }

      return exportRows;
    } catch (error) {
      this.logger.error(`Export dataset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('RANKER_ERROR', `Failed to export dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportDatasetToJSONL(userId: string, outputPath: string): Promise<void> {
    try {
      this.logger.info(`Exporting dataset to JSONL: ${outputPath}`);

      // Get export rows
      const rows = await this.exportDataset(userId);

      // Write to JSONL file
      const lines = rows.map(row => JSON.stringify(row));
      const content = lines.join('\n');

      fs.writeFileSync(outputPath, content);
      
      this.logger.info(`Exported ${rows.length} rows to ${outputPath}`);
    } catch (error) {
      this.logger.error(`Export dataset to JSONL failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('RANKER_ERROR', `Failed to export dataset to JSONL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteRankItem(id: string): Promise<void> {
    try {
      this.logger.info(`Deleting rank item: ${id}`);
      this.db.execute('DELETE FROM rank_items WHERE id = ?', [id]);
    } catch (error) {
      this.logger.error(`Delete rank item failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('RANKER_ERROR', `Failed to delete rank item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteRankPair(id: string): Promise<void> {
    try {
      this.logger.info(`Deleting rank pair: ${id}`);
      this.db.execute('DELETE FROM rank_pairs WHERE id = ?', [id]);
    } catch (error) {
      this.logger.error(`Delete rank pair failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('RANKER_ERROR', `Failed to delete rank pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDatasetStatistics(userId: string): Promise<{
    itemCount: number;
    pairCount: number;
    labelDistribution: Record<string, number>;
  }> {
    try {
      // Get item count
      const itemResult = this.db.queryOne(
        'SELECT COUNT(*) as count FROM rank_items WHERE user_id = ?',
        [userId]
      );

      // Get pair count
      const pairResult = this.db.queryOne(
        'SELECT COUNT(*) as count FROM rank_pairs WHERE user_id = ?',
        [userId]
      );

      // Get label distribution
      const labelResults = this.db.query(
        'SELECT label, COUNT(*) as count FROM rank_pairs WHERE user_id = ? GROUP BY label',
        [userId]
      );

      const labelDistribution: Record<string, number> = {};
      labelResults.forEach(row => {
        labelDistribution[row.label] = row.count;
      });

      return {
        itemCount: itemResult.count,
        pairCount: pairResult.count,
        labelDistribution
      };
    } catch (error) {
      this.logger.error(`Get dataset statistics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('RANKER_ERROR', `Failed to get dataset statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}