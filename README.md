<div align="center">

# BYOR — Build Your Own Report

**The open-source autopilot for recurring reports & newsletters.**

Monthly investor updates · Weekly LP digests · Engineering rollups · Bio newsletters · IC memos · Quarterly portfolio updates · Anything you write on a cadence.

An open-source alternative to: **Notion** · **Beehiiv** · **Substack** · **HubSpot** · **Mailchimp**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy?template=https://github.com/ahammadshibil/reportforge)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/ahammadshibil/reportforge?style=social)](https://github.com/ahammadshibil/reportforge)

[Live demo](https://byor-shibil-production.up.railway.app) · [Recipes](#-recipes) · [Self-host in 30 seconds](#-self-host-in-30-seconds) · [Pricing](#-pricing) · [Build in public](#-build-in-public)

</div>

---

## What BYOR does

You write a recurring report. BYOR writes the first draft.

```
   Stripe / GitHub / Notion / Airtable / Obsidian / any MCP   →
       LLM synthesizes with citations    →
           branded PDF / HTML / PPTX     →
               email + Substack + Obsidian vault + webhook
```

Pick a recipe (founder monthly update, weekly LP digest, A&C-style newsletter). Connect your data sources. Schedule it. Every month/week/Friday a draft lands — cited, branded, ready for your editorial pass. You spend time on judgment, not on gathering-and-formatting.

---

## How BYOR compares

| | BYOR | Notion | Beehiiv | Substack | HubSpot |
|---|---|---|---|---|---|
| **Open source** | ✅ MIT | ❌ | ❌ | ❌ | ❌ |
| **Self-host free** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Bring your own LLM key** | ✅ Anthropic / OpenAI / Gemini / Perplexity / any | ❌ proprietary | ❌ proprietary | ❌ no AI | ❌ paid AI tier |
| **Auto-pull data from sources** | ✅ Stripe / GitHub / Notion / Airtable / URL / MCP | ❌ manual | ❌ manual | ❌ manual | ⚠️ CRM only |
| **Cited claims** | ✅ source-ref footnotes | ❌ | ❌ | ❌ | ❌ |
| **Scheduled autonomous delivery** | ✅ email + vault + Substack + webhook | ❌ | ⚠️ post-only | ⚠️ post-only | ⚠️ email only |
| **Per-recipient personalization** | ✅ `{{firstName}}` | ❌ | ✅ | ⚠️ tiers | ✅ |
| **Recipes / templates marketplace** | ✅ import/export `recipe.byor.json` | ⚠️ | ✅ paid | ❌ | ⚠️ |
| **Cloud option** | $29-99/mo | $10-25/seat | $49+/mo | 10% rev share | $45-1200/seat |

---

## 🍳 Recipes

8 recipes ship today. Each one is a pre-baked workflow you install with one click → connect data → schedule.

| Recipe | Best for | Cadence | Connectors |
|---|---|---|---|
| **Founder Monthly Update** | YC / seed / Series A founders | End of every month | Stripe + GitHub |
| **VC Weekly LP Digest** | Solo GPs and small VCs | Friday afternoon | Airtable + Notion |
| **Engineering Weekly Digest** | CTOs explaining work to non-eng leadership | Every Friday | GitHub |
| **Marketing Performance Monthly** | Solo marketers + small teams | 1st of every month | URL + Notion |
| **Open Source Maintainer Update** | OSS maintainers w/ Sponsors / Open Collective | 1st of every month | GitHub |
| **Atoms & Cells weekly** | Bio newsletter writers | Every Monday | Obsidian + Notion |
| **IC Memo** | VC investment committees | One-shot per deal | Any |
| **Quarterly Portfolio Update** | VC firms writing LP-facing quarterlies | Quarterly | Airtable |

Recipes are exportable as `recipe.byor.json` — share them, fork them, contribute new ones via PR. The library grows with the community.

---

## ⚡ Self-host in 30 seconds

### Option 1 — Railway (one click)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy?template=https://github.com/ahammadshibil/reportforge)

Sets up: `Dockerfile` build, 1GB volume, public domain, all on Railway's free tier.

### Option 2 — Local dev

```bash
git clone https://github.com/ahammadshibil/reportforge
cd reportforge
cp .env.example .env       # set ADMIN_EMAIL + ADMIN_PASSWORD + your LLM key
npm install
npm run dev                # http://localhost:5000
```

### Option 3 — Docker anywhere (Fly, Render, Hetzner, your own server)

```bash
git clone https://github.com/ahammadshibil/reportforge
cd reportforge
docker build -t byor .
docker run -d --name byor -p 5000:5000 -v $(pwd)/data:/data \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD=strong \
  -e LLM_API_KEY=AIza... -e LLM_PROVIDER=gemini -e LLM_MODEL=gemini-2.0-flash \
  byor
```

---

## 🔌 Connectors

Wire your data sources once, BYOR pulls fresh on every generation.

| Connector | Auth | What it pulls |
|---|---|---|
| **Stripe** | API key | MRR, customers, revenue, churn |
| **GitHub** | PAT | Commits, PRs, releases, stars, contributors |
| **Notion** | OAuth (official MCP) | Pages, databases |
| **Airtable** | PAT | Bases, tables, records |
| **Google Drive** | OAuth | Files, exported text |
| **Obsidian** | Local REST API plugin | Notes, frontmatter, tags |
| **URL** | None | HTML/PDF/CSV fetched + parsed |
| **Any MCP server** | per-server | Colab, NotebookLM, Substack, Perplexity, Jupyter, your own |

Plus: **BYOR is itself an MCP server** — Claude Desktop / Cursor / any MCP-aware agent can drive the whole pipeline. See [`server/mcp-server/`](server/mcp-server/index.ts).

---

## 🧠 Bring your own LLM key

Set whichever you have. Same code path, same outputs.

| Provider | Cost per generation | Vision (template extraction) | Get a key |
|---|---|---|---|
| **Gemini 2.0 Flash** ⭐ | ~$0.001 | ✅ | [aistudio.google.com](https://aistudio.google.com/apikey) — free tier 1500 req/day |
| Anthropic Claude Haiku 4.5 | ~$0.012 | ✅ | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI gpt-4o-mini | ~$0.002 | ✅ | [platform.openai.com](https://platform.openai.com) |
| Perplexity Sonar | ~$0.005 | text only | [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |
| Groq llama-3.3-70b | ~$0.008 | text only | [console.groq.com](https://console.groq.com) — generous free tier |
| Any OpenAI-compatible (OpenRouter, Together, local) | varies | depends | — |

Use a separate `VISION_LLM_*` provider when your text model can't see images (e.g. text-only models like Perplexity Sonar).

---

## 💰 Pricing

**Self-host (free, forever)** — clone this repo, `npm run dev`, you're done. No feature gating. No "enterprise edition." Same code as the cloud version.

**BYOR Cloud (hosted by us)** when you don't want to self-host:

| | Starter | Founder ⭐ | Team | Whitelabel |
|---|---|---|---|---|
| **Price** | $29/mo | $79/mo | $199/mo | $499/mo + $50/seat |
| **For** | Solo writer | Founder writing monthly updates | Small firms, multi-user | Partners reselling under their brand |
| **Workspaces** | 1 | 3 | unlimited | unlimited |
| **Recipes** | 8 starter | 8 starter + new monthly | + premium recipes | + custom recipes |
| **Connectors** | All | All | All | All |
| **LLM key** | yours | yours | yours | yours |
| **Custom domain** | — | ✅ | ✅ | ✅ |
| **Tenant branding** | basic | ✅ | ✅ | full whitelabel |
| **Support** | community | email | priority | dedicated |

[See full pricing →](https://byor.app/pricing) *(coming soon)*

---

## 🔭 What's under the hood

| Layer | Stack |
|---|---|
| **Engine** | Node 20 + Express 5 + TypeScript |
| **DB** | SQLite via better-sqlite3 (single-file, zero ops). At-rest encryption for connection tokens. |
| **LLM** | Provider-agnostic (Anthropic / OpenAI / Gemini / any OpenAI-compatible). Separate text + vision providers. |
| **Frontend** | React 18 + Vite + Tailwind + shadcn/ui. Wouter hash routing. TanStack Query. |
| **Generators** | pdfkit (PDF), pptxgenjs (PPTX), inline HTML (newsletter) |
| **Scheduler** | setInterval 60s tick. Daily / weekly / monthly cadences. |
| **Delivery** | Resend / SMTP / Obsidian-via-MCP / Substack-via-MCP / webhooks |
| **Connectors** | Native (Stripe, GitHub, Drive, Notion, Airtable, URL) + generic MCP framework |
| **Cleanup** | Daily TTL pass — orphan files, old versions, failed assets |
| **Sessions** | SQLite-backed (persistent across restarts) |
| **Security** | bcrypt-hashed admin auth, AES-256-GCM token encryption, SSRF block, login rate-limit |

---

## 📡 BYOR as MCP server

Other agents (Claude Desktop, Cursor) can drive BYOR's pipeline:

```bash
npm run mcp     # speaks MCP over stdio
```

Wire to Claude Desktop (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "byor": {
      "command": "npx",
      "args": ["tsx", "/abs/path/to/reportforge/server/mcp-server/index.ts"],
      "env": { "DATA_DIR": "/abs/path/to/reportforge/data" }
    }
  }
}
```

Tools exposed: `byor_list_workspaces`, `byor_synthesize`, `byor_fill_template`, `byor_render_template`, `byor_run_schedule`, + more.

---

## 🛠️ Self-host architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser  →  Express (5000)  →  SQLite (data.db)    │
│                  │                                   │
│                  ├── /api/sources    (read)          │
│                  ├── /api/generate   (synthesize)    │
│                  ├── /api/schedules  (cron)          │
│                  ├── /api/templates  (vision fill)   │
│                  ├── /api/recipes    (install/export)│
│                  └── /api/connections (Stripe/GH/MCP)│
│                  │                                   │
│  ┌───────────────┴────────────────┐                  │
│  │  Multi-provider LLM dispatch   │                  │
│  │  → Anthropic / OpenAI / Gemini │                  │
│  │  → any OpenAI-compatible       │                  │
│  └────────────────────────────────┘                  │
└─────────────────────────────────────────────────────┘
       ↓                ↓                ↓
   PDF/HTML/         email          Obsidian
   PPTX render    (Resend/SMTP)    vault writeback
                      ↓
                  Substack draft / webhook
```

---

## 🚀 Build in public

BYOR is being built openly. Story posts:

- [Where it started — a reporting dashboard demo](https://github.com/ahammadshibil/reportforge/blob/master/docs/launch-dev-to.md)
- v1.0.0 release notes — [`tag/v1.0.0`](https://github.com/ahammadshibil/reportforge/releases/tag/v1.0.0)

Follow:
- 𝕏 / Twitter — *coming soon*
- DEV.to — *coming soon*
- Discord — *coming soon*

Star the repo if BYOR helps. Stars are the leading indicator we use to decide where to push next.

---

## 📚 Documentation

- **Quick Start** — see [Self-host in 30 seconds](#-self-host-in-30-seconds)
- **Connector setup** — `.env.example` documents every env var
- **Recipe authoring** — see existing recipes in [`server/recipes.ts`](server/recipes.ts); export your own via UI
- **Architecture** — see [What's under the hood](#-whats-under-the-hood)
- **API reference** — REST routes listed in [`server/routes.ts`](server/routes.ts)
- **Provisioning a new tenant** — `./scripts/provision.sh <slug> "<name>" <email>`

---

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

Recipe contributions especially: build a `.byor.json` for your use case, open a PR adding it to [`server/recipes.ts`](server/recipes.ts). Every recipe is its own little vertical product.

---

## 🔐 Security

Found a security issue? Please disclose responsibly — see [SECURITY.md](SECURITY.md).

---

## 📄 License

[MIT](LICENSE) — use it, fork it, sell it, host it. No enterprise gotchas, no SSO held hostage.
