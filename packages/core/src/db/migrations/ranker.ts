import { Migration } from '../../storage/database';

export const RANKER_MIGRATIONS: Migration[] = [
  {
    name: 'add_ranker_tables_v2',
    sql: `
      CREATE TABLE IF NOT EXISTS rank_items (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        section TEXT NOT NULL,
        source_ref TEXT NOT NULL,
        text_hash TEXT,
        embedding_id TEXT,
        metrics_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rank_items_platform ON rank_items(platform);
      CREATE INDEX IF NOT EXISTS idx_rank_items_section ON rank_items(section);
      CREATE INDEX IF NOT EXISTS idx_rank_items_source ON rank_items(source_ref);
      CREATE INDEX IF NOT EXISTS idx_rank_items_embedding ON rank_items(embedding_id);
      CREATE INDEX IF NOT EXISTS idx_rank_items_text_hash ON rank_items(text_hash);

      CREATE TABLE IF NOT EXISTS rank_pairs (
        id TEXT PRIMARY KEY,
        a_item_id TEXT NOT NULL,
        b_item_id TEXT NOT NULL,
        label INTEGER NOT NULL CHECK (label IN (-1, 0, 1)),
        reason_tags_json TEXT,
        source TEXT NOT NULL CHECK (source IN ('benchmark', 'user_choice', 'before_after', 'heuristic')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (a_item_id) REFERENCES rank_items(id) ON DELETE CASCADE,
        FOREIGN KEY (b_item_id) REFERENCES rank_items(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_rank_pairs_a_item ON rank_pairs(a_item_id);
      CREATE INDEX IF NOT EXISTS idx_rank_pairs_b_item ON rank_pairs(b_item_id);
      CREATE INDEX IF NOT EXISTS idx_rank_pairs_source ON rank_pairs(source);
      CREATE INDEX IF NOT EXISTS idx_rank_pairs_label ON rank_pairs(label);
      CREATE INDEX IF NOT EXISTS idx_rank_pairs_created ON rank_pairs(created_at);

      CREATE TABLE IF NOT EXISTS rank_runs (
        id TEXT PRIMARY KEY,
        model_path TEXT NOT NULL,
        metadata_path TEXT NOT NULL,
        dataset_hash TEXT NOT NULL,
        train_metrics_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rank_runs_hash ON rank_runs(dataset_hash);
      CREATE INDEX IF NOT EXISTS idx_rank_runs_created ON rank_runs(created_at);
    `
  }
];
