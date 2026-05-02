// Minimal session auth for single-tenant whitelabel.
// One admin user; credentials live in env. No user table.
//
// Set ADMIN_EMAIL + either ADMIN_PASSWORD or ADMIN_PASSWORD_HASH (bcrypt).
// If neither is set, AUTH_DISABLED=1 is allowed in dev for unauthenticated access.

import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

export type AuthUser = { email: string };

declare module "express-session" {
  interface SessionData {
    user?: AuthUser;
  }
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const AUTH_DISABLED = process.env.AUTH_DISABLED === "1";

export function authConfigured(): boolean {
  return !!ADMIN_EMAIL && (!!ADMIN_PASSWORD || !!ADMIN_PASSWORD_HASH);
}

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

async function checkPassword(plain: string): Promise<boolean> {
  if (ADMIN_PASSWORD_HASH) {
    // bcrypt-style "$2a$..." — only verify if bcrypt is available; otherwise skip.
    try {
      // dynamic import keeps bcrypt optional
      // @ts-ignore — optional peer; falls back gracefully if missing
      const bcrypt = await import("bcryptjs").catch(() => null);
      if (bcrypt) return await (bcrypt as any).compare(plain, ADMIN_PASSWORD_HASH);
    } catch {
      // fall through to plain compare against hash field as last resort
    }
    return false;
  }
  if (ADMIN_PASSWORD) return timingSafeEq(plain, ADMIN_PASSWORD);
  return false;
}

export async function login(email: string, password: string): Promise<AuthUser | null> {
  if (!authConfigured()) {
    if (AUTH_DISABLED) return { email: email.toLowerCase() };
    return null;
  }
  if (email.trim().toLowerCase() !== ADMIN_EMAIL) return null;
  const ok = await checkPassword(password);
  return ok ? { email: ADMIN_EMAIL } : null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (AUTH_DISABLED) return next();
  if (req.session?.user) return next();
  return res.status(401).json({ error: "unauthorized" });
}

export function currentUser(req: Request): AuthUser | null {
  if (AUTH_DISABLED) return req.session?.user ?? { email: "dev@local" };
  return req.session?.user ?? null;
}
