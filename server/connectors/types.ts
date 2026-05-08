// Connector contract. Every connector implements either OAuth or API-key auth,
// plus list/fetch for browsing and pulling content.
//
// See googleDrive.ts for an OAuth example, airtable.ts for an API-key example.

import type { Connection } from "@shared/schema";

export type ConnectorId =
  | "google_drive"
  | "notion"
  | "airtable"
  | "url"
  | "mcp";

export type ConnectorListItem = {
  externalId: string;
  title: string;
  mimeType?: string;
  modifiedAt?: number;
  preview?: string; // optional snippet for the picker
};

export type FetchedContent = {
  title: string;
  content: string;
  mimeType?: string;
  meta?: Record<string, unknown>;
};

export type Connector = {
  id: ConnectorId;
  label: string; // display name in UI

  // OAuth flow (optional). If absent, connector is API-key based.
  authUrl?(state: string): string;
  exchangeCode?(code: string): Promise<{
    config: Record<string, unknown>;
    accountEmail?: string;
    name?: string;
  }>;

  // API-key flow (optional). Used by connectors like Airtable that pass a PAT directly.
  createFromKey?(input: Record<string, unknown>): Promise<{
    config: Record<string, unknown>;
    accountEmail?: string;
    name?: string;
  }>;

  // Browse upstream items. opts.cursor lets the connector implement pagination.
  list(connection: Connection, opts?: { folderId?: string; query?: string; cursor?: string }): Promise<{
    items: ConnectorListItem[];
    nextCursor?: string;
  }>;

  // Pull full content for one external item.
  fetch(connection: Connection, externalId: string): Promise<FetchedContent>;

  // Optional: refresh expired tokens. Mutates and returns new config.
  refresh?(connection: Connection): Promise<Record<string, unknown>>;
};

// Helper: parse JSON config from a Connection row, with type narrowing.
export function readConfig<T = Record<string, unknown>>(c: Connection): T {
  try {
    return JSON.parse(c.config) as T;
  } catch {
    return {} as T;
  }
}
