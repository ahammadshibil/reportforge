// Persistent session store on top of our existing better-sqlite3 instance.
// Replaces memorystore so sessions survive restart, redeploy, scaling.
//
// One table, no new dependency. ~50 lines that just satisfy the
// express-session Store interface.

import session from "express-session";
import Database from "better-sqlite3";

export class SqliteSessionStore extends session.Store {
  private db: Database.Database;
  private ttlMs: number;

  constructor(db: Database.Database, ttlMs = 1000 * 60 * 60 * 24 * 30) {
    super();
    this.db = db;
    this.ttlMs = ttlMs;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `);
    setInterval(() => this.purge(), 1000 * 60 * 60).unref();
    this.purge();
  }

  private purge() {
    try {
      this.db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(Date.now());
    } catch {}
  }

  get(sid: string, cb: (err: any, session?: session.SessionData | null) => void) {
    try {
      const row = this.db
        .prepare(`SELECT expires_at, data FROM sessions WHERE sid = ?`)
        .get(sid) as { expires_at: number; data: string } | undefined;
      if (!row) return cb(null, null);
      if (row.expires_at <= Date.now()) {
        this.db.prepare(`DELETE FROM sessions WHERE sid = ?`).run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data));
    } catch (e) {
      cb(e);
    }
  }

  set(sid: string, sess: session.SessionData, cb?: (err?: any) => void) {
    try {
      const ttl = (sess?.cookie?.maxAge as number | undefined) ?? this.ttlMs;
      const expires = Date.now() + ttl;
      this.db
        .prepare(
          `INSERT INTO sessions (sid, expires_at, data) VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET expires_at = excluded.expires_at, data = excluded.data`
        )
        .run(sid, expires, JSON.stringify(sess));
      cb?.();
    } catch (e) {
      cb?.(e);
    }
  }

  destroy(sid: string, cb?: (err?: any) => void) {
    try {
      this.db.prepare(`DELETE FROM sessions WHERE sid = ?`).run(sid);
      cb?.();
    } catch (e) {
      cb?.(e);
    }
  }

  touch(sid: string, sess: session.SessionData, cb?: () => void) {
    try {
      const ttl = (sess?.cookie?.maxAge as number | undefined) ?? this.ttlMs;
      this.db
        .prepare(`UPDATE sessions SET expires_at = ? WHERE sid = ?`)
        .run(Date.now() + ttl, sid);
    } catch {}
    cb?.();
  }
}
