// Notion connector. OAuth 2.0; tokens are long-lived (no refresh).
//
// Required env: NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, NOTION_REDIRECT_URI
// Setup: https://www.notion.so/my-integrations → "Public integration"

import type { Connector, ConnectorListItem, FetchedContent } from "./types";
import { readConfig } from "./types";

type NotionConfig = {
  accessToken: string;
  workspaceId?: string;
  workspaceName?: string;
  botId?: string;
};

const NOTION_VERSION = "2022-06-28";
const AUTH_HOST = "https://api.notion.com/v1/oauth/authorize";
const TOKEN_URL = "https://api.notion.com/v1/oauth/token";
const API = "https://api.notion.com/v1";

function envOrThrow(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env ${key}`);
  return v;
}

function authedHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// Walk Notion blocks and concatenate their plain_text fields.
async function fetchBlockText(token: string, blockId: string, depth = 0): Promise<string> {
  if (depth > 4) return ""; // safety
  let cursor: string | undefined;
  const out: string[] = [];
  do {
    const url = new URL(`${API}/blocks/${blockId}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);
    const res = await fetch(url, { headers: authedHeaders(token) });
    if (!res.ok) break;
    const j = (await res.json()) as { results: any[]; next_cursor: string | null };
    for (const block of j.results) {
      out.push(blockToText(block));
      if (block.has_children) {
        out.push(await fetchBlockText(token, block.id, depth + 1));
      }
    }
    cursor = j.next_cursor || undefined;
  } while (cursor);
  return out.filter(Boolean).join("\n");
}

function richToText(rich: any[] | undefined): string {
  if (!Array.isArray(rich)) return "";
  return rich.map((r) => r?.plain_text ?? "").join("");
}

function blockToText(block: any): string {
  const t = block.type;
  const data = block[t];
  if (!data) return "";
  switch (t) {
    case "heading_1":
    case "heading_2":
    case "heading_3":
      return "\n# " + richToText(data.rich_text);
    case "paragraph":
    case "quote":
    case "callout":
      return richToText(data.rich_text);
    case "bulleted_list_item":
    case "numbered_list_item":
    case "to_do":
      return "- " + richToText(data.rich_text);
    case "code":
      return "```\n" + richToText(data.rich_text) + "\n```";
    case "toggle":
      return richToText(data.rich_text);
    default:
      return richToText(data.rich_text ?? []);
  }
}

export const notion: Connector = {
  id: "notion",
  label: "Notion",

  authUrl(state: string) {
    const params = new URLSearchParams({
      client_id: envOrThrow("NOTION_CLIENT_ID"),
      redirect_uri: envOrThrow("NOTION_REDIRECT_URI"),
      response_type: "code",
      owner: "user",
      state,
    });
    return `${AUTH_HOST}?${params.toString()}`;
  },

  async exchangeCode(code: string) {
    const basic = Buffer.from(
      `${envOrThrow("NOTION_CLIENT_ID")}:${envOrThrow("NOTION_CLIENT_SECRET")}`
    ).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: envOrThrow("NOTION_REDIRECT_URI"),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Notion token exchange failed: ${res.status} ${t}`);
    }
    const j = (await res.json()) as {
      access_token: string;
      workspace_id: string;
      workspace_name?: string;
      bot_id: string;
      owner?: { user?: { person?: { email?: string } } };
    };
    const config: NotionConfig = {
      accessToken: j.access_token,
      workspaceId: j.workspace_id,
      workspaceName: j.workspace_name,
      botId: j.bot_id,
    };
    return {
      config: config as unknown as Record<string, unknown>,
      accountEmail: j.owner?.user?.person?.email,
      name: j.workspace_name ? `Notion · ${j.workspace_name}` : "Notion",
    };
  },

  async list(connection, opts) {
    const cfg = readConfig<NotionConfig>(connection);
    const res = await fetch(`${API}/search`, {
      method: "POST",
      headers: authedHeaders(cfg.accessToken),
      body: JSON.stringify({
        query: opts?.query ?? "",
        page_size: 50,
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        start_cursor: opts?.cursor,
      }),
    });
    if (!res.ok) throw new Error(`Notion search failed: ${res.status}`);
    const j = (await res.json()) as {
      results: any[];
      has_more: boolean;
      next_cursor: string | null;
    };
    const items: ConnectorListItem[] = j.results.map((p: any) => {
      const titleProp = p.properties && Object.values(p.properties).find((v: any) => v.type === "title");
      const title = richToText((titleProp as any)?.title) || "(untitled)";
      return {
        externalId: p.id,
        title,
        mimeType: "notion/page",
        modifiedAt: Date.parse(p.last_edited_time),
      };
    });
    return { items, nextCursor: j.has_more ? j.next_cursor || undefined : undefined };
  },

  async fetch(connection, externalId): Promise<FetchedContent> {
    const cfg = readConfig<NotionConfig>(connection);
    // Page meta
    const metaRes = await fetch(`${API}/pages/${externalId}`, {
      headers: authedHeaders(cfg.accessToken),
    });
    if (!metaRes.ok) throw new Error(`Notion page failed: ${metaRes.status}`);
    const meta = (await metaRes.json()) as any;
    const titleProp =
      meta.properties && Object.values(meta.properties).find((v: any) => v.type === "title");
    const title = richToText((titleProp as any)?.title) || "(untitled)";

    const content = await fetchBlockText(cfg.accessToken, externalId);
    return {
      title,
      content,
      mimeType: "notion/page",
      meta: { url: meta.url, lastEditedTime: meta.last_edited_time },
    };
  },
};
