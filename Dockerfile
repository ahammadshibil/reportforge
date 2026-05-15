# ----- Build stage -----
FROM node:20-bookworm-slim AS build

# Native deps need build tooling at install time (better-sqlite3, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ----- Runtime stage -----
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=5000
# Persistent data lives here — mount a volume in prod.
ENV DATA_DIR=/data

# Tools the MCP-as-source connector needs to spawn server subprocesses.
# - ca-certificates: TLS roots for outbound HTTPS (LLMs, MCPs over HTTP/SSE).
# - curl: pulls the uv installer + healthchecks during deploy.
# - python3 + uv: required for stdio MCPs that ship as Python packages
#     (Colab MCP, Datalayer Jupyter MCP). Without uv, `uvx ...` connections
#     fail at spawn time.
# - npx is already on the PATH (ships with node:20-slim).
#
# Caveat for cloud deploys: browser-driven MCPs (NotebookLM, Substack)
# still won't work in this container — they need a real Chrome. Run those
# locally + pair with this image for everything else, OR add Playwright
# + chromium-browser in a layer if you really need them server-side.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl python3 \
  && curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Just what the runtime needs: the bundled server, the client build,
# the package.json (so node sees "type": "module" / cjs hints),
# and node_modules with the native binaries already compiled for linux.
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# /home/node is where npx + uvx cache. Make it writable so MCP subprocess
# spawns don't fail the first time they need to fetch a package.
RUN mkdir -p /data /home/node/.cache /home/node/.npm \
  && chown -R node:node /data /app /home/node

# Note on user: we run as root in the container. Reason: managed-runtime
# volume mounts (Railway, Fly, Render) typically attach the volume as
# root-owned, overriding any build-time chown. A non-root container then
# can't write data.db. The isolation boundary in these environments is
# the container itself, not the in-container user — so root is correct
# here. (For air-gapped self-host with USER node working, you'd add an
# entrypoint script that chowns /data at startup, but that's deferred
# until needed.)

# Pre-warm the npm cache for common npx-spawned MCPs so the first connect
# doesn't time out. Best-effort — failures here don't break the build.
RUN npx -y --no-update-notifier --silent obsidian-mcp-server@latest --help > /dev/null 2>&1 || true

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
