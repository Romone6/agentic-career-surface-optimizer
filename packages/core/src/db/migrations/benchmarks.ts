import { Migration } from '../../storage/database';

export const BENCHMARK_MIGRATIONS: Migration[] = [
  {
    name: 'add_benchmark_tables_v1',
    sql: `
      CREATE TABLE IF NOT EXISTS benchmark_profiles (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        external_id TEXT NOT NULL,
        username TEXT NOT NULL,
        display_name TEXT,
        bio TEXT,
        persona TEXT,
        source_url TEXT,
        relevance_score REAL DEFAULT 0.0,
        is_elite INTEGER DEFAULT 0,
        is_ingested INTEGER DEFAULT 0,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(platform, external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_benchmark_profiles_platform ON benchmark_profiles(platform);
      CREATE INDEX IF NOT EXISTS idx_benchmark_profiles_persona ON benchmark_profiles(persona);
      CREATE INDEX IF NOT EXISTS idx_benchmark_profiles_elite ON benchmark_profiles(is_elite);

      CREATE TABLE IF NOT EXISTS benchmark_sections (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        section_type TEXT NOT NULL,
        section_name TEXT,
        content TEXT NOT NULL,
        word_count INTEGER,
        embedding_id TEXT,
        text_hash TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES benchmark_profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (embedding_id) REFERENCES benchmark_embeddings(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_benchmark_sections_profile ON benchmark_sections(profile_id);
      CREATE INDEX IF NOT EXISTS idx_benchmark_sections_type ON benchmark_sections(section_type);
      CREATE INDEX IF NOT EXISTS idx_benchmark_sections_text_hash ON benchmark_sections(text_hash);

      CREATE TABLE IF NOT EXISTS benchmark_embeddings (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        section_id TEXT,
        embedding_model TEXT NOT NULL,
        embedding_vector BLOB NOT NULL,
        dimension INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES benchmark_profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES benchmark_sections(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_benchmark_embeddings_profile ON benchmark_embeddings(profile_id);
      CREATE INDEX IF NOT EXISTS idx_benchmark_embeddings_section ON benchmark_embeddings(section_id);

      CREATE TABLE IF NOT EXISTS benchmark_cache (
        id TEXT PRIMARY KEY,
        cache_key TEXT NOT NULL UNIQUE,
        cache_type TEXT NOT NULL,
        response_json TEXT NOT NULL,
        expires_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_benchmark_cache_key ON benchmark_cache(cache_key);
    `
  }
];