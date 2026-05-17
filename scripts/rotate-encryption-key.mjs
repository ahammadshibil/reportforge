#!/usr/bin/env node
// Rotate BYOR_ENCRYPTION_KEY without losing connection configs.
//
// Walks every row in the `connections` table, decrypts the `config` column
// with the OLD key, re-encrypts with the NEW key, writes back inside a
// transaction. If any row fails to decrypt, the whole rotation aborts
// without modifying the DB — safer than half-rotating.
//
// Usage:
//   OLD_ENCRYPTION_KEY=<current> NEW_ENCRYPTION_KEY=<new> \
//     node scripts/rotate-encryption-key.mjs
//
// Optional env:
//   DATA_DIR=/path/to/data       (default ".")
//   DRY_RUN=1                    (analyze only, no writes)
//   ROTATE_FROM_SESSION=1        (when migrating off the SESSION_SECRET
//                                  fallback path — OLD_ENCRYPTION_KEY
//                                  becomes the OLD SESSION_SECRET)
//
// Workflow:
//   1. Back up data.db first:    cp data/data.db data/data.db.bak
//   2. Run with DRY_RUN=1 to verify everything decrypts cleanly
//   3. Run for real
//   4. Update BYOR_ENCRYPTION_KEY env on your deploy to the NEW value
//   5. Restart the server
//   6. Verify a connection still works (Connections page → Browse / Sync)
//   7. Delete the .bak

import Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const OLD = (process.env.OLD_ENCRYPTION_KEY || "").trim();
const NEW = (process.env.NEW_ENCRYPTION_KEY || "").trim();
const DATA_DIR = process.env.DATA_DIR || ".";
const DRY_RUN = process.env.DRY_RUN === "1";
const ROTATE_FROM_SESSION = process.env.ROTATE_FROM_SESSION === "1";

if (!OLD || !NEW) {
  console.error("❌ OLD_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY are required.");
  console.error("");
  console.error("Example:");
  console.error("  OLD_ENCRYPTION_KEY=abc123 NEW_ENCRYPTION_KEY=def456 \\");
  console.error("    node scripts/rotate-encryption-key.mjs");
  process.exit(1);
}
if (OLD === NEW) {
  console.error("❌ OLD and NEW keys are identical. Nothing to rotate.");
  process.exit(1);
}

const PREFIX = "enc:v1:";
const KEY_BYTES = 32;

function deriveKey(passphrase, fallback = false) {
  const saltLabel = fallback ? "byor.encryption.fallback.v1" : "byor.encryption.v1";
  return crypto.hkdfSync(
    "sha256",
    Buffer.from(passphrase),
    Buffer.from(saltLabel),
    "byor-cfg",
    KEY_BYTES
  );
}

function decryptWith(key, stored) {
  if (typeof stored !== "string" || !stored.startsWith(PREFIX)) return null; // plaintext or null
  const rest = stored.slice(PREFIX.length);
  const [ivB64, dataB64, tagB64] = rest.split(":");
  if (!ivB64 || !dataB64 || !tagB64) throw new Error("malformed envelope");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

function encryptWith(key, plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(key), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
}

const oldKey = deriveKey(OLD, ROTATE_FROM_SESSION);
const newKey = deriveKey(NEW, false); // always derive NEW with primary algo

const dbPath = path.join(DATA_DIR, "data.db");
if (!fs.existsSync(dbPath)) {
  console.error(`❌ data.db not found at ${dbPath}`);
  console.error("   Set DATA_DIR to point at the directory holding data.db");
  process.exit(1);
}

console.log(`📂 Opening ${dbPath}${DRY_RUN ? "  (DRY RUN)" : ""}`);
const db = new Database(dbPath);
const rows = db
  .prepare("SELECT id, name, type, config FROM connections")
  .all();
console.log(`📋 Found ${rows.length} connection(s)`);

let rotated = 0;
let promotedFromPlaintext = 0;
let errored = 0;
const updates = [];

for (const row of rows) {
  if (!row.config) continue;
  const isEncrypted = typeof row.config === "string" && row.config.startsWith(PREFIX);
  if (!isEncrypted) {
    promotedFromPlaintext++;
    console.log(`  #${row.id} [${row.type}] ${row.name}  → plaintext, will encrypt with NEW key`);
    updates.push({ id: row.id, newConfig: encryptWith(newKey, row.config) });
    continue;
  }
  try {
    const plain = decryptWith(oldKey, row.config);
    if (plain === null) {
      console.log(`  #${row.id} [${row.type}] ${row.name}  → no encrypted payload, skipping`);
      continue;
    }
    const reencrypted = encryptWith(newKey, plain);
    updates.push({ id: row.id, newConfig: reencrypted });
    rotated++;
    console.log(`  #${row.id} [${row.type}] ${row.name}  → rotated`);
  } catch (e) {
    errored++;
    console.error(`  #${row.id} [${row.type}] ${row.name}  ❌ ${e?.message ?? e}`);
  }
}

console.log("");
console.log(`Summary: rotated=${rotated} · promoted=${promotedFromPlaintext} · errored=${errored}`);

if (errored > 0) {
  console.error("");
  console.error("⛔ Aborted without changes. Some rows could not be decrypted with OLD key.");
  console.error("   Verify OLD_ENCRYPTION_KEY matches the value currently used by BYOR.");
  console.error("   If you were running with no BYOR_ENCRYPTION_KEY (fallback mode),");
  console.error("   set ROTATE_FROM_SESSION=1 and pass the OLD SESSION_SECRET as");
  console.error("   OLD_ENCRYPTION_KEY.");
  process.exit(1);
}

if (DRY_RUN) {
  console.log("");
  console.log(`📝 DRY RUN: would update ${updates.length} row(s). Re-run without DRY_RUN=1 to commit.`);
  process.exit(0);
}

if (updates.length === 0) {
  console.log("Nothing to write. Done.");
  process.exit(0);
}

console.log(`💾 Writing ${updates.length} update(s) in a transaction...`);
const tx = db.transaction((updates) => {
  const stmt = db.prepare("UPDATE connections SET config = ? WHERE id = ?");
  for (const u of updates) stmt.run(u.newConfig, u.id);
});
tx(updates);

console.log("");
console.log("✅ Rotation complete.");
console.log("");
console.log("Next steps:");
console.log("  1. Update BYOR_ENCRYPTION_KEY on your deploy to the NEW value");
console.log("  2. Restart the server");
console.log("  3. Connections page → click Browse on each connection to verify");
console.log("  4. Delete data/data.db.bak after a few days of confirmed normal operation");
