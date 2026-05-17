// Periodic cleanup. Runs once a day (and once at boot) so a long-running
// BYOR instance doesn't grow unbounded.
//
// Three things to garbage-collect:
//   1. Orphaned files in generated/ that no asset row references anymore.
//   2. Old asset_versions rows beyond CLEANUP_KEEP_VERSIONS, retained only
//      while younger than CLEANUP_RETENTION_DAYS.
//   3. Failed assets older than CLEANUP_FAILED_TTL_DAYS — generation can
//      glitch occasionally; we don't need to keep those forever.
//
// Tunable via env (sensible defaults):
//   CLEANUP_DISABLED=1               turn off entirely
//   CLEANUP_RETENTION_DAYS=30        how long old asset_versions can hang around
//   CLEANUP_KEEP_VERSIONS=5          always keep at least N versions per asset
//   CLEANUP_FAILED_TTL_DAYS=14       how long to keep failed/abandoned assets
//   CLEANUP_GENERATED_TTL_DAYS=60    how long an orphan file in generated/ survives

import fs from "node:fs";
import path from "node:path";
import { storage, sqlite, db } from "./storage";
import { assetVersions, assets } from "@shared/schema";
import { eq, lt, and } from "drizzle-orm";

const DAY = 24 * 60 * 60 * 1000;

function envInt(name: string, def: number): number {
  const raw = process.env[name];
  // Empty / unset / whitespace → use default. (Number("") is 0, which would
  // silently turn every TTL knob into 'delete everything immediately' — a
  // real bug caught during the 12-test functional sweep.)
  if (raw === undefined || raw === null || String(raw).trim() === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : def;
}

function tunables() {
  return {
    retentionDays: envInt("CLEANUP_RETENTION_DAYS", 30),
    keepVersions: envInt("CLEANUP_KEEP_VERSIONS", 5),
    failedTtlDays: envInt("CLEANUP_FAILED_TTL_DAYS", 14),
    generatedTtlDays: envInt("CLEANUP_GENERATED_TTL_DAYS", 60),
  };
}

export type CleanupReport = {
  generatedFilesDeleted: number;
  versionsDeleted: number;
  failedAssetsDeleted: number;
  generatedDir: string;
  ranAt: number;
};

function generatedDir(): string {
  return path.resolve(process.env.DATA_DIR || ".", "generated");
}

// Build the set of file paths still referenced by any asset.
function referencedFiles(): Set<string> {
  const refs = new Set<string>();
  for (const ws of storage.listWorkspaces()) {
    for (const a of storage.listAssets(ws.id)) {
      if (a.filePath) refs.add(path.resolve(a.filePath));
    }
  }
  // Also include files referenced from asset_versions rows (older snapshots).
  for (const row of db.select().from(assetVersions).all()) {
    if (row.filePath) refs.add(path.resolve(row.filePath));
  }
  return refs;
}

function pruneOrphanFiles(opts: { ttlMs: number }): number {
  const dir = generatedDir();
  if (!fs.existsSync(dir)) return 0;
  const refs = referencedFiles();
  const now = Date.now();
  let deleted = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.resolve(dir, name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (refs.has(full)) continue; // still referenced
    if (now - stat.mtimeMs < opts.ttlMs) continue; // too young
    try {
      fs.unlinkSync(full);
      deleted++;
    } catch {
      /* ignore — next pass picks it up */
    }
  }
  return deleted;
}

function pruneOldVersions(opts: { retentionMs: number; keepLatest: number }): number {
  // For each asset, sort its versions desc, keep the top N + anything younger
  // than retentionMs, delete the rest.
  const cutoff = Date.now() - opts.retentionMs;
  let deleted = 0;
  // Get the distinct asset_ids that have any version row
  const rows = db
    .select({ assetId: assetVersions.assetId })
    .from(assetVersions)
    .all();
  const ids = Array.from(new Set(rows.map((r) => r.assetId)));
  for (const aid of ids) {
    const versions = db
      .select()
      .from(assetVersions)
      .where(eq(assetVersions.assetId, aid))
      .all()
      .sort((a, b) => b.version - a.version);
    const protectedCount = Math.max(0, opts.keepLatest);
    for (let i = protectedCount; i < versions.length; i++) {
      const v = versions[i];
      if (v.createdAt > cutoff) continue; // still inside retention window
      // Best-effort: delete any file path the snapshot references
      if (v.filePath && fs.existsSync(v.filePath)) {
        try {
          fs.unlinkSync(v.filePath);
        } catch {
          /* ignore */
        }
      }
      db.delete(assetVersions).where(eq(assetVersions.id, v.id)).run();
      deleted++;
    }
  }
  return deleted;
}

function pruneFailedAssets(opts: { ttlMs: number }): number {
  const cutoff = Date.now() - opts.ttlMs;
  const rows = db
    .select()
    .from(assets)
    .where(and(eq(assets.status, "failed"), lt(assets.createdAt, cutoff)))
    .all();
  let deleted = 0;
  for (const a of rows) {
    // Drop the asset (asset_versions for it are pruned via pruneOldVersions
    // on the next pass — we leave them for at most one cycle).
    if (a.filePath && fs.existsSync(a.filePath)) {
      try {
        fs.unlinkSync(a.filePath);
      } catch {
        /* ignore */
      }
    }
    db.delete(assets).where(eq(assets.id, a.id)).run();
    deleted++;
  }
  return deleted;
}

export async function runCleanup(): Promise<CleanupReport> {
  const t = tunables();
  const generatedFilesDeleted = pruneOrphanFiles({
    ttlMs: t.generatedTtlDays * DAY,
  });
  const versionsDeleted = pruneOldVersions({
    retentionMs: t.retentionDays * DAY,
    keepLatest: t.keepVersions,
  });
  const failedAssetsDeleted = pruneFailedAssets({ ttlMs: t.failedTtlDays * DAY });
  return {
    generatedFilesDeleted,
    versionsDeleted,
    failedAssetsDeleted,
    generatedDir: generatedDir(),
    ranAt: Date.now(),
  };
}

let started = false;

export function startCleanup() {
  if (started || process.env.CLEANUP_DISABLED === "1") return;
  started = true;
  // Run once at boot (3min after start so it doesn't fight other warm-up work),
  // then every 24h.
  setTimeout(() => {
    runCleanup()
      .then((r) => console.log(`[cleanup] boot pass:`, r))
      .catch((e) => console.error(`[cleanup] boot pass failed:`, e?.message));
  }, 3 * 60 * 1000).unref();
  setInterval(() => {
    runCleanup()
      .then((r) => console.log(`[cleanup] daily pass:`, r))
      .catch((e) => console.error(`[cleanup] daily pass failed:`, e?.message));
  }, DAY).unref();
  console.log(`[cleanup] started (CLEANUP_DISABLED=1 to opt out)`);
}
