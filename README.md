# ReportForge

Autonomous reporting dashboard. React + Express + Tailwind + shadcn/ui frontend with a Node/Express backend that generates **PDFs (pdfkit)**, **PPTX decks (pptxgenjs)**, and **email-safe HTML newsletters** from your own sources.

## Quick Start

```bash
npm install
npm run dev          # http://localhost:5000  (Express + Vite on the same port)
```

Production build:

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

The SQLite database lives in `data.db` at the project root. It auto-migrates on boot and seeds two demo workspaces (Speciale Invest, Northwind Labs) on first run.

## Architecture

### Data model — `shared/schema.ts`
Drizzle + better-sqlite3. Four tables:
- `workspaces` — tenant + brand color + logo mark
- `sources` — uploaded files / pasted text / URLs, scoped per workspace
- `assets` — generated outputs (newsletter / report / deck), with file path + metadata
- `schedules` — recurring jobs (cadence + recipients + template)

### Backend — `server/`
| File | What it does |
|---|---|
| `index.ts` | Express bootstrap, Vite middleware in dev, static serve in prod |
| `routes.ts` | REST API — see below |
| `storage.ts` | Drizzle storage layer with idempotent `CREATE TABLE IF NOT EXISTS` migrations |
| `synthesizer.ts` | **Offline, deterministic** outline builder: heading-based chunking, top-keyword sentence ranking, metric extraction for `$`/`%` values. Output shape is stable so an LLM call (OpenAI/Claude) can drop in without changing the generators. |
| `generators.ts` | Three real generators: `generatePdfReport`, `generatePptxDeck`, `generateNewsletterHtml` |
| `seed.ts` | Seeds two demo workspaces and sample sources on first boot |

### REST API
```
GET    /api/workspaces
POST   /api/workspaces
PATCH  /api/workspaces/:id

GET    /api/sources?workspaceId=
POST   /api/sources
DELETE /api/sources/:id

GET    /api/assets?workspaceId=
GET    /api/assets/:id/file        # streams the underlying PDF/PPTX/HTML
POST   /api/generate                # body: { workspaceId, template, brief, tone, sourceIds }

GET    /api/schedules?workspaceId=
POST   /api/schedules
PATCH  /api/schedules/:id
DELETE /api/schedules/:id
```

### Generation pipeline
```
sources ─▶ synthesizer.buildOutline() ─▶ Outline {
                                           title, subtitle,
                                           executiveSummary,
                                           sections[], metrics[], callouts[]
                                         }
                                           │
                          ┌────────────────┼────────────────┐
                          ▼                ▼                ▼
                generatePdfReport  generatePptxDeck  generateNewsletterHtml
                  (pdfkit)         (pptxgenjs)        (HTML string)
                          │                │                │
                          └─────── written to /generated ───┘
                                           │
                                           ▼
                                  asset row in SQLite
```

### Swapping in an LLM
The `Outline` interface in `server/synthesizer.ts` is the contract. To swap the extractive synthesizer for an LLM, replace `buildOutline()` with a call to your model that returns the same shape. Generators do not need to change.

## Frontend — `client/src/`
- Wouter hash routing (required for iframe-safe deployment)
- TanStack Query v5 for all server state
- shadcn/ui components, Tailwind v3, dark mode via class
- Pages: Overview, Sources, Generate, Library, Schedules, Settings

## Notes
- SQLite via better-sqlite3 is **synchronous** — queries use `.get()` / `.all()` / `.run()`
- No `localStorage` anywhere (sandboxed iframe blocks it) — theme + workspace are React state
- `pptxgenjs` ESM/CJS interop: `const PptxGenJS: any = (pptxgen as any).default ?? pptxgen`
- pdfkit page numbering uses `bufferPages: true` and `bufferedPageRange()` — loop from `range.start` to `range.start + range.count`
