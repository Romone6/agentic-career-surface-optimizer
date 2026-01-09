import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

let SQL: any = null;
let dbInstance: any = null;
const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'benchmark.db');

export async function initDb(): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
    createSchema();
  }
}

function createSchema(): void {
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS benchmark_profiles (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      username TEXT NOT NULL,
      url TEXT,
      is_elite INTEGER DEFAULT 0,
      raw_data_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS benchmark_sections (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      section_type TEXT NOT NULL,
      content TEXT,
      word_count INTEGER,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS benchmark_embeddings (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      text_hash TEXT NOT NULL,
      vector BLOB,
      model TEXT,
      dimensions INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(section_id)
    )
  `);
}

export function getDb(): any {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function getDbPath(): string {
  return dbPath;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function dbRun(sql: string, params: any[] = []): void {
  const db = getDb();
  if (params.length === 0) {
    db.run(sql);
  } else {
    db.run(sql, params);
  }
  saveDb();
}

export function dbGet<T>(sql: string, params: any[] = []): T | null {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return row as T;
}

export function dbAll<T>(sql: string, params: any[] = []): T[] {
  const db = getDb();
  const results: T[] = [];
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function dbExec(sql: string): void {
  const db = getDb();
  db.run(sql);
  saveDb();
}
