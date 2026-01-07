import { Migration } from '../database';

export const RANKER_MIGRATIONS: Migration[] = [
  {
    name: 'add_ranker_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS rank_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_reference_id TEXT NOT NULL,
        embedding_id TEXT,
        metrics_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rank_items_user ON rank_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_rank_items_type ON rank_items(item_type);
      CREATE INDEX IF NOT EXISTS idx_rank_items_embedding ON rank_items(embedding_id);

      CREATE TABLE IF NOT EXISTS rank_pairs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        item_a_id TEXT NOT NULL,
        item_b_id TEXT NOT NULL,
        label INTEGER NOT NULL,
        reason_tags_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (item_a_id) REFERENCES rank_items(id) ON DELETE CASCADE,
        FOREIGN KEY (item_b_id) REFERENCES rank_items(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_rank_pairs_user ON rank_pairs(user_id);
      CREATE INDEX IF NOT EXISTS idx_rank_pairs_item_a ON rank_pairs(item_a_id);
      CREATE INDEX IF NOT EXISTS idx_rank_pairs_item_b ON rank_pairs(item_b_id);
    `
  }
];