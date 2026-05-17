import {
  workspaces,
  sources,
  assets,
  schedules,
  connections,
  templates,
  assetVersions,
  appSettings,
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
  Connection,
  InsertConnection,
  Template,
  InsertTemplate,
  AssetVersion,
  InsertAssetVersion,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "./secrets";

// DATA_DIR lets prod deploys point at a persistent volume mount.
const DATA_DIR = process.env.DATA_DIR || ".";
import fs from "node:fs";
import path from "node:path";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
export const sqlite = new Database(path.join(DATA_DIR, "data.db"));
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
  delivery_targets TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  config TEXT NOT NULL,
  account_email TEXT,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  schema TEXT NOT NULL,
  preview_image TEXT,
  brand_color TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS asset_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  content_html TEXT,
  file_path TEXT,
  outline TEXT,
  prompt TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_asset_versions_asset ON asset_versions(asset_id);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

// Additive migrations — safe to run repeatedly. Each ALTER is wrapped so
// missing-column adds succeed and re-runs (column already exists) silently noop.
function tryAlter(sql: string) {
  try {
    sqlite.exec(sql);
  } catch {
    /* column exists or other benign — skip */
  }
}
tryAlter(`ALTER TABLE sources ADD COLUMN connection_id INTEGER`);
tryAlter(`ALTER TABLE sources ADD COLUMN external_id TEXT`);
tryAlter(`ALTER TABLE sources ADD COLUMN synced_at INTEGER`);
tryAlter(`ALTER TABLE schedules ADD COLUMN delivery_targets TEXT`);

export const db = drizzle(sqlite);
export { sqlite as _sqliteForTests };

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
  updateSource(id: number, s: Partial<InsertSource>): Source | undefined;
  deleteSource(id: number): void;
  findSourceByExternalId(connectionId: number, externalId: string): Source | undefined;
  // Assets
  listAssets(workspaceId: number): Asset[];
  getAsset(id: number): Asset | undefined;
  createAsset(a: InsertAsset): Asset;
  updateAsset(id: number, a: Partial<InsertAsset>): Asset | undefined;
  deleteAsset(id: number): void;
  // Schedules
  listSchedules(workspaceId: number): Schedule[];
  listAllSchedules(): Schedule[];
  getSchedule(id: number): Schedule | undefined;
  createSchedule(s: InsertSchedule): Schedule;
  updateSchedule(id: number, s: Partial<InsertSchedule>): Schedule | undefined;
  deleteSchedule(id: number): void;
  // Connections
  listConnections(workspaceId: number): Connection[];
  getConnection(id: number): Connection | undefined;
  createConnection(c: InsertConnection): Connection;
  updateConnection(id: number, c: Partial<InsertConnection>): Connection | undefined;
  deleteConnection(id: number): void;
  // Templates
  listTemplates(workspaceId: number): Template[];
  getTemplate(id: number): Template | undefined;
  createTemplate(t: InsertTemplate): Template;
  updateTemplate(id: number, t: Partial<InsertTemplate>): Template | undefined;
  deleteTemplate(id: number): void;
  // Asset versions
  listAssetVersions(assetId: number): AssetVersion[];
  getAssetVersion(versionId: number): AssetVersion | undefined;
  createAssetVersion(v: InsertAssetVersion): AssetVersion;
  countAssetVersions(assetId: number): number;
  // App settings (key/value)
  getAllSettings(): Record<string, string>;
  setSetting(key: string, value: string): void;
  deleteSetting(key: string): void;
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
  updateSource(id: number, s: Partial<InsertSource>) {
    return db.update(sources).set(s).where(eq(sources.id, id)).returning().get();
  }
  deleteSource(id: number) {
    db.delete(sources).where(eq(sources.id, id)).run();
  }
  findSourceByExternalId(connectionId: number, externalId: string) {
    return db
      .select()
      .from(sources)
      .where(eq(sources.connectionId, connectionId))
      .all()
      .find((s) => s.externalId === externalId);
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
  listAllSchedules() {
    return db.select().from(schedules).all();
  }
  getSchedule(id: number) {
    return db.select().from(schedules).where(eq(schedules.id, id)).get();
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

  listConnections(workspaceId: number) {
    return db
      .select()
      .from(connections)
      .where(eq(connections.workspaceId, workspaceId))
      .orderBy(desc(connections.createdAt))
      .all()
      .map(decryptConnection);
  }
  getConnection(id: number) {
    const row = db.select().from(connections).where(eq(connections.id, id)).get();
    return row ? decryptConnection(row) : row;
  }
  createConnection(c: InsertConnection) {
    const row = db
      .insert(connections)
      .values({ ...encryptConnection(c), createdAt: Date.now() })
      .returning()
      .get();
    return decryptConnection(row);
  }
  updateConnection(id: number, c: Partial<InsertConnection>) {
    const row = db
      .update(connections)
      .set(encryptConnection(c))
      .where(eq(connections.id, id))
      .returning()
      .get();
    return row ? decryptConnection(row) : row;
  }
  deleteConnection(id: number) {
    db.delete(connections).where(eq(connections.id, id)).run();
  }

  listTemplates(workspaceId: number) {
    return db
      .select()
      .from(templates)
      .where(eq(templates.workspaceId, workspaceId))
      .orderBy(desc(templates.createdAt))
      .all();
  }
  getTemplate(id: number) {
    return db.select().from(templates).where(eq(templates.id, id)).get();
  }
  createTemplate(t: InsertTemplate) {
    return db
      .insert(templates)
      .values({ ...t, createdAt: Date.now() })
      .returning()
      .get();
  }
  updateTemplate(id: number, t: Partial<InsertTemplate>) {
    return db.update(templates).set(t).where(eq(templates.id, id)).returning().get();
  }
  deleteTemplate(id: number) {
    db.delete(templates).where(eq(templates.id, id)).run();
  }

  listAssetVersions(assetId: number) {
    return db
      .select()
      .from(assetVersions)
      .where(eq(assetVersions.assetId, assetId))
      .orderBy(desc(assetVersions.version))
      .all();
  }
  getAssetVersion(versionId: number) {
    return db
      .select()
      .from(assetVersions)
      .where(eq(assetVersions.id, versionId))
      .get();
  }
  createAssetVersion(v: InsertAssetVersion) {
    return db
      .insert(assetVersions)
      .values({ ...v, createdAt: Date.now() })
      .returning()
      .get();
  }
  countAssetVersions(assetId: number) {
    return this.listAssetVersions(assetId).length;
  }

  getAllSettings(): Record<string, string> {
    const rows = db.select().from(appSettings).all();
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }
  setSetting(key: string, value: string): void {
    db.insert(appSettings)
      .values({ key, value, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: Date.now() },
      })
      .run();
  }
  deleteSetting(key: string): void {
    db.delete(appSettings).where(eq(appSettings.key, key)).run();
  }
}

// Transparent encryption helpers for the connection.config column.
// Apply on every write, reverse on every read — callers see plaintext.
function encryptConnection<T extends { config?: string | null | undefined }>(c: T): T {
  if (!c || typeof c.config !== "string" || c.config.length === 0) return c;
  return { ...c, config: encryptSecret(c.config) };
}
function decryptConnection<T extends { config?: string | null | undefined }>(c: T): T {
  if (!c || typeof c.config !== "string" || c.config.length === 0) return c;
  try {
    return { ...c, config: decryptSecret(c.config) ?? c.config };
  } catch {
    // Decrypt failed — likely wrong key or corrupted row. Return as-is so
    // the rest of the app keeps working; the connection will fail on use.
    return c;
  }
}

export const storage = new DatabaseStorage();
