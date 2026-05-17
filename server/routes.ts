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
import rateLimit from "express-rate-limit";

// JSON.parse with null fallback — for asset.outline / asset.sourceIds blobs
function safeParse<T = any>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

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

  // ----- Manual cleanup trigger (auth required) -----
  app.post("/api/admin/cleanup", requireAuth, async (_req, res) => {
    const { runCleanup } = await import("./cleanup");
    try {
      const report = await runCleanup();
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "cleanup_failed" });
    }
  });

  // ----- Auth (public) -----
  app.get("/api/auth/me", (req, res) => {
    res.json({
      user: currentUser(req),
      configured: authConfigured(),
    });
  });
  // Rate-limit /api/auth/login: 10 attempts per 5min per IP. Defends against
  // brute-force / credential stuffing on the single admin login.
  const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "too_many_login_attempts" },
  });
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
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

  // ----- Tenant settings (brand) -----
  // GET returns the merged brand (DB override → env → defaults) so the
  // settings UI can populate the form correctly.
  app.get("/api/admin/brand", guard, (_req, res) => {
    res.json(getBrand());
  });
  // PATCH writes selected brand fields to the app_settings table. Keys that
  // map to brand fields: name, tagline, color, logoUrl, logoText, domain,
  // footer, supportEmail, theme. Send only the keys you're changing.
  app.patch("/api/admin/brand", guard, (req, res) => {
    const allowed = new Set([
      "name", "tagline", "color", "logoUrl", "logoText",
      "domain", "footer", "supportEmail", "theme",
    ]);
    const body = req.body ?? {};
    let updated = 0;
    for (const [k, v] of Object.entries(body)) {
      if (!allowed.has(k)) continue;
      if (v === null || v === undefined || v === "") {
        storage.deleteSetting(`brand.${k}`);
      } else {
        storage.setSetting(`brand.${k}`, String(v));
      }
      updated++;
    }
    res.json({ updated, brand: getBrand() });
  });

  // ----- Asset versions -----
  app.get("/api/assets/:id/versions", guard, (req, res) => {
    const versions = storage.listAssetVersions(Number(req.params.id));
    // Metadata-only listing (drop content_html / outline blobs).
    res.json(
      versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        createdAt: v.createdAt,
        prompt: v.prompt,
        hasHtml: !!v.contentHtml,
        hasFile: !!v.filePath,
      }))
    );
  });

  // Inline-render a single version's content (HTML newsletter or stream
  // PDF/PPTX file). Used by the version-history dialog's preview.
  app.get("/api/assets/:id/versions/:vid/file", guard, (req, res) => {
    const v = storage.getAssetVersion(Number(req.params.vid));
    if (!v || v.assetId !== Number(req.params.id)) {
      return res.status(404).json({ error: "version_not_found" });
    }
    if (v.contentHtml) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(v.contentHtml);
    }
    if (v.filePath && fs.existsSync(v.filePath)) {
      const filename = path.basename(v.filePath);
      const inline = req.query.inline === "1";
      const ct =
        v.filePath.endsWith(".pdf")
          ? "application/pdf"
          : v.filePath.endsWith(".pptx")
            ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            : "application/octet-stream";
      res.setHeader("Content-Type", ct);
      res.setHeader(
        "Content-Disposition",
        `${inline ? "inline" : "attachment"}; filename="v${v.version}_${filename}"`
      );
      return fs.createReadStream(v.filePath).pipe(res);
    }
    res.status(404).json({ error: "version_has_no_content" });
  });

  // Restore a prior version onto the current asset. Snapshots current
  // first so nothing is lost.
  app.post("/api/assets/:id/versions/:vid/restore", guard, (req, res) => {
    const aid = Number(req.params.id);
    const a = storage.getAsset(aid);
    if (!a) return res.status(404).json({ error: "asset_not_found" });
    const v = storage.getAssetVersion(Number(req.params.vid));
    if (!v || v.assetId !== aid) {
      return res.status(404).json({ error: "version_not_found" });
    }
    // Snapshot current → new version row
    const priorCount = storage.countAssetVersions(a.id);
    storage.createAssetVersion({
      assetId: a.id,
      version: priorCount + 1,
      status: a.status,
      contentHtml: a.contentHtml ?? null,
      filePath: a.filePath ?? null,
      outline: a.outline ?? null,
      prompt: a.prompt ?? null,
    });
    // Restore selected version onto the asset.
    const updated = storage.updateAsset(a.id, {
      status: v.status,
      contentHtml: v.contentHtml ?? null,
      filePath: v.filePath ?? null,
      outline: v.outline ?? null,
      prompt: v.prompt ?? null,
    });
    res.json({ asset: updated, restoredFromVersion: v.version });
  });

  // POST /api/assets/:id/regenerate
  // - Snapshots current asset state into asset_versions
  // - Re-runs synthesis (or template render) using the asset's stored
  //   prompt + sourceIds  (or outline.{templateId,values,lineItems})
  // - Replaces the asset's content in place
  app.post("/api/assets/:id/regenerate", guard, async (req, res) => {
    const a = storage.getAsset(Number(req.params.id));
    if (!a) return res.status(404).json({ error: "asset_not_found" });
    const ws = storage.getWorkspace(a.workspaceId);
    if (!ws) return res.status(400).json({ error: "workspace_missing" });

    // 1. Snapshot. Version number = current count + 1.
    const priorCount = storage.countAssetVersions(a.id);
    storage.createAssetVersion({
      assetId: a.id,
      version: priorCount + 1,
      status: a.status,
      contentHtml: a.contentHtml ?? null,
      filePath: a.filePath ?? null,
      outline: a.outline ?? null,
      prompt: a.prompt ?? null,
    });

    storage.updateAsset(a.id, { status: "generating" });
    const brandColor = ws.brandColor || getBrand().color;

    try {
      // Detect path: template-render vs synthesis
      const outlineMeta = a.outline ? safeParse(a.outline) : null;
      const isTemplateRender =
        outlineMeta && typeof outlineMeta.templateId === "number";

      if (isTemplateRender) {
        const t = storage.getTemplate(outlineMeta.templateId);
        if (!t) throw new Error("template_missing");
        const { renderTemplateHtml } = await import("./templates");
        const html = renderTemplateHtml(
          JSON.parse(t.schema),
          (outlineMeta.values ?? {}) as Record<string, any>,
          Array.isArray(outlineMeta.lineItems) ? outlineMeta.lineItems : []
        );
        const updated = storage.updateAsset(a.id, {
          contentHtml: html,
          status: "ready",
        });
        return res.json(updated);
      }

      // Synthesis path — re-run with the same prompt + sourceIds + kind.
      const ids: number[] = a.sourceIds ? safeParse(a.sourceIds) ?? [] : [];
      const allSources = storage.listSources(ws.id);
      const sources = ids.length ? allSources.filter((s) => ids.includes(s.id)) : allSources;
      const newPrompt: string = typeof req.body?.prompt === "string" ? req.body.prompt : a.prompt ?? "";

      const newOutline = await synthesize({
        title: a.title,
        prompt: newPrompt,
        tone: "formal",
        sources,
        kind: a.kind as "newsletter" | "report" | "deck",
      });

      const updates: any = {
        outline: JSON.stringify(newOutline),
        prompt: newPrompt,
        status: "ready",
      };
      if (a.kind === "newsletter") {
        updates.contentHtml = generateNewsletterHtml({
          outline: newOutline,
          brandColor,
          workspaceName: ws.name,
        });
      } else if (a.kind === "report") {
        // Reuse the asset id so the file stays at <id>_<slug>.pdf and
        // overwrites in place — Library URLs don't break.
        updates.filePath = await generatePdfReport({
          outline: newOutline,
          brandColor,
          workspaceName: ws.name,
          assetId: a.id,
        });
      } else if (a.kind === "deck") {
        updates.filePath = await generatePptxDeck({
          outline: newOutline,
          brandColor,
          workspaceName: ws.name,
          assetId: a.id,
        });
      }
      const updated = storage.updateAsset(a.id, updates);
      res.json(updated);
    } catch (e: any) {
      storage.updateAsset(a.id, { status: "failed" });
      res.status(500).json({ error: e?.message ?? "regenerate_failed" });
    }
  });

  // ----- Save asset to MCP target (e.g. Obsidian vault) -----
  // body: { connectionId, toolName, path, format?: 'markdown'|'html' }
  app.post("/api/assets/:id/save-to-mcp", guard, async (req, res) => {
    const a = storage.getAsset(Number(req.params.id));
    if (!a) return res.status(404).json({ error: "asset_not_found" });
    const conn = storage.getConnection(Number(req.body?.connectionId));
    if (!conn || conn.type !== "mcp") {
      return res.status(400).json({ error: "not_mcp_connection" });
    }
    const toolName = String(req.body?.toolName || "").trim();
    if (!toolName) return res.status(400).json({ error: "toolName required" });
    const format = req.body?.format === "html" ? "html" : "markdown";

    try {
      const { outlineToMarkdown, htmlToMarkdown, defaultVaultPath } = await import("./vaultExport");
      const ws = storage.getWorkspace(a.workspaceId);
      const brandName = ws?.name || "BYOR";

      let content = "";
      if (a.outline) {
        const outline = JSON.parse(a.outline);
        if (format === "html" && a.contentHtml) content = a.contentHtml;
        else content = outlineToMarkdown(outline, { assetId: a.id, brandName });
      } else if (a.contentHtml) {
        content =
          format === "html"
            ? a.contentHtml
            : `# ${a.title}\n\n${htmlToMarkdown(a.contentHtml)}`;
      } else {
        return res.status(400).json({ error: "asset_has_no_renderable_content" });
      }

      const path = String(req.body?.path || defaultVaultPath(a.title));
      const args: Record<string, unknown> = {
        // most Obsidian MCP servers accept one of these — send all so the
        // server picks the one its tool actually expects.
        filepath: path,
        path,
        filename: path,
        content,
        ...(req.body?.extraArgs && typeof req.body.extraArgs === "object"
          ? req.body.extraArgs
          : {}),
      };

      const { mcpCallTool } = await import("./connectors/mcp");
      const result = await mcpCallTool(conn, toolName, args);
      res.json({ ok: true, path, toolName, result });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "save_failed" });
    }
  });

  // List the tools an MCP connection exposes (UI uses this to build write-tool pickers).
  app.get("/api/connections/:id/tools", guard, async (req, res) => {
    const conn = storage.getConnection(Number(req.params.id));
    if (!conn || conn.type !== "mcp") {
      return res.status(400).json({ error: "not_mcp_connection" });
    }
    try {
      const { mcpListTools } = await import("./connectors/mcp");
      const tools = await mcpListTools(conn);
      res.json({ tools });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "list_tools_failed" });
    }
  });

  // ----- Recipes (pre-baked workflows) -----
  // PUBLIC version — same payload, no auth. Used by the landing page
  // so the marketing surface always reflects the live catalog (avoids
  // hardcoded recipe lists drifting from server/recipes.ts).
  app.get("/api/recipes/public", async (_req, res) => {
    const { RECIPES } = await import("./recipes");
    res.json(
      RECIPES.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        bestFor: r.bestFor ?? null,
        cadenceLabel: r.cadenceLabel ?? null,
        connectorsRecommended: r.connectorsRecommended ?? [],
      }))
    );
  });

  app.get("/api/recipes", guard, async (_req, res) => {
    const { RECIPES } = await import("./recipes");
    res.json(
      RECIPES.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        bestFor: r.bestFor ?? null,
        cadenceLabel: r.cadenceLabel ?? null,
        connectorsRecommended: r.connectorsRecommended ?? [],
        exampleOutput: r.exampleOutput ?? null,
        creates: {
          workspace: r.workspace.name,
          template: r.template?.name ?? null,
          schedule: r.schedule?.name ?? null,
          sources: r.sampleSources?.length ?? 0,
        },
      }))
    );
  });
  app.post("/api/recipes/:id/install", guard, async (req, res) => {
    try {
      const { installRecipe } = await import("./recipes");
      const result = installRecipe(String(req.params.id));
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "install_failed" });
    }
  });

  // Export a workspace as a Recipe JSON. Body shape:
  //   {
  //     workspaceId: number,
  //     includeTemplate?: bool, includeSchedule?: bool, includeSources?: bool,
  //     sourceIds?: number[],
  //     meta?: { id, name, description, category, bestFor, cadenceLabel, exampleOutput, connectorsRecommended }
  //   }
  // Returns the Recipe object — caller downloads it as recipe.json.
  app.post("/api/recipes/export", guard, async (req, res) => {
    try {
      const { exportWorkspaceAsRecipe } = await import("./recipes");
      const workspaceId = Number(req.body?.workspaceId);
      if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });
      const recipe = exportWorkspaceAsRecipe(workspaceId, {
        includeTemplate: req.body?.includeTemplate,
        includeSchedule: req.body?.includeSchedule,
        includeSources: req.body?.includeSources,
        sourceIds: Array.isArray(req.body?.sourceIds) ? req.body.sourceIds : undefined,
        meta: req.body?.meta,
      });
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${recipe.id || "recipe"}.byor.json"`
      );
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(recipe, null, 2));
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "export_failed" });
    }
  });

  // Import a recipe.json (the body IS the recipe, not a wrapper).
  // Performs basic shape validation then runs installRecipeObject —
  // identical install semantics to the built-in catalog.
  app.post("/api/recipes/import", guard, async (req, res) => {
    try {
      const { installRecipeObject } = await import("./recipes");
      const recipe = req.body;
      if (!recipe || typeof recipe !== "object") {
        return res.status(400).json({ error: "recipe_must_be_object" });
      }
      if (!recipe.workspace?.name || typeof recipe.workspace.name !== "string") {
        return res.status(400).json({ error: "recipe.workspace.name required" });
      }
      // Allow common Recipe-shaped JSONs even when id/name/category missing —
      // fill in defaults so users can paste partial files.
      const normalized = {
        id: recipe.id || "imported-" + Date.now().toString(36),
        name: recipe.name || recipe.workspace.name,
        description: recipe.description || "Imported recipe",
        category: recipe.category || "general",
        ...recipe,
      };
      const result = installRecipeObject(normalized);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "import_failed" });
    }
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

  // Auto-fill template fields from selected sources.
  // body: { sourceIds: number[], brief?: string }
  // returns: { values: {...}, lineItems: [...] }  — caller hydrates the form.
  app.post("/api/templates/:id/fill", guard, async (req, res) => {
    const t = storage.getTemplate(Number(req.params.id));
    if (!t) return res.status(404).json({ error: "not_found" });
    const sourceIds: number[] = Array.isArray(req.body?.sourceIds) ? req.body.sourceIds : [];
    const brief: string | undefined =
      typeof req.body?.brief === "string" ? req.body.brief : undefined;
    const allSources = storage.listSources(t.workspaceId);
    const sources = sourceIds.length
      ? allSources.filter((s) => sourceIds.includes(s.id))
      : allSources;
    try {
      const { fillFromSources } = await import("./templates");
      const schema = JSON.parse(t.schema);
      const out = await fillFromSources({ schema, sources, brief });
      res.json(out);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "fill_failed" });
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
