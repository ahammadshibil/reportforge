// Pluggable delivery dispatch — runner.ts iterates targets and routes
// each to the right backend. Each target is one entry in a schedule's
// deliveryTargets JSON array.

import type { Asset, Schedule, Workspace } from "@shared/schema";
import { storage } from "./storage";
import { sendEmail, fileToAttachment, emailConfigured } from "./email";
import type { Outline } from "./synthesizer";

export type EmailRecipient = {
  email: string;
  name?: string;
  firstName?: string;
  vars?: Record<string, string>;
};

export type EmailTarget = {
  type: "email";
  // Legacy: comma/space/semicolon-separated emails. Used when recipientList
  // is absent. Sent as a single message to all recipients (no personalization).
  recipients: string;
  // Structured list. When present, overrides `recipients` and produces one
  // personalized message per row. {{firstName}}, {{name}}, {{email}} +
  // anything in `vars` get substituted into subject + html body.
  recipientList?: EmailRecipient[];
};

export type VaultTarget = {
  type: "vault";
  connectionId: number;
  toolName: string;
  // supports {date} {slug} {title} {kind} substitutions
  pathTemplate?: string;
  format?: "markdown" | "html";
};

export type SubstackTarget = {
  type: "substack";
  connectionId: number;
  toolName: string; // e.g. 'create_post' / 'create_draft'
  action?: "draft" | "publish";
};

export type WebhookTarget = {
  type: "webhook";
  url: string;
  headers?: Record<string, string>;
};

export type DeliveryTarget = EmailTarget | VaultTarget | SubstackTarget | WebhookTarget;

export type DeliveryResult = {
  type: DeliveryTarget["type"];
  ok: boolean;
  reason?: string;
  detail?: Record<string, unknown>;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "");
}

function fillTemplate(tpl: string, ctx: { title: string; kind: string }): string {
  const date = new Date().toISOString().slice(0, 10);
  return tpl
    .replace(/\{date\}/g, date)
    .replace(/\{slug\}/g, slugify(ctx.title) || "untitled")
    .replace(/\{title\}/g, ctx.title)
    .replace(/\{kind\}/g, ctx.kind);
}

function parseTargets(raw: string | null | undefined): DeliveryTarget[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeliveryTarget[]) : [];
  } catch {
    return [];
  }
}

// Backward compatibility: old schedules had a `recipients` (email-only)
// field. If deliveryTargets is missing/empty AND recipients is set, treat
// it as a single email target.
export function effectiveTargets(schedule: Schedule): DeliveryTarget[] {
  const explicit = parseTargets(schedule.deliveryTargets);
  if (explicit.length) return explicit;
  if (schedule.recipients && schedule.recipients.trim()) {
    return [{ type: "email", recipients: schedule.recipients }];
  }
  return [];
}

// ---- Per-target dispatch ----

// Replace {{firstName}}, {{name}}, {{email}}, and any custom vars.
// Unknown placeholders are left untouched so an editor can still tell
// what was a typo vs intentional.
function substitute(template: string, recipient: EmailRecipient): string {
  const vars: Record<string, string> = {
    email: recipient.email,
    name: recipient.name || recipient.firstName || recipient.email.split("@")[0] || "",
    firstName:
      recipient.firstName ||
      (recipient.name ? recipient.name.split(/\s+/)[0] : "") ||
      recipient.email.split("@")[0] ||
      "",
    ...(recipient.vars || {}),
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : m
  );
}

async function deliverEmail(
  t: EmailTarget,
  ctx: DeliveryContext
): Promise<DeliveryResult> {
  if (!emailConfigured()) return { type: "email", ok: false, reason: "email_not_configured" };

  const att =
    ctx.attachmentPath && ctx.attachmentMime
      ? fileToAttachment(ctx.attachmentPath, ctx.attachmentMime)
      : null;

  // Personalized fan-out path: one message per recipient with var substitution.
  if (Array.isArray(t.recipientList) && t.recipientList.length > 0) {
    const results: Array<{ email: string; ok: boolean; reason?: string }> = [];
    let providerSeen: string | undefined;
    for (const r of t.recipientList) {
      if (!r?.email || !/@/.test(r.email)) {
        results.push({ email: r?.email ?? "(blank)", ok: false, reason: "invalid_email" });
        continue;
      }
      const subject = substitute(ctx.title, r);
      const html = substitute(ctx.htmlBody, r);
      const out = await sendEmail({
        to: [r.email],
        subject,
        html,
        attachments: att ? [att] : undefined,
      });
      if (out.ok) {
        providerSeen = out.provider;
        results.push({ email: r.email, ok: true });
      } else {
        results.push({ email: r.email, ok: false, reason: out.reason });
      }
    }
    const sent = results.filter((r) => r.ok).length;
    const failed = results.length - sent;
    return {
      type: "email",
      ok: sent > 0,
      reason: failed > 0 ? `${failed}_failed_of_${results.length}` : undefined,
      detail: {
        provider: providerSeen,
        sent,
        failed,
        results,
      },
    };
  }

  // Legacy bulk path: one message to all comma-listed emails. No personalization.
  const recipients = (t.recipients || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /@/.test(s));
  if (recipients.length === 0) return { type: "email", ok: false, reason: "no_recipients" };

  const result = await sendEmail({
    to: recipients,
    subject: ctx.title,
    html: ctx.htmlBody,
    attachments: att ? [att] : undefined,
  });
  return result.ok
    ? { type: "email", ok: true, detail: { provider: result.provider, recipients } }
    : { type: "email", ok: false, reason: result.reason };
}

async function deliverVault(
  t: VaultTarget,
  ctx: DeliveryContext
): Promise<DeliveryResult> {
  const conn = storage.getConnection(t.connectionId);
  if (!conn || conn.type !== "mcp")
    return { type: "vault", ok: false, reason: "connection_not_mcp" };

  const path = fillTemplate(
    t.pathTemplate || "06-Content-Drafts/{date}-{slug}.md",
    { title: ctx.title, kind: ctx.kind }
  );
  const content = t.format === "html" ? ctx.htmlBody : ctx.markdownBody;
  // Broadcast common arg shapes used by different MCP write tools.
  // The MCP server picks the one its tool actually expects — extras are
  // tolerated by most servers (cyanheads/obsidian-mcp-server in particular
  // requires `target: {type:'path', path}`; others use `filepath` or `path`).
  const args: Record<string, unknown> = {
    target: { type: "path", path },
    filepath: path,
    path,
    filename: path,
    content,
  };
  try {
    const { mcpCallTool } = await import("./connectors/mcp");
    await mcpCallTool(conn, t.toolName, args);
    return { type: "vault", ok: true, detail: { path, toolName: t.toolName } };
  } catch (e: any) {
    return { type: "vault", ok: false, reason: e?.message ?? "mcp_call_failed" };
  }
}

async function deliverSubstack(
  t: SubstackTarget,
  ctx: DeliveryContext
): Promise<DeliveryResult> {
  const conn = storage.getConnection(t.connectionId);
  if (!conn || conn.type !== "mcp")
    return { type: "substack", ok: false, reason: "connection_not_mcp" };

  // marcomoauro/substack-mcp's create_draft_post accepts (title, subtitle, body).
  // Send the HTML body since it preserves citation footnote anchors. Other
  // Substack-shaped MCPs that use different field names get covered by the
  // common aliases below — extra keys are ignored by strict tools.
  const args: Record<string, unknown> = {
    title: ctx.title,
    subtitle: ctx.subtitle,
    body: ctx.htmlBody,
    body_html: ctx.htmlBody,
    body_markdown: ctx.markdownBody,
    content: ctx.htmlBody,
  };
  try {
    const { mcpCallTool } = await import("./connectors/mcp");
    await mcpCallTool(conn, t.toolName, args);
    // marcomoauro server is drafts-only; honor that even if action='publish' is set.
    return {
      type: "substack",
      ok: true,
      detail: { action: "draft", note: t.action === "publish" ? "publish ignored — server creates drafts only" : undefined },
    };
  } catch (e: any) {
    return { type: "substack", ok: false, reason: e?.message ?? "substack_failed" };
  }
}

async function deliverWebhook(
  t: WebhookTarget,
  ctx: DeliveryContext
): Promise<DeliveryResult> {
  try {
    const r = await fetch(t.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t.headers || {}),
      },
      body: JSON.stringify({
        title: ctx.title,
        subtitle: ctx.subtitle,
        kind: ctx.kind,
        assetId: ctx.assetId,
        markdown: ctx.markdownBody,
        html: ctx.htmlBody,
      }),
    });
    if (!r.ok) return { type: "webhook", ok: false, reason: `http_${r.status}` };
    return { type: "webhook", ok: true, detail: { status: r.status } };
  } catch (e: any) {
    return { type: "webhook", ok: false, reason: e?.message ?? "webhook_failed" };
  }
}

// ---- Public entrypoint ----

export type DeliveryContext = {
  title: string;
  subtitle: string;
  kind: "newsletter" | "report" | "deck";
  assetId: number;
  htmlBody: string;
  markdownBody: string;
  attachmentPath?: string;
  attachmentMime?: string;
  workspace: Workspace;
};

export async function dispatchDelivery(
  targets: DeliveryTarget[],
  ctx: DeliveryContext
): Promise<DeliveryResult[]> {
  const out: DeliveryResult[] = [];
  for (const t of targets) {
    if (t.type === "email") out.push(await deliverEmail(t, ctx));
    else if (t.type === "vault") out.push(await deliverVault(t, ctx));
    else if (t.type === "substack") out.push(await deliverSubstack(t, ctx));
    else if (t.type === "webhook") out.push(await deliverWebhook(t, ctx));
    else out.push({ type: (t as any).type, ok: false, reason: "unknown_target_type" });
  }
  return out;
}

// Helper: reuse for the asset → markdown body construction outside delivery.
export function buildBodies(args: {
  outline: Outline | null;
  htmlBody: string;
  asset: Asset;
  workspaceName: string;
}): { markdownBody: string; htmlBody: string } {
  const { outline, htmlBody, asset, workspaceName } = args;
  if (outline) {
    // Lazy require to avoid cycles
    const { outlineToMarkdown } = require("./vaultExport") as typeof import("./vaultExport");
    const md = outlineToMarkdown(outline, {
      assetId: asset.id,
      brandName: workspaceName,
    });
    return { markdownBody: md, htmlBody };
  }
  return { markdownBody: htmlBody, htmlBody };
}
