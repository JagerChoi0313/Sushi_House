import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BACKEND_DIR = path.resolve(__dirname, '..');
export const PROJECT_DIR = path.resolve(BACKEND_DIR, '..');
export const DB_PATH = process.env.SUSHI_DB || path.join(PROJECT_DIR, 'database', 'sushi_house.db');
export const SCHEMA_PATH = path.join(BACKEND_DIR, 'schema.sql');
export const UPLOAD_DIR = path.join(PROJECT_DIR, 'uploads');

let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
  dbInstance = db;
  return db;
}

export function initSchema(db = getDb()) {
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
