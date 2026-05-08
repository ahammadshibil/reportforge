// At-rest encryption for sensitive blobs (connection configs holding OAuth
// refresh tokens, Airtable PATs, MCP env credentials, etc).
//
// Algorithm: AES-256-GCM. Key derivation: BYOR_ENCRYPTION_KEY env var
// (preferred) or HKDF from SESSION_SECRET (fallback for existing deploys
// that don't have a separate encryption key set).
//
// Storage format: "enc:v1:<base64 iv>:<base64 ciphertext>:<base64 tag>"
// — version-prefixed so future algorithm rotation stays clean.
//
// Backward compatibility: encryptSecret() always emits the prefixed
// format. decryptSecret() detects the prefix; if absent it returns the
// input unchanged. Existing rows written before this change keep working
// until something rewrites them — at which point they get encrypted.

import crypto from "node:crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard
const KEY_BYTES = 32; // 256-bit

let cachedKey: Buffer | null = null;

function deriveKey(): Buffer {
  if (cachedKey) return cachedKey;
  const explicit = (process.env.BYOR_ENCRYPTION_KEY || "").trim();
  if (explicit) {
    // Treat env value as a passphrase; HKDF to a 32-byte key.
    const salt = Buffer.from("byor.encryption.v1");
    cachedKey = crypto.hkdfSync("sha256", Buffer.from(explicit), salt, "byor-cfg", KEY_BYTES) as Buffer;
    return cachedKey;
  }
  // Fallback: derive from SESSION_SECRET so existing deploys can encrypt
  // without a config change. Warn loudly because rotating SESSION_SECRET
  // would lose the ability to decrypt prior rows.
  const sess = (process.env.SESSION_SECRET || "").trim();
  if (!sess) {
    throw new Error(
      "BYOR_ENCRYPTION_KEY (or SESSION_SECRET as fallback) must be set to encrypt secrets"
    );
  }
  if (!process.env.BYOR_ENCRYPTION_WARN_SUPPRESS) {
    console.warn(
      "[secrets] BYOR_ENCRYPTION_KEY not set — deriving from SESSION_SECRET. Rotating SESSION_SECRET will lose access to existing connection configs. Set BYOR_ENCRYPTION_KEY to decouple."
    );
    process.env.BYOR_ENCRYPTION_WARN_SUPPRESS = "1";
  }
  const salt = Buffer.from("byor.encryption.fallback.v1");
  cachedKey = crypto.hkdfSync("sha256", Buffer.from(sess), salt, "byor-cfg", KEY_BYTES) as Buffer;
  return cachedKey;
}

export function isEncrypted(s: unknown): boolean {
  return typeof s === "string" && s.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  if (typeof plain !== "string") return plain;
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (typeof stored !== "string") return stored as any;
  if (!stored.startsWith(PREFIX)) return stored; // backward compat: plain row
  const rest = stored.slice(PREFIX.length);
  const [ivB64, dataB64, tagB64] = rest.split(":");
  if (!ivB64 || !dataB64 || !tagB64) {
    throw new Error("malformed_encrypted_payload");
  }
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
