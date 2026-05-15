import type { Connector, ConnectorId } from "./types";
import { googleDrive } from "./googleDrive";
import { notion } from "./notion";
import { airtable } from "./airtable";
import { urlConnector } from "./url";
import { mcpConnector } from "./mcp";
import { stripe } from "./stripe";
import { github } from "./github";

const REGISTRY: Record<string, Connector> = {
  google_drive: googleDrive,
  notion: notion,
  airtable: airtable,
  url: urlConnector,
  mcp: mcpConnector,
  stripe: stripe,
  github: github,
};

const ENV_REQ: Record<string, string[]> = {
  google_drive: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  notion: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET", "NOTION_REDIRECT_URI"],
  airtable: [],
  url: [],
  mcp: [], // each MCP server is configured per-connection (presets supply defaults)
  stripe: [],
  github: [],
};

export function getConnector(id: string): Connector | undefined {
  return REGISTRY[id];
}

export function listConnectorTypes(): Array<{
  id: ConnectorId;
  label: string;
  available: boolean;
  authMode: "oauth" | "key";
  description?: string;
}> {
  const DESCRIPTIONS: Partial<Record<ConnectorId, string>> = {
    google_drive: "Browse + import files from Google Drive (OAuth).",
    notion: "Search + import Notion pages (OAuth, native).",
    airtable: "Read records from Airtable bases (PAT).",
    url: "Fetch + strip web URLs as plain-text sources.",
    mcp: "Any MCP server — Colab, Notion, Perplexity, Jupyter, Obsidian, …",
    stripe: "MRR, customers, revenue, churn — pre-computed for monthly updates.",
    github: "Commits, PRs, releases, stars across your repos — engineering snapshot.",
  };
  return Object.values(REGISTRY).map((c) => {
    const need = ENV_REQ[c.id] || [];
    const available = need.every((k) => !!(process.env[k] && process.env[k]!.trim()));
    return {
      id: c.id,
      label: c.label,
      available,
      authMode: c.authUrl ? "oauth" : "key",
      description: DESCRIPTIONS[c.id],
    };
  });
}
