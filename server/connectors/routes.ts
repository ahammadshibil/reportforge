// Connector routes are filled out in Phase 2.
// Phase 1 ships an empty registrar so routes.ts can wire it unconditionally.

import type { Express, RequestHandler } from "express";

export function registerConnectorRoutes(_app: Express, _guard: RequestHandler) {
  // populated in Phase 2
}
