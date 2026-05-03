# ReportForge

Whitelabel autonomous reporting dashboard. A company drops in their brand, connects their data sources (Google Drive, Notion, Airtable, URLs), and ReportForge generates branded **PDFs**, **PPTX decks**, and **email-safe HTML newsletters** on a schedule — synthesized by Claude.

> **Status.** All five build phases shipped — whitelabel branding, auth, connectors (Google Drive / Notion / Airtable / URLs), multi-provider LLM synthesis, autonomous scheduler, email delivery, direct PDF/CSV/URL ingestion. **Plus**: vision-LLM **Templates** — upload any branded document image, extract a fillable schema, generate matching output. See [Roadmap](#roadmap).

## Quick Start

```bash
cp .env.example .env       # edit ADMIN_EMAIL / ADMIN_PASSWORD / BRAND_*
npm install
npm run dev                # http://localhost:5000
```

Production:

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

The SQLite database (`data.db`) auto-migrates and seeds two demo workspaces on first run.

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
