import type { Connector, ConnectorId } from "./types";
import { googleDrive } from "./googleDrive";
// Phase 2b adds: notion, airtable, url

const REGISTRY: Record<string, Connector> = {
  google_drive: googleDrive,
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
  return Object.values(REGISTRY).map((c) => ({
    id: c.id,
    label: c.label,
    available: !!(c.authUrl ? envSet("GOOGLE_CLIENT_ID") : true),
    authMode: c.authUrl ? "oauth" : "key",
  }));
}

function envSet(key: string): boolean {
  return !!(process.env[key] && process.env[key]!.trim());
}
