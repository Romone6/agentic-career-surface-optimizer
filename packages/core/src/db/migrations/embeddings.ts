import { Migration } from '../../storage/database';

export const EMBEDDING_MIGRATIONS: Migration[] = [
  {
    name: 'add_embeddings_table',
    sql: `
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        text_content TEXT NOT NULL,
        embedding_blob BLOB NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_embeddings_user ON embeddings(user_id);
      CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings(model);
      CREATE INDEX IF NOT EXISTS idx_embeddings_created ON embeddings(created_at);
    `
  }
];