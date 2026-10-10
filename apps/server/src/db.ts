import { DatabaseSync } from 'node:sqlite';
import { GroundDocumentSchema, TopicSchema, type GroundDocument, type Topic } from '@ground/core';

/**
 * Storage keeps each record as a JSON blob plus the columns needed for sync.
 * Deletes are soft (tombstones) so other devices learn about them on their next sync.
 */

type Collection = 'documents' | 'topics';

export interface ChangeSet<T> {
  upserted: T[];
  deletedIds: string[];
}

export class Store {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        server_seq INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        server_seq INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
      INSERT OR IGNORE INTO meta (key, value) VALUES ('seq', 0);
    `);
  }

  close() {
    this.db.close();
  }

  /** Monotonic counter; clients use it as their sync cursor so clock skew doesn't matter. */
  private nextSeq(): number {
    const row = this.db.prepare(`UPDATE meta SET value = value + 1 WHERE key = 'seq' RETURNING value`).get() as { value: number };
    return row.value;
  }

  currentSeq(): number {
    return (this.db.prepare(`SELECT value FROM meta WHERE key = 'seq'`).get() as { value: number }).value;
  }

  /** Last write wins, by the client's `updatedAt`. Returns false when a newer version is already stored. */
  private upsert(table: Collection, id: string, data: unknown, updatedAt: string): boolean {
    const existing = this.db.prepare(`SELECT updated_at FROM ${table} WHERE id = ?`).get(id) as { updated_at: string } | undefined;
    if (existing && existing.updated_at > updatedAt) return false;
    this.db
      .prepare(
        `INSERT INTO ${table} (id, data, updated_at, server_seq, deleted) VALUES (?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, server_seq = excluded.server_seq, deleted = 0`,
      )
      .run(id, JSON.stringify(data), updatedAt, this.nextSeq());
    return true;
  }

  private remove(table: Collection, id: string): boolean {
    const result = this.db
      .prepare(`UPDATE ${table} SET deleted = 1, data = '{}', server_seq = ? WHERE id = ? AND deleted = 0`)
      .run(this.nextSeq(), id);
    return result.changes > 0;
  }

  private list(table: Collection, sinceSeq = 0): { rows: { id: string; data: string; deleted: number }[] } {
    const rows = this.db
      .prepare(`SELECT id, data, deleted FROM ${table} WHERE server_seq > ? ORDER BY server_seq`)
      .all(sinceSeq) as { id: string; data: string; deleted: number }[];
    return { rows };
  }

  private changes<T>(table: Collection, sinceSeq: number, parse: (raw: unknown) => T): ChangeSet<T> {
    const { rows } = this.list(table, sinceSeq);
    return {
      upserted: rows.filter((r) => !r.deleted).map((r) => parse(JSON.parse(r.data))),
      deletedIds: sinceSeq > 0 ? rows.filter((r) => r.deleted).map((r) => r.id) : [],
    };
  }

  getDocument(id: string): GroundDocument | null {
    const row = this.db.prepare(`SELECT data FROM documents WHERE id = ? AND deleted = 0`).get(id) as { data: string } | undefined;
    return row ? GroundDocumentSchema.parse(JSON.parse(row.data)) : null;
  }

  putDocument(doc: GroundDocument): boolean {
    // Image URIs point at files on one device; they are meaningless elsewhere.
    return this.upsert('documents', doc.id, { ...doc, imageUri: null }, doc.updatedAt);
  }

  deleteDocument(id: string): boolean {
    return this.remove('documents', id);
  }

  documentChanges(sinceSeq = 0): ChangeSet<GroundDocument> {
    return this.changes('documents', sinceSeq, (raw) => GroundDocumentSchema.parse(raw));
  }

  putTopic(topic: Topic & { updatedAt?: string }): boolean {
    return this.upsert('topics', topic.id, topic, topic.updatedAt ?? new Date().toISOString());
  }

  deleteTopic(id: string): boolean {
    return this.remove('topics', id);
  }

  topicChanges(sinceSeq = 0): ChangeSet<Topic> {
    return this.changes('topics', sinceSeq, (raw) => TopicSchema.parse(raw));
  }
}
