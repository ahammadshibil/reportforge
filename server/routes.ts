import type { Express, Request, Response } from "express";
import { createServer } from "node:http";
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Allow larger uploads for PDF text / CSV content
  app.use(express.json({ limit: "20mb" }));

  await seedIfEmpty();

  // ----- Workspaces -----
  app.get("/api/workspaces", (_req, res) => {
    res.json(storage.listWorkspaces());
  });
  app.get("/api/workspaces/:id", (req, res) => {
    const w = storage.getWorkspace(Number(req.params.id));
    if (!w) return res.status(404).json({ error: "not_found" });
    res.json(w);
  });
  app.post("/api/workspaces", (req, res) => {
    const parsed = insertWorkspaceSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.createWorkspace(parsed.data));
  });
  app.patch("/api/workspaces/:id", (req, res) => {
    const updated = storage.updateWorkspace(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "not_found" });
    res.json(updated);
  });

  // ----- Sources -----
  app.get("/api/workspaces/:id/sources", (req, res) => {
    res.json(storage.listSources(Number(req.params.id)));
  });
  app.post("/api/sources", (req, res) => {
    const parsed = insertSourceSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.createSource(parsed.data));
  });
  app.delete("/api/sources/:id", (req, res) => {
    storage.deleteSource(Number(req.params.id));
    res.json({ ok: true });
  });

  // ----- Assets -----
  app.get("/api/workspaces/:id/assets", (req, res) => {
    res.json(storage.listAssets(Number(req.params.id)));
  });
  app.get("/api/assets/:id", (req, res) => {
    const a = storage.getAsset(Number(req.params.id));
    if (!a) return res.status(404).json({ error: "not_found" });
    res.json(a);
  });
  app.delete("/api/assets/:id", (req, res) => {
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
  app.get("/api/assets/:id/file", (req, res) => {
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
  app.post("/api/generate", async (req, res) => {
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

    // Create asset row in 'generating' state
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
      const outline = synthesize({ title, prompt, tone, sources, kind });

      let updates: any = {
        outline: JSON.stringify(outline),
        status: "ready",
      };

      if (kind === "newsletter") {
        updates.contentHtml = generateNewsletterHtml({
          outline,
          brandColor: ws.brandColor || "#0f766e",
          workspaceName: ws.name,
        });
      } else if (kind === "report") {
        updates.filePath = await generatePdfReport({
          outline,
          brandColor: ws.brandColor || "#0f766e",
          workspaceName: ws.name,
          assetId: asset.id,
        });
      } else if (kind === "deck") {
        updates.filePath = await generatePptxDeck({
          outline,
          brandColor: ws.brandColor || "#0f766e",
          workspaceName: ws.name,
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
  app.get("/api/workspaces/:id/schedules", (req, res) => {
    res.json(storage.listSchedules(Number(req.params.id)));
  });
  app.post("/api/schedules", (req, res) => {
    const parsed = insertScheduleSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.createSchedule(parsed.data));
  });
  app.patch("/api/schedules/:id", (req, res) => {
    const updated = storage.updateSchedule(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "not_found" });
    res.json(updated);
  });
  app.delete("/api/schedules/:id", (req, res) => {
    storage.deleteSchedule(Number(req.params.id));
    res.json({ ok: true });
  });

  return httpServer;
}
