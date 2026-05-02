// Connector REST routes. Wired by server/routes.ts.
//
// Public-ish: /api/connections/:type/callback (OAuth callback — no JSON body, browser redirect).
// Everything else requires auth.

import type { Express, RequestHandler, Request, Response } from "express";
import crypto from "node:crypto";
import { storage } from "../storage";
import { getConnector } from "./registry";
import { listConnectorTypes } from "./registry";
import { readConfig } from "./types";

declare module "express-session" {
  interface SessionData {
    oauthState?: { state: string; workspaceId: number; type: string };
  }
}

export function registerConnectorRoutes(app: Express, guard: RequestHandler) {
  // ----- Connector type catalog -----
  app.get("/api/connections/types", guard, (_req, res) => {
    res.json(listConnectorTypes());
  });

  // ----- List connections for a workspace -----
  app.get("/api/workspaces/:id/connections", guard, (req, res) => {
    const list = storage.listConnections(Number(req.params.id));
    // strip secrets before returning
    res.json(list.map(stripConfig));
  });

  // ----- Delete -----
  app.delete("/api/connections/:id", guard, (req, res) => {
    storage.deleteConnection(Number(req.params.id));
    res.json({ ok: true });
  });

  // ----- OAuth start -----
  // GET /api/connections/:type/start?workspaceId=...
  app.get("/api/connections/:type/start", guard, (req, res) => {
    const type = String(req.params.type);
    const workspaceId = Number(req.query.workspaceId);
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });
    const c = getConnector(type);
    if (!c?.authUrl) return res.status(400).json({ error: "not_oauth_connector" });

    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = { state, workspaceId, type };
    try {
      res.redirect(c.authUrl(state));
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "oauth_start_failed" });
    }
  });

  // ----- OAuth callback -----
  // Browser-redirected; checks state from session, exchanges code, persists connection.
  app.get("/api/connections/:type/callback", async (req: Request, res: Response) => {
    const type = String(req.params.type);
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const sess = req.session.oauthState;

    if (!code || !state || !sess || sess.state !== state || sess.type !== type) {
      return res.status(400).send(renderResult("Connection failed", "Invalid OAuth state."));
    }
    const c = getConnector(type);
    if (!c?.exchangeCode) {
      return res.status(400).send(renderResult("Connection failed", "Connector not OAuth-capable."));
    }
    try {
      const out = await c.exchangeCode(code);
      storage.createConnection({
        workspaceId: sess.workspaceId,
        type,
        name: out.name ?? c.label ?? type,
        status: "active",
        config: JSON.stringify(out.config),
        accountEmail: out.accountEmail ?? null,
        lastSyncedAt: null,
      });
      req.session.oauthState = undefined;
      res.send(renderResult(`${c.label} connected`, "You can close this tab and return to the app.", true));
    } catch (e: any) {
      res.status(500).send(renderResult("Connection failed", e?.message ?? "exchange_failed"));
    }
  });

  // ----- API-key creation (e.g. Airtable PAT) -----
  app.post("/api/connections/:type/key", guard, async (req, res) => {
    const type = String(req.params.type);
    const c = getConnector(type);
    if (!c?.createFromKey) return res.status(400).json({ error: "not_key_connector" });
    const workspaceId = Number(req.body?.workspaceId);
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });
    try {
      const out = await c.createFromKey(req.body || {});
      const conn = storage.createConnection({
        workspaceId,
        type,
        name: out.name ?? c.label,
        status: "active",
        config: JSON.stringify(out.config),
        accountEmail: out.accountEmail ?? null,
        lastSyncedAt: null,
      });
      res.json(stripConfig(conn));
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "create_failed" });
    }
  });

  // ----- Browse upstream items -----
  app.get("/api/connections/:id/list", guard, async (req, res) => {
    const conn = storage.getConnection(Number(req.params.id));
    if (!conn) return res.status(404).json({ error: "not_found" });
    const c = getConnector(conn.type);
    if (!c) return res.status(400).json({ error: "unknown_connector" });
    try {
      const out = await c.list(conn, {
        folderId: typeof req.query.folderId === "string" ? req.query.folderId : undefined,
        query: typeof req.query.query === "string" ? req.query.query : undefined,
        cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      });
      res.json(out);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "list_failed" });
    }
  });

  // ----- Import items as sources -----
  // POST /api/connections/:id/import { externalIds: string[] }
  app.post("/api/connections/:id/import", guard, async (req, res) => {
    const conn = storage.getConnection(Number(req.params.id));
    if (!conn) return res.status(404).json({ error: "not_found" });
    const c = getConnector(conn.type);
    if (!c) return res.status(400).json({ error: "unknown_connector" });
    const externalIds: string[] = Array.isArray(req.body?.externalIds) ? req.body.externalIds : [];
    if (!externalIds.length) return res.status(400).json({ error: "externalIds required" });

    const out: Array<{ externalId: string; sourceId?: number; error?: string }> = [];
    for (const eid of externalIds) {
      try {
        const fc = await c.fetch(conn, eid);
        const existing = storage.findSourceByExternalId(conn.id, eid);
        if (existing) {
          const updated = storage.updateSource(existing.id, {
            title: fc.title,
            content: fc.content,
            meta: fc.meta ? JSON.stringify(fc.meta) : null,
            syncedAt: Date.now(),
            status: "ready",
          });
          out.push({ externalId: eid, sourceId: updated?.id });
        } else {
          const created = storage.createSource({
            workspaceId: conn.workspaceId,
            title: fc.title,
            type: conn.type === "google_drive" ? "gdrive" : conn.type,
            status: "ready",
            content: fc.content,
            meta: fc.meta ? JSON.stringify(fc.meta) : null,
            connectionId: conn.id,
            externalId: eid,
            syncedAt: Date.now(),
          });
          out.push({ externalId: eid, sourceId: created.id });
        }
      } catch (e: any) {
        out.push({ externalId: eid, error: e?.message ?? "fetch_failed" });
      }
    }
    storage.updateConnection(conn.id, { lastSyncedAt: Date.now() });
    res.json({ results: out });
  });

  // ----- Sync — re-fetch all sources tied to this connection -----
  app.post("/api/connections/:id/sync", guard, async (req, res) => {
    const conn = storage.getConnection(Number(req.params.id));
    if (!conn) return res.status(404).json({ error: "not_found" });
    const c = getConnector(conn.type);
    if (!c) return res.status(400).json({ error: "unknown_connector" });

    const linked = storage
      .listSources(conn.workspaceId)
      .filter((s) => s.connectionId === conn.id && s.externalId);

    const out: Array<{ sourceId: number; ok: boolean; error?: string }> = [];
    for (const s of linked) {
      try {
        const fc = await c.fetch(conn, s.externalId!);
        storage.updateSource(s.id, {
          title: fc.title,
          content: fc.content,
          meta: fc.meta ? JSON.stringify(fc.meta) : null,
          syncedAt: Date.now(),
          status: "ready",
        });
        out.push({ sourceId: s.id, ok: true });
      } catch (e: any) {
        storage.updateSource(s.id, { status: "error" });
        out.push({ sourceId: s.id, ok: false, error: e?.message ?? "fetch_failed" });
      }
    }
    storage.updateConnection(conn.id, { lastSyncedAt: Date.now() });
    res.json({ results: out });
  });
}

function stripConfig(c: any) {
  // Don't leak tokens to the browser.
  const { config, ...rest } = c;
  return { ...rest, hasConfig: !!config };
}

function renderResult(title: string, body: string, ok = false) {
  // Minimal standalone HTML returned to OAuth popup/redirect.
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#f4f4f6;margin:0;display:grid;place-items:center;min-height:100dvh;color:#0a0a0a}
    .card{background:#fff;border-radius:14px;padding:32px;max-width:420px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.06)}
    h1{margin:0 0 8px 0;font-size:20px}
    p{margin:0;color:#525b67;font-size:14px;line-height:1.5}
    .dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:8px;background:${ok ? "#16a34a" : "#dc2626"}}
  </style></head>
  <body><div class="card"><h1><span class="dot"></span>${title}</h1><p>${body}</p>
  <script>setTimeout(()=>{ try{ window.opener && window.opener.postMessage({ type:'rf:oauth', ok:${ok} }, '*'); }catch(e){} if (${ok}) window.close(); },800);</script>
  </div></body></html>`;
}
