import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const MAX_LIMIT = 1000;
export const DEFAULT_LIMIT = 500;

/**
 * Clamp a user-supplied `limit` to the range 1..MAX_LIMIT.
 * Negative values are dangerous: SQLite treats a negative LIMIT as unlimited.
 * Non-numeric input falls back to DEFAULT_LIMIT.
 */
export function clampLimit(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  const truncated = Math.trunc(parsed);
  if (truncated < 1) return 1;
  if (truncated > MAX_LIMIT) return MAX_LIMIT;
  return truncated;
}

export interface EventRow {
  id: number;
  agreement_id: string;
  event_type: string;
  payload: string;
  ledger: number;
  created_at: string;
}

export interface Db {
  insertEvent(event: Omit<EventRow, 'id' | 'created_at'>): void;
  getEvents(agreementId: string, limit: number): EventRow[];
  close(): void;
}

export function openDb(path: string): Db {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agreement_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      ledger INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_agreement ON events(agreement_id, id);
  `);

  const insertStmt = db.prepare(
    `INSERT INTO events (agreement_id, event_type, payload, ledger)
     VALUES (@agreement_id, @event_type, @payload, @ledger)`
  );
  const selectStmt = db.prepare(
    `SELECT id, agreement_id, event_type, payload, ledger, created_at
     FROM events WHERE agreement_id = ? ORDER BY id DESC LIMIT ?`
  );

  return {
    insertEvent(event) {
      insertStmt.run(event);
    },
    getEvents(agreementId, limit) {
      return selectStmt.all(agreementId, clampLimit(limit)) as EventRow[];
    },
    close() {
      db.close();
    },
  };
}
