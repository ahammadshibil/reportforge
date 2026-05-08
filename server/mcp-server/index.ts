// BYOR-as-MCP-server.
//
// Run this entry point and BYOR speaks MCP over stdio. Other MCP clients
// (Claude Desktop, Cursor, any agent stack) can then list & call BYOR's
// primitives — list_workspaces, synthesize, fill_template, render_template,
// run_schedule, etc — without touching the HTTP API.
//
// In-process: shares the same data.db, storage, synthesizer, generators,
// runner, delivery layer. Reads DATA_DIR + LLM_*  + BRAND_*  + email envs
// from process.env exactly like the HTTP server does.
//
// Run locally:
//   DATA_DIR=./prod-data ANTHROPIC_API_KEY=... npx tsx server/mcp-server/index.ts
//
// Wire to Claude Desktop (~/.claude/claude_desktop_config.json):
//   {
//     "mcpServers": {
//       "byor": {
//         "command": "npx",
//         "args": ["tsx", "/abs/path/to/reportforge/server/mcp-server/index.ts"],
//         "env": { "DATA_DIR": "/abs/path/to/reportforge/prod-data",
//                  "ANTHROPIC_API_KEY": "...",
//                  "BRAND_NAME": "BYOR" }
//       }
//     }
//   }

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { storage } from "../storage";
import { synthesize } from "../synthesizer";
import { runSchedule } from "../runner";
import {
  generatePdfReport,
  generatePptxDeck,
  generateNewsletterHtml,
} from "../generators";
import { getBrand } from "../brand";

// ------------------ Tool catalog ------------------

const TOOLS = [
  {
    name: "byor_list_workspaces",
    description: "List all workspaces (report spaces) in this BYOR instance.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "byor_list_sources",
    description: "List sources for a workspace.",
    inputSchema: {
      type: "object",
      properties: { workspaceId: { type: "number" } },
      required: ["workspaceId"],
      additionalProperties: false,
    },
  },
  {
    name: "byor_create_source",
    description: "Add a manual source (note / pasted text / URL) to a workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "number" },
        title: { type: "string" },
        content: { type: "string" },
        type: {
          type: "string",
          enum: ["note", "pdf", "csv", "url"],
          default: "note",
        },
      },
      required: ["workspaceId", "title", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "byor_list_templates",
    description: "List vision-extracted templates for a workspace.",
    inputSchema: {
      type: "object",
      properties: { workspaceId: { type: "number" } },
      required: ["workspaceId"],
      additionalProperties: false,
    },
  },
  {
    name: "byor_list_assets",
    description: "List generated assets (newsletters, reports, decks) for a workspace.",
    inputSchema: {
      type: "object",
      properties: { workspaceId: { type: "number" } },
      required: ["workspaceId"],
      additionalProperties: false,
    },
  },
  {
    name: "byor_synthesize",
    description:
      "Generate a newsletter / report / deck from sources. Returns the asset row including the JSON outline (with citations when LLM-backed).",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "number" },
        kind: { type: "string", enum: ["newsletter", "report", "deck"] },
        title: { type: "string" },
        prompt: { type: "string" },
        sourceIds: { type: "array", items: { type: "number" } },
        tone: { type: "string", enum: ["formal", "conversational", "punchy"] },
      },
      required: ["workspaceId", "kind", "title", "prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "byor_fill_template",
    description:
      "Auto-fill a template's fields from selected sources via the configured LLM. Returns { values, lineItems } — caller can pass to byor_render_template.",
    inputSchema: {
      type: "object",
      properties: {
        templateId: { type: "number" },
        sourceIds: { type: "array", items: { type: "number" } },
        brief: { type: "string" },
      },
      required: ["templateId"],
      additionalProperties: false,
    },
  },
  {
    name: "byor_render_template",
    description:
      "Render a template with provided values + optional line items. Returns the asset (HTML available at byor://assets/{id}).",
    inputSchema: {
      type: "object",
      properties: {
        templateId: { type: "number" },
        values: { type: "object", additionalProperties: true },
        lineItems: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      required: ["templateId", "values"],
      additionalProperties: false,
    },
  },
  {
    name: "byor_run_schedule",
    description: "Fire a schedule immediately (regardless of cadence). Returns the run result.",
    inputSchema: {
      type: "object",
      properties: { scheduleId: { type: "number" } },
      required: ["scheduleId"],
      additionalProperties: false,
    },
  },
] as const;

// ------------------ Server ------------------

const brand = getBrand();
const server = new Server(
  { name: `byor-${brand.name.toLowerCase()}`, version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS as any }));

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function err(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, any>;

  try {
    switch (name) {
      case "byor_list_workspaces":
        return ok(storage.listWorkspaces());

      case "byor_list_sources":
        return ok(storage.listSources(Number(args.workspaceId)));

      case "byor_create_source": {
        const created = storage.createSource({
          workspaceId: Number(args.workspaceId),
          title: String(args.title),
          type: (args.type as string) || "note",
          status: "ready",
          content: String(args.content),
          meta: null,
          connectionId: null,
          externalId: null,
          syncedAt: null,
        });
        return ok(created);
      }

      case "byor_list_templates":
        return ok(storage.listTemplates(Number(args.workspaceId)));

      case "byor_list_assets":
        return ok(storage.listAssets(Number(args.workspaceId)));

      case "byor_synthesize": {
        const ws = storage.getWorkspace(Number(args.workspaceId));
        if (!ws) return err("workspace_not_found");
        const allSources = storage.listSources(ws.id);
        const ids: number[] = Array.isArray(args.sourceIds) ? args.sourceIds : [];
        const sources = ids.length ? allSources.filter((s) => ids.includes(s.id)) : allSources;
        const kind = String(args.kind) as "newsletter" | "report" | "deck";

        const asset = storage.createAsset({
          workspaceId: ws.id,
          title: String(args.title),
          kind,
          prompt: String(args.prompt),
          status: "generating",
          sourceIds: JSON.stringify(ids),
          outline: null,
          filePath: null,
          contentHtml: null,
        });

        try {
          const outline = await synthesize({
            title: String(args.title),
            prompt: String(args.prompt),
            tone: ((args.tone as string) || "formal") as "formal" | "conversational" | "punchy",
            sources,
            kind,
          });
          const updates: any = { outline: JSON.stringify(outline), status: "ready" };
          const brandColor = ws.brandColor || brand.color;
          if (kind === "newsletter") {
            updates.contentHtml = generateNewsletterHtml({
              outline,
              brandColor,
              workspaceName: ws.name,
            });
          } else if (kind === "report") {
            updates.filePath = await generatePdfReport({
              outline,
              brandColor,
              workspaceName: ws.name,
              assetId: asset.id,
            });
          } else if (kind === "deck") {
            updates.filePath = await generatePptxDeck({
              outline,
              brandColor,
              workspaceName: ws.name,
              assetId: asset.id,
            });
          }
          const finalAsset = storage.updateAsset(asset.id, updates);
          return ok(finalAsset);
        } catch (e: any) {
          storage.updateAsset(asset.id, { status: "failed" });
          return err(e?.message || "generation_failed");
        }
      }

      case "byor_fill_template": {
        const t = storage.getTemplate(Number(args.templateId));
        if (!t) return err("template_not_found");
        const allSources = storage.listSources(t.workspaceId);
        const ids: number[] = Array.isArray(args.sourceIds) ? args.sourceIds : [];
        const sources = ids.length ? allSources.filter((s) => ids.includes(s.id)) : allSources;
        const { fillFromSources } = await import("../templates");
        const out = await fillFromSources({
          schema: JSON.parse(t.schema),
          sources,
          brief: typeof args.brief === "string" ? args.brief : undefined,
        });
        return ok(out);
      }

      case "byor_render_template": {
        const t = storage.getTemplate(Number(args.templateId));
        if (!t) return err("template_not_found");
        const { renderTemplateHtml } = await import("../templates");
        const html = renderTemplateHtml(
          JSON.parse(t.schema),
          (args.values ?? {}) as Record<string, any>,
          Array.isArray(args.lineItems) ? args.lineItems : []
        );
        const asset = storage.createAsset({
          workspaceId: t.workspaceId,
          title: `${t.name} (MCP fill)`,
          kind: "newsletter",
          prompt: `Rendered via MCP from template ${t.id}`,
          status: "ready",
          sourceIds: null,
          outline: JSON.stringify({
            templateId: t.id,
            values: args.values ?? {},
            lineItems: args.lineItems ?? [],
          }),
          filePath: null,
          contentHtml: html,
        });
        return ok({ assetId: asset.id, html });
      }

      case "byor_run_schedule": {
        const s = storage.getSchedule(Number(args.scheduleId));
        if (!s) return err("schedule_not_found");
        const result = await runSchedule(s);
        return ok(result);
      }

      default:
        return err(`unknown_tool: ${name}`);
    }
  } catch (e: any) {
    return err(e?.message || "internal_error");
  }
});

// ---- Resources: read assets / templates / sources by URI ----

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  // Walk all workspaces; aggregate first-page resources (capped to keep
  // the listing snappy — clients can call read_resource for any specific URI).
  const out: Array<{ uri: string; name: string; mimeType: string }> = [];
  for (const ws of storage.listWorkspaces()) {
    for (const a of storage.listAssets(ws.id).slice(0, 30)) {
      out.push({
        uri: `byor://assets/${a.id}`,
        name: `[${ws.name}] ${a.title}`,
        mimeType: a.kind === "newsletter" ? "text/html" : "application/json",
      });
    }
    for (const t of storage.listTemplates(ws.id).slice(0, 30)) {
      out.push({
        uri: `byor://templates/${t.id}`,
        name: `[${ws.name}] tpl: ${t.name}`,
        mimeType: "application/json",
      });
    }
  }
  return { resources: out };
});

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const uri = req.params.uri;
  const m = /^byor:\/\/(assets|templates|sources)\/(\d+)$/.exec(uri);
  if (!m) throw new Error(`unsupported_uri: ${uri}`);
  const kind = m[1];
  const id = Number(m[2]);

  if (kind === "assets") {
    const a = storage.getAsset(id);
    if (!a) throw new Error("asset_not_found");
    if (a.contentHtml) {
      return {
        contents: [{ uri, mimeType: "text/html", text: a.contentHtml }],
      };
    }
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              id: a.id,
              title: a.title,
              kind: a.kind,
              outline: a.outline ? JSON.parse(a.outline) : null,
              filePath: a.filePath,
            },
            null,
            2
          ),
        },
      ],
    };
  }
  if (kind === "templates") {
    const t = storage.getTemplate(id);
    if (!t) throw new Error("template_not_found");
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            { id: t.id, name: t.name, kind: t.kind, schema: JSON.parse(t.schema) },
            null,
            2
          ),
        },
      ],
    };
  }
  if (kind === "sources") {
    const s = storage.getSource(id);
    if (!s) throw new Error("source_not_found");
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `# ${s.title}\n\n${s.content}`,
        },
      ],
    };
  }
  throw new Error(`unsupported_kind: ${kind}`);
});

// ---- Bootstrap ----

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is fine for status messages — stdout is reserved for JSON-RPC.
  console.error(`[byor-mcp] ready · brand=${brand.name} · DATA_DIR=${process.env.DATA_DIR ?? "."}`);
})();
