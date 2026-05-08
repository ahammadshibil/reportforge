// Render BYOR generated content back into Obsidian-flavored Markdown.
//
// Why: closes the file-over-app loop. BYOR produces an asset, writes a
// .md file into your vault, you edit it in Obsidian, eventually publish
// via Substack / share / drop into the LP letter. The vault is the
// crystallization layer; BYOR is the formatting+distribution layer.

import type { Outline } from "./synthesizer";

function yamlEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[:#"'\n\[\]{}|>]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

function frontmatter(meta: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${yamlEscape(item)}`);
    } else {
      lines.push(`${k}: ${yamlEscape(v)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

export function outlineToMarkdown(
  outline: Outline,
  meta: { assetId?: number; templateId?: number; sourceIds?: number[]; brandName?: string } = {}
): string {
  const fm = frontmatter({
    title: outline.title,
    date: new Date().toISOString().slice(0, 10),
    generated_by: meta.brandName || "BYOR",
    asset_id: meta.assetId,
    template_id: meta.templateId,
    source_ids: meta.sourceIds,
    tags: ["byor", "draft"],
  });

  const parts: string[] = [fm];
  parts.push(`# ${outline.title}`);
  if (outline.subtitle) parts.push(`*${outline.subtitle}*`);

  if (outline.executiveSummary?.trim()) {
    parts.push(`\n## Executive Summary`, outline.executiveSummary);
  }

  if (outline.metrics?.length) {
    parts.push(`\n## Key Metrics`);
    for (const m of outline.metrics) {
      const delta = m.delta ? ` (${m.delta})` : "";
      parts.push(`- **${m.label}:** ${m.value}${delta}`);
    }
  }

  for (const s of outline.sections) {
    parts.push(`\n## ${s.heading}`);
    if (s.paragraph?.trim()) parts.push(s.paragraph);
    if (s.bullets?.length) {
      parts.push("");
      for (const b of s.bullets) parts.push(`- ${b}`);
    }
  }

  if (outline.callouts?.length) {
    parts.push(`\n## Callouts`);
    for (const c of outline.callouts) parts.push(`> ${c}`);
  }

  return parts.join("\n") + "\n";
}

// HTML → readable markdown. Used for template-rendered HTML assets.
// Lossy but good enough for vault editing — the original HTML is still on
// the server if the user wants the branded version.
export function htmlToMarkdown(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<\/(p|div|tr|table|section)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "");
}

// Default vault path for an asset, e.g. "06-Content-Drafts/2026-05-08-q1-portfolio-update.md"
export function defaultVaultPath(title: string, folder = "06-Content-Drafts"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${folder}/${date}-${slugify(title) || "untitled"}.md`;
}
