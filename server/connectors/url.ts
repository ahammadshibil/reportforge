// URL connector. No auth. Connection config holds a list of bookmarked URLs;
// each URL becomes a fetchable item. Phase 5 will swap regex stripping for a
// real Readability extractor + cache.

import type { Connector, ConnectorListItem, FetchedContent } from "./types";
import { readConfig } from "./types";

type UrlConfig = {
  urls: string[];
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h\d|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function extractTitle(html: string): string | null {
  const ogt = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (ogt) return ogt[1];
  const t = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return t ? t[1].trim() : null;
}

export const urlConnector: Connector = {
  id: "url",
  label: "Web URLs",

  async createFromKey(input) {
    const raw = String(input.urls || "").trim();
    const urls = raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((u) => /^https?:\/\//i.test(u));
    if (urls.length === 0) throw new Error("Provide at least one http(s) URL");
    const name = String(input.name || "").trim() || `${urls.length} URL${urls.length > 1 ? "s" : ""}`;
    return {
      config: { urls } as unknown as Record<string, unknown>,
      name,
    };
  },

  async list(connection) {
    const cfg = readConfig<UrlConfig>(connection);
    const items: ConnectorListItem[] = (cfg.urls || []).map((u) => ({
      externalId: u,
      title: u,
      mimeType: "text/html",
    }));
    return { items };
  },

  async fetch(_connection, externalId): Promise<FetchedContent> {
    const url = externalId;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "ReportForge/1.0 (+https://github.com/ahammadshibil/reportforge)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`URL fetch failed: ${res.status}`);
    const html = await res.text();
    const title = extractTitle(html) ?? url;
    const content = stripHtml(html).slice(0, 100_000);
    return {
      title,
      content,
      mimeType: "text/html",
      meta: { url, fetchedAt: Date.now() },
    };
  },
};
