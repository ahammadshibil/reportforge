# BYOR — Build Your Own Report

> Whitelabel autonomous reporting dashboard for any team, anywhere. Bring your own LLM key, bring your own data sources, brand the deploy in one .env file. Generates **PDFs**, **PPTX decks**, and **email-safe HTML newsletters** from sources or vision-extracted **templates**.
>
> Codebase is `reportforge` (the engine); product is BYOR. Both names work.

> **Status.** All five build phases shipped — whitelabel branding, auth, connectors (Google Drive / Notion / Airtable / URLs), multi-provider LLM synthesis, autonomous scheduler, email delivery, direct PDF/CSV/URL ingestion. **Plus**: vision-LLM **Templates** — upload any branded document image, extract a fillable schema, generate matching output. See [Roadmap](#roadmap).

## Quick Start

```bash
cp .env.example .env       # edit ADMIN_EMAIL / ADMIN_PASSWORD / BRAND_*
npm install
npm run dev                # http://localhost:5000
```

## Deploy to production

### Cheapest path: Fly.io (~$0–5/month)

A `Dockerfile` and `fly.toml` are committed. One-time setup:

```bash
# 1. Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login

# 2. Create the app + volume + secrets
fly apps create reportforge                              # pick your name; edit fly.toml to match
fly volumes create reportforge_data --size 1 --region bom
fly secrets set \
  SESSION_SECRET=$(openssl rand -hex 32) \
  ADMIN_EMAIL=you@example.com \
  ADMIN_PASSWORD='change-me-to-something-strong' \
  GEMINI_API_KEY=AIza...                                 # see "Cheap LLM" below
fly secrets set BRAND_NAME='Your Brand' BRAND_COLOR='#0f766e'  # optional

# 3. Deploy
fly deploy
```

`auto_stop_machines = "stop"` in `fly.toml` scales to zero when idle, then wakes on the first request — costs $0 most months on a personal deploy.

### Other one-click hosts

Any platform that runs Docker + can mount a persistent volume:

| Platform | Notes |
|---|---|
| **Railway** | `railway up` after the Dockerfile is in. ~$5/mo. |
| **Render** | Web Service from Dockerfile + Disk add-on for `/data`. ~$7/mo. |
| **DigitalOcean App Platform** | Docker source + 1GB volume. ~$5/mo. |
| **Hetzner CX22** | €4/mo VM, run `docker compose up -d`. Most control. |
| **Self-host on a Mac mini / Pi** | Free. Set up Cloudflare Tunnel for HTTPS. |

> SQLite needs persistent disk. Fully-serverless platforms (Vercel, Cloudflare Workers) don't fit without swapping the storage layer.

### Cheap LLM keys (any one is enough)

BYOR uses LLMs for synthesis (text → JSON outline) and template extraction (image → JSON schema). Each can be a **different provider** — set `LLM_*` for text and `VISION_LLM_*` for vision when your text model can't see (e.g. Perplexity Sonar). Costs per generation, assuming ~10K input + 2K output tokens:

| Provider · Model | $/M in | $/M out | Per-gen | Vision | Free tier |
|---|---|---|---|---|---|
| **Gemini 2.0 Flash** ⭐ | $0.075 | $0.30 | **~$0.001** | ✅ | 1,500 req/day |
| Gemini 2.0 Flash-Lite | $0.04 | $0.15 | ~$0.0005 | ✅ | yes |
| OpenAI gpt-4o-mini | $0.15 | $0.60 | ~$0.002 | ✅ | — |
| Perplexity Sonar | $1 | $1 + $5 search | ~$0.005 | text-only | — |
| Anthropic Claude Haiku 4.5 | $1 | $5 | ~$0.012 | ✅ | — |
| Llama 3.3 70B (Groq) | $0.59 | $0.79 | ~$0.008 | text-only | generous |
| DeepSeek V3 (OpenRouter) | $0.27 | $1.10 | ~$0.005 | text-only | — |
| OpenAI gpt-4o | $2.50 | $10 | ~$0.025 | ✅ | — |
| Claude Sonnet 4.6 | $3 | $15 | ~$0.035 | ✅ | — |

**Recommended default:** `GEMINI_API_KEY` (`gemini-2.0-flash`). Free tier alone covers ~50 generations/day, no card on file. Vision works (template extraction works). At paid rates, **1000 generations/month = $1**. Get a key at [aistudio.google.com](https://aistudio.google.com).

For "use any OpenAI-compatible endpoint" — set `LLM_PROVIDER=openai`, `LLM_API_KEY=<key>`, `LLM_BASE_URL=<their endpoint>`, `LLM_MODEL=<their model id>`. Examples:

| Provider | `LLM_BASE_URL` | `LLM_MODEL` |
|---|---|---|
| Perplexity | `https://api.perplexity.ai` | `sonar`, `sonar-pro`, `sonar-reasoning` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| OpenRouter | `https://openrouter.ai/api/v1` | `deepseek/deepseek-chat`, `anthropic/claude-haiku-4-5` |
| Together | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |

### Vision separation (text-only providers)

If your text LLM doesn't do vision (Perplexity, Groq, most cheap options), set a **separate** `VISION_*` key for template extraction:

```bash
# Text synthesis on Perplexity (cheap, search-augmented)
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.perplexity.ai
LLM_API_KEY=pplx-...
LLM_MODEL=sonar

# Vision template extraction on free Gemini
VISION_LLM_PROVIDER=gemini
VISION_LLM_API_KEY=AIza...
VISION_LLM_MODEL=gemini-2.0-flash
```

If `VISION_*` is unset, vision falls back to the main LLM — fine for Anthropic/OpenAI/Gemini, but template extraction will fail at request time on text-only providers.

### Local production build

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

The SQLite database (`data.db`) and `generated/` outputs honor `DATA_DIR` (defaults to `.` in dev, `/data` in the Docker image).

## Whitelabel — make it yours

All branding is env-driven, so a single deploy = a single branded tenant. No code changes required.

| Env var | Purpose |
|---|---|
| `BRAND_NAME` | App name (sidebar, page title, email subjects) |
| `BRAND_TAGLINE` | Subtitle on login page |
| `BRAND_COLOR` | Hex accent color — drives sidebar primary, asset chrome, email accent |
| `BRAND_LOGO_URL` | Optional logo image (path or URL). Falls back to initials. |
| `BRAND_LOGO_TEXT` | Initials shown when no logo image |
| `BRAND_DOMAIN` | Domain used in email From / footers |
| `BRAND_FOOTER` | Footer text appended to newsletters/PDFs |
| `BRAND_SUPPORT_EMAIL` | Optional support address surfaced in UI |
| `BRAND_THEME` | `light` / `dark` / `auto` |

The brand config is exposed at `GET /api/brand` and applied at runtime — colors flow into CSS vars, logo into the sidebar, name into the title bar.

## Auth

Single admin per deploy. Set `ADMIN_EMAIL` plus either `ADMIN_PASSWORD` (dev) or `ADMIN_PASSWORD_HASH` (bcrypt, prod). Sessions are cookie-based via `express-session` + `memorystore`.

For local development you can set `AUTH_DISABLED=1` to skip the gate entirely.

## Roadmap

- [x] Phase 1 — Whitelabel foundation: env brand config, session auth, login gate
- [x] Phase 2 — Connectors: Google Drive (OAuth), Notion (OAuth), Airtable (PAT), URL bookmark lists
- [x] Phase 3 — LLM synthesis: Anthropic / OpenAI / Gemini / any OpenAI-compatible endpoint, extractive fallback
- [x] Phase 4 — Autonomous loop: `setInterval` scheduler + email via Resend (preferred) / SMTP (nodemailer)
- [x] Phase 5 — Direct ingestion: PDF parsing (pdf-parse), CSV row rendering, URL fetch + HTML strip
- [x] Phase 6 — **Templates**: vision-LLM extraction (Anthropic / OpenAI / Gemini) of branded document samples → schema → fillable form → branded HTML/PDF output. Generalizes invoices, reports, newsletters, certificates, anything repetitive.
- [ ] Future — server-side chart generation, asset versioning, multi-recipient personalization, Slack/Teams delivery

## Architecture

### Data model — `shared/schema.ts`
Drizzle + better-sqlite3. Tables:
- `workspaces` — report spaces (e.g. "Weekly digest", "Sector scans"), each with their own accent color
- `sources` — uploaded text / linked-in connector files
- `assets` — generated outputs (newsletter / report / deck) with file path + outline JSON
- `schedules` — recurring jobs (cadence + recipients + template)

### Backend — `server/`
| File | What it does |
|---|---|
| `index.ts` | Express bootstrap, sessions, Vite middleware in dev, static serve in prod |
| `brand.ts` | Whitelabel brand config from env |
| `auth.ts` | Single-admin session auth (env credentials, no user table) |
| `routes.ts` | REST API |
| `storage.ts` | Drizzle storage with idempotent migrations |
| `synthesizer.ts` | Async `synthesize()` — uses Claude when `ANTHROPIC_API_KEY` is set, falls back to extractive |
| `generators.ts` | `generatePdfReport`, `generatePptxDeck`, `generateNewsletterHtml` |
| `connectors/` | Pluggable connectors (Google Drive, Notion, Airtable, URL) — Phase 2 |
| `seed.ts` | Seeds demo workspaces on first boot |

### REST API
```
GET    /api/brand                       # whitelabel config (public)

GET    /api/auth/me                     # current session
POST   /api/auth/login                  # { email, password }
POST   /api/auth/logout

GET    /api/workspaces
POST   /api/workspaces
PATCH  /api/workspaces/:id

GET    /api/workspaces/:id/sources
POST   /api/sources
DELETE /api/sources/:id

GET    /api/workspaces/:id/assets
GET    /api/assets/:id
GET    /api/assets/:id/file             # streams PDF/PPTX/HTML
POST   /api/generate                    # body: { workspaceId, kind, title, prompt, sourceIds, tone }
DELETE /api/assets/:id

GET    /api/workspaces/:id/schedules
POST   /api/schedules
PATCH  /api/schedules/:id
DELETE /api/schedules/:id
```

### Generation pipeline
```
sources ─▶ synthesize() ─▶ Outline {
              title, subtitle,         (LLM via @anthropic-ai/sdk
              executiveSummary,         when ANTHROPIC_API_KEY set,
              sections[],               extractive otherwise)
              metrics[], callouts[]
           }
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
  PDF       PPTX     HTML newsletter
   │          │          │
   └─── /generated/ ──────┘
              │
              ▼
       asset row in SQLite
```

### Frontend — `client/src/`
- Wouter hash routing (iframe-safe)
- TanStack Query v5 for all server state
- shadcn/ui + Tailwind v3, dark mode via class
- Pages: Overview, Sources, Connections, Generate, Library, Schedules, Settings, Login
- `BrandProvider` injects brand color into CSS vars at runtime

## Notes
- SQLite via better-sqlite3 is synchronous — queries use `.get()` / `.all()` / `.run()`
- `pptxgenjs` ESM/CJS interop: `const PptxGenJS: any = (pptxgen as any).default ?? pptxgen`
- pdfkit page numbering uses `bufferPages: true` and `bufferedPageRange()`
- Sessions are stored in `memorystore` — for production use, swap to a persistent store (Redis, SQLite-backed) before scaling
