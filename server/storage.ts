import {
  workspaces,
  sources,
  assets,
  schedules,
} from "@shared/schema";
import type {
  Workspace,
  InsertWorkspace,
  Source,
  InsertSource,
  Asset,
  InsertAsset,
  Schedule,
  InsertSchedule,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Auto-migrate (idempotent) — keeps deployment simple.
sqlite.exec(`
CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  industry TEXT,
  brand_color TEXT DEFAULT '#0f766e',
  logo_text TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  content TEXT NOT NULL,
  meta TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  prompt TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  file_path TEXT,
  content_html TEXT,
  outline TEXT,
  source_ids TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  cadence TEXT NOT NULL,
  prompt TEXT NOT NULL,
  recipients TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER,
  created_at INTEGER NOT NULL
);
`);

export const db = drizzle(sqlite);

export interface IStorage {
  // Workspaces
  listWorkspaces(): Workspace[];
  getWorkspace(id: number): Workspace | undefined;
  createWorkspace(w: InsertWorkspace): Workspace;
  updateWorkspace(id: number, w: Partial<InsertWorkspace>): Workspace | undefined;
  // Sources
  listSources(workspaceId: number): Source[];
  getSource(id: number): Source | undefined;
  createSource(s: InsertSource): Source;
  deleteSource(id: number): void;
  // Assets
  listAssets(workspaceId: number): Asset[];
  getAsset(id: number): Asset | undefined;
  createAsset(a: InsertAsset): Asset;
  updateAsset(id: number, a: Partial<InsertAsset>): Asset | undefined;
  deleteAsset(id: number): void;
  // Schedules
  listSchedules(workspaceId: number): Schedule[];
  createSchedule(s: InsertSchedule): Schedule;
  updateSchedule(id: number, s: Partial<InsertSchedule>): Schedule | undefined;
  deleteSchedule(id: number): void;
}

class DatabaseStorage implements IStorage {
  listWorkspaces(): Workspace[] {
    return db.select().from(workspaces).orderBy(desc(workspaces.createdAt)).all();
  }
  getWorkspace(id: number) {
    return db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  }
  createWorkspace(w: InsertWorkspace) {
    return db
      .insert(workspaces)
      .values({ ...w, createdAt: Date.now() })
      .returning()
      .get();
  }
  updateWorkspace(id: number, w: Partial<InsertWorkspace>) {
    return db.update(workspaces).set(w).where(eq(workspaces.id, id)).returning().get();
  }

  listSources(workspaceId: number) {
    return db
      .select()
      .from(sources)
      .where(eq(sources.workspaceId, workspaceId))
      .orderBy(desc(sources.createdAt))
      .all();
  }
  getSource(id: number) {
    return db.select().from(sources).where(eq(sources.id, id)).get();
  }
  createSource(s: InsertSource) {
    return db
      .insert(sources)
      .values({ ...s, createdAt: Date.now() })
      .returning()
      .get();
  }
  deleteSource(id: number) {
    db.delete(sources).where(eq(sources.id, id)).run();
  }

  listAssets(workspaceId: number) {
    return db
      .select()
      .from(assets)
      .where(eq(assets.workspaceId, workspaceId))
      .orderBy(desc(assets.createdAt))
      .all();
  }
  getAsset(id: number) {
    return db.select().from(assets).where(eq(assets.id, id)).get();
  }
  createAsset(a: InsertAsset) {
    return db
      .insert(assets)
      .values({ ...a, createdAt: Date.now() })
      .returning()
      .get();
  }
  updateAsset(id: number, a: Partial<InsertAsset>) {
    return db.update(assets).set(a).where(eq(assets.id, id)).returning().get();
  }
  deleteAsset(id: number) {
    db.delete(assets).where(eq(assets.id, id)).run();
  }

  listSchedules(workspaceId: number) {
    return db
      .select()
      .from(schedules)
      .where(eq(schedules.workspaceId, workspaceId))
      .orderBy(desc(schedules.createdAt))
      .all();
  }
  createSchedule(s: InsertSchedule) {
    return db
      .insert(schedules)
      .values({ ...s, createdAt: Date.now() })
      .returning()
      .get();
  }
  updateSchedule(id: number, s: Partial<InsertSchedule>) {
    return db.update(schedules).set(s).where(eq(schedules.id, id)).returning().get();
  }
  deleteSchedule(id: number) {
    db.delete(schedules).where(eq(schedules.id, id)).run();
  }
}

export const storage = new DatabaseStorage();
