import type { Connector, ConnectorId } from "./types";
import { googleDrive } from "./googleDrive";
import { notion } from "./notion";
import { airtable } from "./airtable";
import { urlConnector } from "./url";

const REGISTRY: Record<string, Connector> = {
  google_drive: googleDrive,
  notion: notion,
  airtable: airtable,
  url: urlConnector,
};

const ENV_REQ: Record<string, string[]> = {
  google_drive: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  notion: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET", "NOTION_REDIRECT_URI"],
  airtable: [],
  url: [],
};

export function getConnector(id: string): Connector | undefined {
  return REGISTRY[id];
}

export function listConnectorTypes(): Array<{
  id: ConnectorId;
  label: string;
  available: boolean;
  authMode: "oauth" | "key";
}> {
  return Object.values(REGISTRY).map((c) => {
    const need = ENV_REQ[c.id] || [];
    const available = need.every((k) => !!(process.env[k] && process.env[k]!.trim()));
    return {
      id: c.id,
      label: c.label,
      available,
      authMode: c.authUrl ? "oauth" : "key",
    };
  });
}
