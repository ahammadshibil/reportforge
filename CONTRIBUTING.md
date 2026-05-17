# Contributing to BYOR

Thanks for thinking about contributing.

BYOR is small, intentionally — one Node service, SQLite, no microservices. The contribution surface area that matters most is **recipes**.

## Three ways to contribute

### 1. Add a recipe (easiest, highest leverage)

A recipe is a workflow for a specific kind of recurring report. Examples already in the catalog: Founder Monthly Update, Engineering Weekly Digest, OSS Maintainer Update, VC LP Digest, Marketing Performance Monthly.

To contribute one:

**Easy path** — build it in the UI, then export it
1. Spin up BYOR locally (`npm run dev`)
2. Create a workspace, add a template/schedule/sources for your use case
3. Recipes page → Export → download `recipe.byor.json`
4. Drop the file in `recipes/community/` and open a PR

**Code path** — add it to [`server/recipes.ts`](server/recipes.ts) directly
1. Define a `Recipe` object with `id`, `name`, `category`, `bestFor`, `cadenceLabel`, `workspace`, `template?`, `schedule?`, `sampleSources?`, `connectorsRecommended?`, `exampleOutput?`
2. Add it to the `RECIPES` array
3. Open a PR

Good recipe contributions:
- Have a clear `bestFor` (who is this exactly for?)
- Cite the right `connectorsRecommended` so users know what to wire
- Include `exampleOutput` — even 100 words helps users decide
- Reuse existing connectors (Stripe, GitHub, Notion, Airtable, URL, MCP) when possible; new connectors are a separate PR

### 2. Add a connector

A connector pulls data from an external system and exposes it as fetchable items (sources) inside BYOR. Existing ones live in [`server/connectors/`](server/connectors/) — they all implement the same `Connector` interface (`server/connectors/types.ts`).

Three flavors:
- **OAuth** — see `googleDrive.ts` for the pattern
- **API key** — see `airtable.ts`, `stripe.ts`, `github.ts`
- **MCP-backed** — already covered by the generic `mcp.ts`; just publish your service as an MCP server and BYOR consumes it

Submit a connector PR with:
- The connector module in `server/connectors/<name>.ts`
- Registration in `server/connectors/registry.ts`
- Type added to `server/connectors/types.ts`
- README updated with the new entry in the "Connectors" table

### 3. Fix a bug or improve docs

PRs welcome. Smaller is better. If in doubt, open an issue first to align.

## Development setup

```bash
git clone https://github.com/ahammadshibil/reportforge
cd reportforge
npm install                       # install + native module compile
cp .env.example .env              # set ADMIN_EMAIL + ADMIN_PASSWORD + LLM key
npm run dev                       # http://localhost:5000
```

Typecheck:
```bash
npx tsc --noEmit
```

Build the production bundle:
```bash
npm run build
node dist/index.cjs
```

## Code style

- TypeScript strict-mode passes (`npx tsc --noEmit` is the gate)
- No comments stating the obvious; comments explain *why*, not *what*
- Server modules use `import` (TS) → bundled with esbuild
- Client uses Wouter hash routing (iframe-safe, no server-side routing config)
- Drizzle for SQL, never raw query strings except for migrations

## What we won't merge

- Telemetry / phone-home features
- Closed-source "enterprise edition" gating
- Dependencies that require accounts on someone else's SaaS to develop with
- Changes that break the single-file SQLite story (no separate Postgres requirement)

## License

By contributing, you agree your contributions ship under [MIT](LICENSE) like the rest of the project.

## Questions

Open an issue. Be specific about what you're trying to do — vague "how do I X" issues get less help than ones that show the env, the steps tried, and the error.
