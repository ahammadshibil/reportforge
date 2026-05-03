import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { storage } from "./storage";
import {
  insertWorkspaceSchema,
  insertSourceSchema,
  insertScheduleSchema,
  generateRequestSchema,
} from "@shared/schema";
import { synthesize } from "./synthesizer";
import {
  generatePdfReport,
  generatePptxDeck,
  generateNewsletterHtml,
} from "./generators";
import { seedIfEmpty } from "./seed";
import { getBrand } from "./brand";
import { authConfigured, currentUser, login, requireAuth } from "./auth";
import { registerConnectorRoutes } from "./connectors/routes";
import { llmStatus } from "./llm";
import { runSchedule, nextRunFor } from "./runner";
import { emailConfigured } from "./email";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Allow larger uploads for PDF text / CSV content
  app.use(express.json({ limit: "20mb" }));

  await seedIfEmpty();

  // ----- Brand (public) -----
  app.get("/api/brand", (_req, res) => {
    res.json(getBrand());
  });

  // ----- LLM status (auth required) -----
  app.get("/api/llm/status", requireAuth, (_req, res) => {
    res.json(llmStatus());
  });

  // ----- Auth (public) -----
  app.get("/api/auth/me", (req, res) => {
    res.json({
      user: currentUser(req),
      configured: authConfigured(),
    });
  });
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "missing_credentials" });
    }
    const user = await login(email, password);
    if (!user) return res.status(401).json({ error: "invalid_credentials" });
    req.session.user = user;
    res.json({ user });
  });
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  // ----- Everything below requires auth -----
  const guard = requireAuth;

  // ----- Workspaces -----
  app.get("/api/workspaces", guard, (_req, res) => {
    res.json(storage.listWorkspaces());
  });
  app.get("/api/workspaces/:id", guard, (req, res) => {
    const w = storage.getWorkspace(Number(req.params.id));
    if (!w) return res.status(404).json({ error: "not_found" });
    res.json(w);
  });
  app.post("/api/workspaces", guard, (req, res) => {
    const parsed = insertWorkspaceSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.createWorkspace(parsed.data));
  });
  app.patch("/api/workspaces/:id", guard, (req, res) => {
    const updated = storage.updateWorkspace(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "not_found" });
    res.json(updated);
  });

  // ----- Sources -----
  app.get("/api/workspaces/:id/sources", guard, (req, res) => {
    res.json(storage.listSources(Number(req.params.id)));
  });
  app.post("/api/sources", guard, (req, res) => {
    const parsed = insertSourceSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.createSource(parsed.data));
  });
  app.delete("/api/sources/:id", guard, (req, res) => {
    storage.deleteSource(Number(req.params.id));
    res.json({ ok: true });
  });

  // Upload a file (PDF, CSV, txt) and turn it into a source.
  // body: { workspaceId, filename, contentBase64, mimeType }
  app.post("/api/sources/upload", guard, async (req, res) => {
    const workspaceId = Number(req.body?.workspaceId);
    const filename = String(req.body?.filename || "");
    const contentBase64 = String(req.body?.contentBase64 || "");
    const mimeType = String(req.body?.mimeType || "");
    if (!workspaceId || !filename || !contentBase64) {
      return res.status(400).json({ error: "workspaceId, filename, contentBase64 required" });
    }
    try {
      const { ingestUpload } = await import("./ingest");
      const ing = await ingestUpload({ filename, contentBase64, mimeType });
      const source = storage.createSource({
        workspaceId,
        title: ing.title,
        type: ing.type,
        status: "ready",
        content: ing.content,
        meta: ing.meta ? JSON.stringify(ing.meta) : null,
        connectionId: null,
        externalId: null,
        syncedAt: null,
      });
      res.json(source);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "ingest_failed" });
    }
  });

  // Fetch + ingest a URL directly (without setting up a connector).
  // body: { workspaceId, url }
  app.post("/api/sources/url", guard, async (req, res) => {
    const workspaceId = Number(req.body?.workspaceId);
    const url = String(req.body?.url || "");
    if (!workspaceId || !url) return res.status(400).json({ error: "workspaceId and url required" });
    try {
      const { ingestUrl } = await import("./ingest");
      const ing = await ingestUrl(url);
      const source = storage.createSource({
        workspaceId,
        title: ing.title,
        type: ing.type,
        status: "ready",
        content: ing.content,
        meta: ing.meta ? JSON.stringify(ing.meta) : null,
        connectionId: null,
        externalId: null,
        syncedAt: null,
      });
      res.json(source);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "fetch_failed" });
    }
  });

  // ----- Assets -----
  app.get("/api/workspaces/:id/assets", guard, (req, res) => {
    res.json(storage.listAssets(Number(req.params.id)));
  });
  app.get("/api/assets/:id", guard, (req, res) => {
    const a = storage.getAsset(Number(req.params.id));
    if (!a) return res.status(404).json({ error: "not_found" });
    res.json(a);
  });
  app.delete("/api/assets/:id", guard, (req, res) => {
    const a = storage.getAsset(Number(req.params.id));
    if (a?.filePath && fs.existsSync(a.filePath)) {
      try {
        fs.unlinkSync(a.filePath);
      } catch {}
    }
    storage.deleteAsset(Number(req.params.id));
    res.json({ ok: true });
  });

  // Download / preview generated file
  app.get("/api/assets/:id/file", guard, (req, res) => {
    const a = storage.getAsset(Number(req.params.id));
    if (!a) return res.status(404).end();
    if (a.kind === "newsletter") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(a.contentHtml ?? "<p>Empty newsletter.</p>");
    }
    if (!a.filePath || !fs.existsSync(a.filePath))
      return res.status(404).json({ error: "file_missing" });
    const isPdf = a.kind === "report";
    const isPptx = a.kind === "deck";
    const filename = path.basename(a.filePath);
    res.setHeader(
      "Content-Type",
      isPdf
        ? "application/pdf"
        : isPptx
          ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          : "application/octet-stream"
    );
    const inline = req.query.inline === "1";
    res.setHeader(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename="${filename}"`
    );
    fs.createReadStream(a.filePath).pipe(res);
  });

  // ----- Generation -----
  app.post("/api/generate", guard, async (req, res) => {
    const parsed = generateRequestSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    const { workspaceId, kind, title, prompt, sourceIds, tone } = parsed.data;
    const ws = storage.getWorkspace(workspaceId);
    if (!ws) return res.status(404).json({ error: "workspace_not_found" });
    const allSources = storage.listSources(workspaceId);
    const sources = sourceIds.length
      ? allSources.filter((s) => sourceIds.includes(s.id))
      : allSources;

    const asset = storage.createAsset({
      workspaceId,
      title,
      kind,
      prompt,
      status: "generating",
      sourceIds: JSON.stringify(sourceIds),
      outline: null,
      filePath: null,
      contentHtml: null,
    });

    try {
      const outline = await synthesize({ title, prompt, tone, sources, kind });

      let updates: any = {
        outline: JSON.stringify(outline),
        status: "ready",
      };

      const brandColor = ws.brandColor || getBrand().color;
      const workspaceName = ws.name;

      if (kind === "newsletter") {
        updates.contentHtml = generateNewsletterHtml({
          outline,
          brandColor,
          workspaceName,
        });
      } else if (kind === "report") {
        updates.filePath = await generatePdfReport({
          outline,
          brandColor,
          workspaceName,
          assetId: asset.id,
        });
      } else if (kind === "deck") {
        updates.filePath = await generatePptxDeck({
          outline,
          brandColor,
          workspaceName,
          assetId: asset.id,
        });
      }

      const finalAsset = storage.updateAsset(asset.id, updates);
      res.json(finalAsset);
    } catch (e: any) {
      storage.updateAsset(asset.id, { status: "failed" });
      res.status(500).json({ error: e?.message ?? "generation_failed" });
    }
  });

  // ----- Schedules -----
  app.get("/api/workspaces/:id/schedules", guard, (req, res) => {
    res.json(storage.listSchedules(Number(req.params.id)));
  });
  app.post("/api/schedules", guard, (req, res) => {
    const parsed = insertScheduleSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.createSchedule(parsed.data));
  });
  app.patch("/api/schedules/:id", guard, (req, res) => {
    const updated = storage.updateSchedule(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "not_found" });
    res.json(updated);
  });
  app.delete("/api/schedules/:id", guard, (req, res) => {
    storage.deleteSchedule(Number(req.params.id));
    res.json({ ok: true });
  });

  // Manual fire-now for a schedule. Useful for testing delivery without
  // waiting for the cron tick.
  app.post("/api/schedules/:id/run", guard, async (req, res) => {
    const s = storage.getSchedule(Number(req.params.id));
    if (!s) return res.status(404).json({ error: "not_found" });
    try {
      const result = await runSchedule(s);
      const now = Date.now();
      storage.updateSchedule(s.id, {
        lastRunAt: now,
        nextRunAt: nextRunFor(s.cadence, now),
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "run_failed" });
    }
  });

  app.get("/api/email/status", guard, (_req, res) => {
    res.json({ configured: emailConfigured() });
  });

  // ----- Templates -----
  app.get("/api/workspaces/:id/templates", guard, (req, res) => {
    res.json(storage.listTemplates(Number(req.params.id)));
  });

  app.get("/api/templates/:id", guard, (req, res) => {
    const t = storage.getTemplate(Number(req.params.id));
    if (!t) return res.status(404).json({ error: "not_found" });
    res.json(t);
  });

  app.delete("/api/templates/:id", guard, (req, res) => {
    storage.deleteTemplate(Number(req.params.id));
    res.json({ ok: true });
  });

  // Extract a template from one or more sample images.
  // body: { workspaceId, images: [{ contentBase64, mimeType }], name?: string }
  app.post("/api/templates/extract", guard, async (req, res) => {
    const workspaceId = Number(req.body?.workspaceId);
    const images = Array.isArray(req.body?.images) ? req.body.images : [];
    if (!workspaceId || images.length === 0) {
      return res.status(400).json({ error: "workspaceId and images[] required" });
    }
    try {
      const { extractTemplate } = await import("./templates");
      const schema = await extractTemplate(
        images.map((i: any) => ({
          base64: String(i.contentBase64 || ""),
          mimeType: String(i.mimeType || "image/png"),
        }))
      );
      const name = String(req.body?.name || schema.name || "Untitled template");
      const previewImage = images[0]
        ? `data:${images[0].mimeType};base64,${String(images[0].contentBase64).slice(0, 200000)}`
        : null;
      const t = storage.createTemplate({
        workspaceId,
        name,
        kind: schema.kind,
        schema: JSON.stringify(schema),
        previewImage,
        brandColor: schema.brand?.primaryColor ?? null,
      });
      res.json(t);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "extract_failed" });
    }
  });

  // Render a template with values + optional line items.
  // body: { values: {}, lineItems: [{}] }  → returns HTML; also persists an asset.
  app.post("/api/templates/:id/render", guard, async (req, res) => {
    const t = storage.getTemplate(Number(req.params.id));
    if (!t) return res.status(404).json({ error: "not_found" });
    try {
      const { renderTemplateHtml } = await import("./templates");
      const schema = JSON.parse(t.schema);
      const values = (req.body?.values && typeof req.body.values === "object") ? req.body.values : {};
      const lineItems = Array.isArray(req.body?.lineItems) ? req.body.lineItems : [];
      const html = renderTemplateHtml(schema, values, lineItems);
      const headlineKey =
        ["invoice_number", "report_number", "title", "headline"].find((k) => values[k]) || null;
      const assetTitle = headlineKey
        ? `${schema.name} — ${values[headlineKey]}`
        : `${schema.name} — ${new Date().toLocaleDateString()}`;
      const asset = storage.createAsset({
        workspaceId: t.workspaceId,
        title: assetTitle,
        kind: "newsletter", // HTML output reuses the newsletter file path
        prompt: `Rendered from template ${t.id}`,
        status: "ready",
        sourceIds: null,
        outline: JSON.stringify({ templateId: t.id, values, lineItems }),
        filePath: null,
        contentHtml: html,
      });
      res.json({ html, assetId: asset.id });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "render_failed" });
    }
  });

  // ----- Connectors -----
  registerConnectorRoutes(app, guard);

  return httpServer;
}
