import path from 'path';
import fs from 'fs';
import { AppDatabase, Migration } from '../src/storage/database';
import { SQLiteRankItemRepository, SQLiteRankPairRepository, SQLiteRankRunRepository } from '../src/storage/repositories/ranker';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const RANKER_V2_MIGRATION: Migration = {
  name: 'add_ranker_tables_v2',
  sql: `
    CREATE TABLE IF NOT EXISTS rank_items (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      section TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      embedding_id TEXT,
      metrics_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rank_items_platform ON rank_items(platform);
    CREATE INDEX IF NOT EXISTS idx_rank_items_section ON rank_items(section);
    CREATE INDEX IF NOT EXISTS idx_rank_items_source ON rank_items(source_ref);
    CREATE INDEX IF NOT EXISTS idx_rank_items_embedding ON rank_items(embedding_id);

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
};

describe('Ranker Repository', () => {
  let db: AppDatabase;
  let rankItemRepo: SQLiteRankItemRepository;
  let rankPairRepo: SQLiteRankPairRepository;
  let rankRunRepo: SQLiteRankRunRepository;
  let testDbPath: string;

  beforeAll(() => {
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    process.env.OPENROUTER_DEFAULT_MODEL = 'gpt-4';
    process.env.OPENROUTER_FALLBACK_MODEL = 'gpt-3.5-turbo';
    process.env.GITHUB_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.LINKEDIN_COOKIE = 'test-cookie';
    process.env.SQLITE_PATH = path.join(__dirname, `test_ranker_${Date.now()}.sqlite`);
    
    testDbPath = process.env.SQLITE_PATH;
    db = new AppDatabase();
    db.migrate([RANKER_V2_MIGRATION]);
    rankItemRepo = new SQLiteRankItemRepository();
    rankPairRepo = new SQLiteRankPairRepository();
    rankRunRepo = new SQLiteRankRunRepository();
  });

  afterAll(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(() => {
    db.getInstance().exec('DELETE FROM rank_pairs');
    db.getInstance().exec('DELETE FROM rank_runs');
    db.getInstance().exec('DELETE FROM rank_items');
  });

  describe('RankItem Repository', () => {
    test('should create a rank item', async () => {
      const item = {
        id: generateId(),
        platform: 'linkedin' as const,
        section: 'about',
        sourceRef: 'https://linkedin.com/in/testuser',
        embeddingId: generateId(),
        metrics: { readability: 0.85, keyword_density: 0.12 },
        createdAt: new Date().toISOString(),
      };

      const created = await rankItemRepo.create(item);

      expect(created.id).toBe(item.id);
      expect(created.platform).toBe('linkedin');
      expect(created.section).toBe('about');
      expect(created.sourceRef).toBe('https://linkedin.com/in/testuser');
      expect(created.embeddingId).toBe(item.embeddingId);
      expect(created.metrics).toEqual({ readability: 0.85, keyword_density: 0.12 });
    });

    test('should find rank item by id', async () => {
      const item = {
        id: generateId(),
        platform: 'github' as const,
        section: 'readme',
        sourceRef: 'https://github.com/test/repo',
        metrics: { stars: 100 },
        createdAt: new Date().toISOString(),
      };

      await rankItemRepo.create(item);
      const found = await rankItemRepo.findById(item.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(item.id);
      expect(found!.platform).toBe('github');
    });

    test('should find rank items by platform', async () => {
      await rankItemRepo.create({
        id: generateId(),
        platform: 'linkedin' as const,
        section: 'headline',
        sourceRef: 'user1',
        metrics: {},
        createdAt: new Date().toISOString(),
      });
      await rankItemRepo.create({
        id: generateId(),
        platform: 'linkedin' as const,
        section: 'about',
        sourceRef: 'user2',
        metrics: {},
        createdAt: new Date().toISOString(),
      });
      await rankItemRepo.create({
        id: generateId(),
        platform: 'github' as const,
        section: 'readme',
        sourceRef: 'repo1',
        metrics: {},
        createdAt: new Date().toISOString(),
      });

      const linkedinItems = await rankItemRepo.findByPlatform('linkedin');
      expect(linkedinItems).toHaveLength(2);
      linkedinItems.forEach(item => expect(item.platform).toBe('linkedin'));
    });

    test('should count rank items', async () => {
      await rankItemRepo.create({
        id: generateId(),
        platform: 'linkedin' as const,
        section: 'headline',
        sourceRef: 'user1',
        metrics: {},
        createdAt: new Date().toISOString(),
      });
      await rankItemRepo.create({
        id: generateId(),
        platform: 'linkedin' as const,
        section: 'about',
        sourceRef: 'user2',
        metrics: {},
        createdAt: new Date().toISOString(),
      });

      const total = await rankItemRepo.count();
      const linkedinCount = await rankItemRepo.count('linkedin');
      const githubCount = await rankItemRepo.count('github');

      expect(total).toBe(2);
      expect(linkedinCount).toBe(2);
      expect(githubCount).toBe(0);
    });

    test('should delete rank item', async () => {
      const item = {
        id: generateId(),
        platform: 'resume' as const,
        section: 'experience',
        sourceRef: 'resume_v1',
        metrics: {},
        createdAt: new Date().toISOString(),
      };

      await rankItemRepo.create(item);
      await rankItemRepo.delete(item.id);

      const found = await rankItemRepo.findById(item.id);
      expect(found).toBeNull();
    });
  });

  describe('RankPair Repository', () => {
    test('should create a rank pair with label 1 (A > B)', async () => {
      const itemA = {
        id: generateId(),
        platform: 'linkedin' as const,
        section: 'about',
        sourceRef: 'user_a',
        metrics: { score: 90 },
        createdAt: new Date().toISOString(),
      };
      const itemB = {
        id: generateId(),
        platform: 'linkedin' as const,
        section: 'about',
        sourceRef: 'user_b',
        metrics: { score: 70 },
        createdAt: new Date().toISOString(),
      };

      await rankItemRepo.create(itemA);
      await rankItemRepo.create(itemB);

      const pair = {
        id: generateId(),
        aItemId: itemA.id,
        bItemId: itemB.id,
        label: 1,
        reasonTags: ['more_keywords', 'better_structure'],
        source: 'benchmark' as const,
        createdAt: new Date().toISOString(),
      };

      const created = await rankPairRepo.create(pair);

      expect(created.id).toBe(pair.id);
      expect(created.aItemId).toBe(itemA.id);
      expect(created.bItemId).toBe(itemB.id);
      expect(created.label).toBe(1);
      expect(created.reasonTags).toEqual(['more_keywords', 'better_structure']);
      expect(created.source).toBe('benchmark');
    });

    test('should find rank pair by id', async () => {
      const itemA = {
        id: generateId(),
        platform: 'github' as const,
        section: 'readme',
        sourceRef: 'repo_a',
        metrics: {},
        createdAt: new Date().toISOString(),
      };
      const itemB = {
        id: generateId(),
        platform: 'github' as const,
        section: 'readme',
        sourceRef: 'repo_b',
        metrics: {},
        createdAt: new Date().toISOString(),
      };

      await rankItemRepo.create(itemA);
      await rankItemRepo.create(itemB);

      const pair = {
        id: generateId(),
        aItemId: itemA.id,
        bItemId: itemB.id,
        label: -1,
        source: 'user_choice' as const,
        createdAt: new Date().toISOString(),
      };

      await rankPairRepo.create(pair);
      const found = await rankPairRepo.findById(pair.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(pair.id);
      expect(found!.label).toBe(-1);
      expect(found!.source).toBe('user_choice');
    });

    test('should find pairs by source', async () => {
      const itemA = { id: generateId(), platform: 'linkedin' as const, section: 'headline' as const, sourceRef: 'u1', metrics: {}, createdAt: new Date().toISOString() };
      const itemB = { id: generateId(), platform: 'linkedin' as const, section: 'headline' as const, sourceRef: 'u2', metrics: {}, createdAt: new Date().toISOString() };
      await rankItemRepo.create(itemA);
      await rankItemRepo.create(itemB);

      await rankPairRepo.create({
        id: generateId(),
        aItemId: itemA.id,
        bItemId: itemB.id,
        label: 1,
        source: 'benchmark' as const,
        createdAt: new Date().toISOString(),
      });

      const benchmarkPairs = await rankPairRepo.findBySource('benchmark');
      expect(benchmarkPairs.length).toBeGreaterThanOrEqual(1);
      expect(benchmarkPairs[0].source).toBe('benchmark');
    });

    test('should count pairs by source', async () => {
      const itemA = { id: generateId(), platform: 'linkedin' as const, section: 'about' as const, sourceRef: 'u1', metrics: {}, createdAt: new Date().toISOString() };
      const itemB = { id: generateId(), platform: 'linkedin' as const, section: 'about' as const, sourceRef: 'u2', metrics: {}, createdAt: new Date().toISOString() };
      await rankItemRepo.create(itemA);
      await rankItemRepo.create(itemB);

      await rankPairRepo.create({
        id: generateId(),
        aItemId: itemA.id,
        bItemId: itemB.id,
        label: 1,
        source: 'heuristic' as const,
        createdAt: new Date().toISOString(),
      });

      const count = await rankPairRepo.count('heuristic');
      expect(count).toBe(1);
    });
  });

  describe('RankRun Repository', () => {
    test('should create a rank run', async () => {
      const run = {
        id: generateId(),
        modelPath: '/models/ranker_v1.onnx',
        metadataPath: '/models/ranker_v1_metadata.json',
        datasetHash: 'abc123def456',
        trainMetrics: { accuracy: 0.92, loss: 0.15 },
        createdAt: new Date().toISOString(),
      };

      const created = await rankRunRepo.create(run);

      expect(created.id).toBe(run.id);
      expect(created.modelPath).toBe('/models/ranker_v1.onnx');
      expect(created.datasetHash).toBe('abc123def456');
      expect(created.trainMetrics).toEqual({ accuracy: 0.92, loss: 0.15 });
    });

    test('should find rank run by id', async () => {
      const run = {
        id: generateId(),
        modelPath: '/models/ranker_v2.onnx',
        metadataPath: '/models/ranker_v2.json',
        datasetHash: 'xyz789',
        trainMetrics: { accuracy: 0.95 },
        createdAt: new Date().toISOString(),
      };

      await rankRunRepo.create(run);
      const found = await rankRunRepo.findById(run.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(run.id);
      expect(found!.trainMetrics).toEqual({ accuracy: 0.95 });
    });

    test('should find latest rank run', async () => {
      const run1 = {
        id: generateId(),
        modelPath: '/models/old.onnx',
        metadataPath: '/models/old.json',
        datasetHash: 'hash1',
        trainMetrics: {},
        createdAt: new Date(Date.now() - 10000).toISOString(),
      };
      const run2 = {
        id: generateId(),
        modelPath: '/models/new.onnx',
        metadataPath: '/models/new.json',
        datasetHash: 'hash2',
        trainMetrics: {},
        createdAt: new Date().toISOString(),
      };

      await rankRunRepo.create(run1);
      await rankRunRepo.create(run2);

      const latest = await rankRunRepo.findLatest();
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe(run2.id);
    });

    test('should list rank runs', async () => {
      for (let i = 0; i < 5; i++) {
        await rankRunRepo.create({
          id: generateId(),
          modelPath: `/models/run_${i}.onnx`,
          metadataPath: `/models/run_${i}.json`,
          datasetHash: `hash_${i}`,
          trainMetrics: {},
          createdAt: new Date().toISOString(),
        });
      }

      const runs = await rankRunRepo.list(3);
      expect(runs).toHaveLength(3);
    });

    test('should count rank runs', async () => {
      await rankRunRepo.create({
        id: generateId(),
        modelPath: '/models/r1.onnx',
        metadataPath: '/models/r1.json',
        datasetHash: 'h1',
        trainMetrics: {},
        createdAt: new Date().toISOString(),
      });

      const count = await rankRunRepo.count();
      expect(count).toBe(1);
    });
  });

  describe('Integration', () => {
    test('should create rank item and rank pair together', async () => {
      const itemA = {
        id: generateId(),
        platform: 'linkedin' as const,
        section: 'headline' as const,
        sourceRef: 'benchmark_founder_1',
        metrics: { clarity: 0.9, impact: 0.85 },
        createdAt: new Date().toISOString(),
      };
      const itemB = {
        id: generateId(),
        platform: 'linkedin' as const,
        section: 'headline' as const,
        sourceRef: 'benchmark_engineer_1',
        metrics: { clarity: 0.7, impact: 0.6 },
        createdAt: new Date().toISOString(),
      };

      await rankItemRepo.create(itemA);
      await rankItemRepo.create(itemB);

      const pair = {
        id: generateId(),
        aItemId: itemA.id,
        bItemId: itemB.id,
        label: 1,
        reasonTags: ['higher_impact', 'clearer_messaging'],
        source: 'benchmark' as const,
        createdAt: new Date().toISOString(),
      };

      await rankPairRepo.create(pair);

      const foundPair = await rankPairRepo.findById(pair.id);
      expect(foundPair).not.toBeNull();
      expect(foundPair!.aItemId).toBe(itemA.id);
      expect(foundPair!.bItemId).toBe(itemB.id);

      const foundItemA = await rankItemRepo.findById(itemA.id);
      const foundItemB = await rankItemRepo.findById(itemB.id);
      expect(foundItemA).not.toBeNull();
      expect(foundItemB).not.toBeNull();
    });
  });
});
