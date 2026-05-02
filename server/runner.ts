// Single-schedule runner: pulls fresh content, synthesizes, generates, delivers.
// Used by the scheduler tick AND by the on-demand POST /api/schedules/:id/run.

import { storage } from "./storage";
import { synthesize } from "./synthesizer";
import {
  generatePdfReport,
  generatePptxDeck,
  generateNewsletterHtml,
} from "./generators";
import { getBrand } from "./brand";
import { sendEmail, fileToAttachment, emailConfigured } from "./email";
import { getConnector } from "./connectors/registry";
import type { Schedule } from "@shared/schema";

const CADENCE_MS: Record<string, number> = {
  daily: 1000 * 60 * 60 * 24,
  weekly: 1000 * 60 * 60 * 24 * 7,
  monthly: 1000 * 60 * 60 * 24 * 30,
};

export function nextRunFor(cadence: string, from = Date.now()): number {
  return from + (CADENCE_MS[cadence] ?? CADENCE_MS.weekly);
}

export type RunResult = {
  scheduleId: number;
  assetId: number | null;
  delivered: boolean;
  deliveryProvider?: string;
  deliveryError?: string;
  error?: string;
};

// Re-pull all sources tied to a workspace's connections so the report uses fresh data.
async function syncWorkspaceConnections(workspaceId: number) {
  const conns = storage.listConnections(workspaceId);
  for (const conn of conns) {
    if (conn.status !== "active") continue;
    const c = getConnector(conn.type);
    if (!c) continue;
    const linked = storage
      .listSources(workspaceId)
      .filter((s) => s.connectionId === conn.id && s.externalId);
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
      } catch (e: any) {
        storage.updateSource(s.id, { status: "error" });
        console.error(`[runner] sync source ${s.id} failed:`, e?.message);
      }
    }
    storage.updateConnection(conn.id, { lastSyncedAt: Date.now() });
  }
}

export async function runSchedule(schedule: Schedule): Promise<RunResult> {
  const ws = storage.getWorkspace(schedule.workspaceId);
  if (!ws) {
    return {
      scheduleId: schedule.id,
      assetId: null,
      delivered: false,
      error: "workspace_not_found",
    };
  }
  await syncWorkspaceConnections(ws.id);
  const sources = storage.listSources(ws.id);

  const asset = storage.createAsset({
    workspaceId: ws.id,
    title: schedule.name,
    kind: schedule.kind,
    prompt: schedule.prompt,
    status: "generating",
    sourceIds: JSON.stringify(sources.map((s) => s.id)),
    outline: null,
    filePath: null,
    contentHtml: null,
  });

  const brand = getBrand();
  const brandColor = ws.brandColor || brand.color;

  try {
    const outline = await synthesize({
      title: schedule.name,
      prompt: schedule.prompt,
      tone: "formal",
      sources,
      kind: schedule.kind as "newsletter" | "report" | "deck",
    });

    const updates: any = {
      outline: JSON.stringify(outline),
      status: "ready",
    };
    let attachment = null as null | { path: string; contentType: string };
    let html = "";
    if (schedule.kind === "newsletter") {
      html = generateNewsletterHtml({
        outline,
        brandColor,
        workspaceName: ws.name,
      });
      updates.contentHtml = html;
    } else if (schedule.kind === "report") {
      const filePath = await generatePdfReport({
        outline,
        brandColor,
        workspaceName: ws.name,
        assetId: asset.id,
      });
      updates.filePath = filePath;
      attachment = { path: filePath, contentType: "application/pdf" };
      html = newsletterStubHtml(brand.name, schedule.name, outline.executiveSummary);
    } else if (schedule.kind === "deck") {
      const filePath = await generatePptxDeck({
        outline,
        brandColor,
        workspaceName: ws.name,
        assetId: asset.id,
      });
      updates.filePath = filePath;
      attachment = {
        path: filePath,
        contentType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };
      html = newsletterStubHtml(brand.name, schedule.name, outline.executiveSummary);
    }
    storage.updateAsset(asset.id, updates);

    // Deliver
    const recipients = (schedule.recipients || "")
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => /@/.test(s));

    if (recipients.length === 0 || !emailConfigured()) {
      return {
        scheduleId: schedule.id,
        assetId: asset.id,
        delivered: false,
        deliveryError:
          recipients.length === 0 ? "no_recipients" : "email_not_configured",
      };
    }

    const att = attachment ? fileToAttachment(attachment.path, attachment.contentType) : null;
    const result = await sendEmail({
      to: recipients,
      subject: schedule.name,
      html,
      attachments: att ? [att] : undefined,
    });

    if (result.ok) {
      return {
        scheduleId: schedule.id,
        assetId: asset.id,
        delivered: true,
        deliveryProvider: result.provider,
      };
    }
    return {
      scheduleId: schedule.id,
      assetId: asset.id,
      delivered: false,
      deliveryError: result.reason,
    };
  } catch (e: any) {
    storage.updateAsset(asset.id, { status: "failed" });
    return {
      scheduleId: schedule.id,
      assetId: asset.id,
      delivered: false,
      error: e?.message ?? "generation_failed",
    };
  }
}

function newsletterStubHtml(brandName: string, title: string, summary: string): string {
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><body style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:24px auto;color:#0a0a0a;">
  <div style="font:600 11px/1 Helvetica;letter-spacing:2px;color:#525b67;text-transform:uppercase;">${safe(brandName)}</div>
  <h1 style="font-size:22px;margin:8px 0 12px 0;">${safe(title)}</h1>
  <p style="font-size:14px;line-height:1.55;color:#27313e;">${safe(summary)}</p>
  <p style="font-size:13px;color:#525b67;margin-top:16px;">Full document attached.</p>
  </body></html>`;
}
