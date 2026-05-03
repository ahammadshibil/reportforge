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

WORKDIR /app

# Just what the runtime needs: the bundled server, the client build,
# the package.json (so node sees "type": "module" / cjs hints),
# and node_modules with the native binaries already compiled for linux.
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
