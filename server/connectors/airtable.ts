// Airtable connector. PAT (Personal Access Token) based — no OAuth.
//
// Setup: https://airtable.com/create/tokens
// Required scopes: data.records:read, schema.bases:read

import type { Connector, ConnectorListItem, FetchedContent } from "./types";
import { readConfig } from "./types";

type AirtableConfig = {
  apiKey: string;
  baseId?: string; // optional default
};

const API = "https://api.airtable.com/v0";

function authed(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const airtable: Connector = {
  id: "airtable",
  label: "Airtable",

  async createFromKey(input) {
    const apiKey = String(input.apiKey || "").trim();
    if (!apiKey) throw new Error("apiKey required");
    const baseId = input.baseId ? String(input.baseId).trim() : undefined;

    // Verify by fetching whoami / bases meta.
    const res = await fetch(`${API}/meta/bases`, { headers: authed(apiKey) });
    if (!res.ok) throw new Error(`Airtable auth failed: ${res.status}`);
    const j = (await res.json()) as { bases: Array<{ id: string; name: string }> };

    let name = "Airtable";
    if (baseId) {
      const b = j.bases.find((x) => x.id === baseId);
      if (b) name = `Airtable · ${b.name}`;
    } else if (j.bases.length === 1) {
      name = `Airtable · ${j.bases[0].name}`;
    }

    return {
      config: { apiKey, baseId } as unknown as Record<string, unknown>,
      name,
    };
  },

  // list semantics:
  //  - no folderId  → list tables in default baseId (or all bases if no default)
  //  - folderId="base:<baseId>" → list tables in that base
  //  - folderId="<baseId>/<tableId>" → reserved (use fetch instead)
  async list(connection, opts) {
    const cfg = readConfig<AirtableConfig>(connection);
    const folderId = opts?.folderId;

    // No folder: enumerate bases
    if (!folderId && !cfg.baseId) {
      const res = await fetch(`${API}/meta/bases`, { headers: authed(cfg.apiKey) });
      if (!res.ok) throw new Error(`Airtable list bases failed: ${res.status}`);
      const j = (await res.json()) as { bases: Array<{ id: string; name: string }> };
      const items: ConnectorListItem[] = j.bases.map((b) => ({
        externalId: `base:${b.id}`,
        title: b.name,
        mimeType: "airtable/base",
      }));
      return { items };
    }

    // Browse tables in a base
    let baseId = cfg.baseId;
    if (folderId?.startsWith("base:")) baseId = folderId.slice(5);
    if (!baseId) throw new Error("baseId not set");

    const res = await fetch(`${API}/meta/bases/${baseId}/tables`, {
      headers: authed(cfg.apiKey),
    });
    if (!res.ok) throw new Error(`Airtable list tables failed: ${res.status}`);
    const j = (await res.json()) as {
      tables: Array<{ id: string; name: string; description?: string }>;
    };
    const items: ConnectorListItem[] = j.tables.map((t) => ({
      externalId: `${baseId}/${t.id}`,
      title: t.name,
      mimeType: "airtable/table",
      preview: t.description,
    }));
    return { items };
  },

  // fetch: externalId is "<baseId>/<tableId>". Returns concatenated record fields as text.
  async fetch(connection, externalId): Promise<FetchedContent> {
    const cfg = readConfig<AirtableConfig>(connection);
    const [baseId, tableId] = externalId.split("/");
    if (!baseId || !tableId) throw new Error("externalId must be <baseId>/<tableId>");

    let offset: string | undefined;
    const lines: string[] = [];
    let title = tableId;
    let pageCount = 0;
    do {
      const url = new URL(`${API}/${baseId}/${tableId}`);
      url.searchParams.set("pageSize", "100");
      if (offset) url.searchParams.set("offset", offset);
      const res = await fetch(url, { headers: authed(cfg.apiKey) });
      if (!res.ok) throw new Error(`Airtable records failed: ${res.status}`);
      const j = (await res.json()) as {
        records: Array<{ id: string; fields: Record<string, unknown> }>;
        offset?: string;
      };
      for (const r of j.records) {
        const parts: string[] = [];
        for (const [k, v] of Object.entries(r.fields)) {
          if (v == null || v === "") continue;
          parts.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
        }
        if (parts.length) lines.push(parts.join("\n"));
      }
      offset = j.offset;
      pageCount += 1;
      if (pageCount > 50) break; // safety: cap at 5000 records
    } while (offset);

    // Try to get the table's friendly name
    try {
      const meta = await fetch(`${API}/meta/bases/${baseId}/tables`, {
        headers: authed(cfg.apiKey),
      });
      if (meta.ok) {
        const m = (await meta.json()) as { tables: Array<{ id: string; name: string }> };
        title = m.tables.find((t) => t.id === tableId)?.name ?? title;
      }
    } catch {
      /* non-fatal */
    }

    return {
      title,
      content: lines.join("\n\n"),
      mimeType: "airtable/table",
      meta: { baseId, tableId, recordCount: lines.length },
    };
  },
};
