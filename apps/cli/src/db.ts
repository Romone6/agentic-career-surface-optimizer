import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

export function getDbPath(): string {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'ranker', 'benchmark.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  return dbPath;
}

export function getDb(): sqlite3.Database {
  return new sqlite3.Database(getDbPath());
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function dbRunAsync(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function dbGetAsync<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

export function dbAllAsync<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}
