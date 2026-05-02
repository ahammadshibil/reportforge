// Google Drive connector. OAuth 2.0 with offline access for refresh tokens.
//
// Required env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
// Required scope: drive.readonly + userinfo.email (for accountEmail)
//
// Setup: https://console.cloud.google.com → OAuth consent + Credentials → Web app
// Authorized redirect URI: ${BRAND_DOMAIN_OR_LOCALHOST}/api/connections/google/callback

import type { Connection } from "@shared/schema";
import type { Connector, ConnectorListItem, FetchedContent } from "./types";
import { readConfig } from "./types";

type GoogleConfig = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
};

const AUTH_HOST = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function envOrThrow(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env ${key}`);
  return v;
}

async function refreshIfNeeded(c: Connection): Promise<GoogleConfig> {
  const cfg = readConfig<GoogleConfig>(c);
  if (cfg.expiresAt && cfg.expiresAt > Date.now() + 60_000) return cfg;
  if (!cfg.refreshToken) return cfg; // can't refresh; caller will see 401

  const body = new URLSearchParams({
    client_id: envOrThrow("GOOGLE_CLIENT_ID"),
    client_secret: envOrThrow("GOOGLE_CLIENT_SECRET"),
    refresh_token: cfg.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  return {
    ...cfg,
    accessToken: j.access_token,
    expiresAt: Date.now() + j.expires_in * 1000,
  };
}

async function authedFetch(c: Connection, url: string, init?: RequestInit) {
  const cfg = await refreshIfNeeded(c);
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${cfg.accessToken}`,
    },
  });
}

const EXPORT_MAP: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

export const googleDrive: Connector = {
  id: "google_drive",
  label: "Google Drive",

  authUrl(state: string) {
    const params = new URLSearchParams({
      client_id: envOrThrow("GOOGLE_CLIENT_ID"),
      redirect_uri: envOrThrow("GOOGLE_REDIRECT_URI"),
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent", // ensure refresh_token on re-auth
      state,
    });
    return `${AUTH_HOST}?${params.toString()}`;
  },

  async exchangeCode(code: string) {
    const body = new URLSearchParams({
      code,
      client_id: envOrThrow("GOOGLE_CLIENT_ID"),
      client_secret: envOrThrow("GOOGLE_CLIENT_SECRET"),
      redirect_uri: envOrThrow("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Google token exchange failed: ${res.status} ${t}`);
    }
    const j = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };
    const config: GoogleConfig = {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: Date.now() + j.expires_in * 1000,
      scope: j.scope,
    };

    // Lookup account email
    let accountEmail: string | undefined;
    try {
      const r = await fetch(USERINFO, {
        headers: { Authorization: `Bearer ${j.access_token}` },
      });
      if (r.ok) {
        const u = (await r.json()) as { email?: string };
        accountEmail = u.email;
      }
    } catch {
      /* non-fatal */
    }

    return {
      config: config as unknown as Record<string, unknown>,
      accountEmail,
      name: accountEmail ? `Google Drive (${accountEmail})` : "Google Drive",
    };
  },

  async list(connection, opts) {
    const params = new URLSearchParams({
      pageSize: "50",
      fields:
        "files(id,name,mimeType,modifiedTime,size,webViewLink),nextPageToken",
      orderBy: "modifiedTime desc",
    });
    const qParts: string[] = ["trashed = false"];
    if (opts?.folderId) qParts.push(`'${opts.folderId}' in parents`);
    if (opts?.query) qParts.push(`name contains '${opts.query.replace(/'/g, "")}'`);
    params.set("q", qParts.join(" and "));
    if (opts?.cursor) params.set("pageToken", opts.cursor);

    const res = await authedFetch(connection, `${DRIVE_API}/files?${params}`);
    if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
    const j = (await res.json()) as {
      files: Array<{
        id: string;
        name: string;
        mimeType: string;
        modifiedTime: string;
      }>;
      nextPageToken?: string;
    };

    const items: ConnectorListItem[] = j.files.map((f) => ({
      externalId: f.id,
      title: f.name,
      mimeType: f.mimeType,
      modifiedAt: Date.parse(f.modifiedTime),
    }));
    return { items, nextCursor: j.nextPageToken };
  },

  async fetch(connection, externalId): Promise<FetchedContent> {
    // 1) Get metadata for mimeType + name
    const metaRes = await authedFetch(
      connection,
      `${DRIVE_API}/files/${externalId}?fields=id,name,mimeType,modifiedTime,webViewLink`
    );
    if (!metaRes.ok) throw new Error(`Drive meta failed: ${metaRes.status}`);
    const meta = (await metaRes.json()) as {
      id: string;
      name: string;
      mimeType: string;
      modifiedTime: string;
      webViewLink?: string;
    };

    // 2) Either export (Google-native) or download (uploaded file)
    const exportType = EXPORT_MAP[meta.mimeType];
    let content = "";
    if (exportType) {
      const ex = await authedFetch(
        connection,
        `${DRIVE_API}/files/${externalId}/export?mimeType=${encodeURIComponent(exportType)}`
      );
      if (!ex.ok) throw new Error(`Drive export failed: ${ex.status}`);
      content = await ex.text();
    } else if (meta.mimeType.startsWith("text/") || meta.mimeType === "application/json") {
      const dl = await authedFetch(
        connection,
        `${DRIVE_API}/files/${externalId}?alt=media`
      );
      if (!dl.ok) throw new Error(`Drive download failed: ${dl.status}`);
      content = await dl.text();
    } else {
      // binary (PDF etc.) — Phase 5 will add pdf-parse here.
      content = `[Binary file: ${meta.mimeType}] ${meta.webViewLink ?? ""}`.trim();
    }

    return {
      title: meta.name,
      content,
      mimeType: meta.mimeType,
      meta: { webViewLink: meta.webViewLink, modifiedTime: meta.modifiedTime },
    };
  },

  async refresh(connection) {
    const cfg = await refreshIfNeeded(connection);
    return cfg as unknown as Record<string, unknown>;
  },
};
