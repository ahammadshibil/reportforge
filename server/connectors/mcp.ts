// MCP (Model Context Protocol) connector. Lets BYOR consume any MCP server
// — official ones (Colab, Notion, Perplexity), mature community (Jupyter,
// Airtable, Obsidian), or experimental (NotebookLM, Substack) — as a
// source of content.
//
// Transports
//   stdio: spawn the MCP server as a subprocess. Good for local deploys
//          (laptop + Cloudflare tunnel). Won't work on most clouds where
//          the MCP server's runtime (uvx, browsers, etc.) isn't available.
//   http : connect to an SSE-over-HTTP MCP endpoint. Good for cloud BYOR
//          deploys talking to remote MCP servers (e.g. Notion's hosted MCP).
//
// Lifecycle
//   Per-call connect + close. Slower than long-lived clients but simple,
//   and resilient — a crashed MCP server doesn't poison subsequent calls.
//   We can swap to a connection pool later if latency matters.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Connector, ConnectorListItem, FetchedContent } from "./types";
import { readConfig } from "./types";

export type McpStdioConfig = {
  transport: "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
  // discovered on first connect, cached for UI hints
  toolNames?: string[];
  resourceCount?: number;
};

export type McpHttpConfig = {
  transport: "http";
  url: string;
  headers?: Record<string, string>;
  toolNames?: string[];
  resourceCount?: number;
};

export type McpConfig = McpStdioConfig | McpHttpConfig;

const CLIENT_INFO = { name: "byor", version: "1.0" } as const;
const CLIENT_CAPS = { capabilities: {} } as const;

async function connectClient(cfg: McpConfig): Promise<Client> {
  const client = new Client(CLIENT_INFO, CLIENT_CAPS);
  if (cfg.transport === "stdio") {
    const transport = new StdioClientTransport({
      command: cfg.command,
      args: cfg.args,
      env: { ...process.env, ...(cfg.env || {}) } as Record<string, string>,
    });
    await client.connect(transport);
  } else {
    // SSEClientTransport accepts a URL and an optional `requestInit` for headers.
    const transport = new SSEClientTransport(new URL(cfg.url), {
      requestInit: { headers: cfg.headers || {} },
    } as any);
    await client.connect(transport);
  }
  return client;
}

async function safeClose(client: Client) {
  try {
    await client.close();
  } catch {
    /* ignore */
  }
}

// Direct tool-call helper for use outside the connector's list/fetch
// surface — e.g. writing a generated asset back to an Obsidian vault.
// Returns the raw tool result; callers extract what they need.
export async function mcpCallTool(
  connection: import("@shared/schema").Connection,
  toolName: string,
  args: Record<string, unknown>
) {
  const cfg = readConfig<McpConfig>(connection);
  const client = await connectClient(cfg);
  try {
    return await client.callTool({ name: toolName, arguments: args });
  } finally {
    await safeClose(client);
  }
}

// Discover tool names on demand — UI uses this to populate write-tool pickers.
export async function mcpListTools(connection: import("@shared/schema").Connection) {
  const cfg = readConfig<McpConfig>(connection);
  const client = await connectClient(cfg);
  try {
    const out = await client.listTools();
    return (out.tools || []).map((t: any) => ({
      name: String(t.name),
      description: t.description ? String(t.description) : undefined,
      inputSchema: t.inputSchema,
    }));
  } finally {
    await safeClose(client);
  }
}

export const mcpConnector: Connector = {
  id: "mcp",
  label: "MCP server",

  // Accepts a flat input shape from the UI / API:
  //   { transport: "stdio", command, args, env?, name? }
  //   { transport: "http",  url, headers?, name? }
  async createFromKey(input) {
    const cfg = normalizeInput(input);
    const client = await connectClient(cfg);
    try {
      const [tools, resources] = await Promise.all([
        client.listTools().catch(() => ({ tools: [] as any[] })),
        client.listResources().catch(() => ({ resources: [] as any[] })),
      ]);
      const toolNames = (tools.tools || []).map((t: any) => t.name);
      const resourceCount = (resources.resources || []).length;
      const stored: McpConfig = {
        ...cfg,
        toolNames,
        resourceCount,
      } as McpConfig;
      const fallbackName =
        cfg.transport === "stdio"
          ? `MCP · ${cfg.command} ${(cfg.args || [])[0] ?? ""}`.trim()
          : `MCP · ${new URL(cfg.url).host}`;
      return {
        config: stored as unknown as Record<string, unknown>,
        name: (input.name as string | undefined) || fallbackName,
      };
    } finally {
      await safeClose(client);
    }
  },

  async list(connection, opts) {
    const cfg = readConfig<McpConfig>(connection);
    const client = await connectClient(cfg);
    try {
      const out = await client.listResources(
        opts?.cursor ? { cursor: opts.cursor } : undefined
      );
      const items: ConnectorListItem[] = (out.resources || []).map((r: any) => ({
        externalId: String(r.uri),
        title: String(r.name || r.title || r.uri),
        mimeType: r.mimeType ? String(r.mimeType) : undefined,
        preview: r.description ? String(r.description) : undefined,
      }));
      return {
        items,
        nextCursor: out.nextCursor ? String(out.nextCursor) : undefined,
      };
    } finally {
      await safeClose(client);
    }
  },

  // externalId can be either a resource URI ("notion://page/abc") or a
  // tool-call directive in the form "tool:<toolName>?<json-args>".
  // The latter is how we surface MCP tools as one-off fetchable items
  // (e.g. NotebookLM "query notebook X for Y" returns a grounded answer).
  async fetch(connection, externalId): Promise<FetchedContent> {
    const cfg = readConfig<McpConfig>(connection);
    const client = await connectClient(cfg);
    try {
      if (externalId.startsWith("tool:")) {
        const m = /^tool:([^?]+)(?:\?(.*))?$/.exec(externalId);
        if (!m) throw new Error(`bad tool externalId: ${externalId}`);
        const toolName = m[1];
        let args: Record<string, unknown> = {};
        if (m[2]) {
          try {
            args = JSON.parse(decodeURIComponent(m[2]));
          } catch {
            /* leave empty */
          }
        }
        const out = await client.callTool({ name: toolName, arguments: args });
        const content = extractContent(out.content);
        return {
          title: `${toolName}()`,
          content,
          mimeType: "text/plain",
          meta: { tool: toolName, args },
        };
      }
      // Resource read
      const r = await client.readResource({ uri: externalId });
      const content = extractContent(r.contents);
      return {
        title: externalId.split("/").pop() || externalId,
        content,
        mimeType: firstMime(r.contents),
        meta: { uri: externalId },
      };
    } finally {
      await safeClose(client);
    }
  },
};

function normalizeInput(input: Record<string, unknown>): McpConfig {
  const transport = String(input.transport || "stdio") as "stdio" | "http";
  if (transport === "stdio") {
    const command = String(input.command || "").trim();
    if (!command) throw new Error("stdio MCP requires `command`");
    const args = Array.isArray(input.args) ? input.args.map(String) : parseArgs(input.args);
    const env =
      input.env && typeof input.env === "object"
        ? Object.fromEntries(
            Object.entries(input.env as Record<string, unknown>)
              .filter(([, v]) => v !== "")
              .map(([k, v]) => [k, String(v)])
          )
        : undefined;
    return { transport: "stdio", command, args, env };
  }
  const url = String(input.url || "").trim();
  if (!url) throw new Error("http MCP requires `url`");
  const headers =
    input.headers && typeof input.headers === "object"
      ? Object.fromEntries(
          Object.entries(input.headers as Record<string, unknown>)
            .filter(([, v]) => v !== "")
            .map(([k, v]) => [k, String(v)])
        )
      : undefined;
  return { transport: "http", url, headers };
}

function parseArgs(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  // Split on whitespace, respect quoted segments.
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
}

function extractContent(parts: any): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p: any) => {
      if (typeof p === "string") return p;
      if (p?.type === "text" && typeof p.text === "string") return p.text;
      if (typeof p?.text === "string") return p.text;
      if (typeof p?.data === "string") return `[binary ${p.mimeType ?? ""}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function firstMime(parts: any): string | undefined {
  if (!Array.isArray(parts)) return undefined;
  for (const p of parts) {
    if (p?.mimeType) return String(p.mimeType);
  }
  return undefined;
}
