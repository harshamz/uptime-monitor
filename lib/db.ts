import { DatabaseSync } from 'node:sqlite';
import path from 'path';

// Railway Volume /data pe mount hoti hai — warna local cwd
const DB_PATH = process.env.DB_PATH || path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd(), 'data.db');

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    initSchema(db);
  }
  return db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      check_interval INTEGER NOT NULL DEFAULT 5,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      checked_at INTEGER NOT NULL DEFAULT (unixepoch()),
      status TEXT NOT NULL,
      status_code INTEGER,
      response_time INTEGER,
      error TEXT,
      ssl_days_left INTEGER,
      ssl_valid INTEGER
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_checks_monitor_id ON checks(monitor_id);
    CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at);
  `);
}

export type Monitor = {
  id: number;
  name: string;
  url: string;
  check_interval: number;
  enabled: number;
  created_at: number;
};

export type Check = {
  id: number;
  monitor_id: number;
  checked_at: number;
  status: 'up' | 'down' | 'ssl_warning' | 'ssl_expired';
  status_code: number | null;
  response_time: number | null;
  error: string | null;
  ssl_days_left: number | null;
  ssl_valid: number | null;
};
