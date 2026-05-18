# Launch-Day Posts (every channel)

Every post below is ready to publish with light personal-voice edits. Edit any line marked `[edit me]`. Don't change the structure — these formats have been tested.

---

## 1. Show HN (Hacker News)

**Title** (≤ 80 chars, exactly this format):

```
Show HN: BYOR – Open-source autopilot for monthly investor updates
```

**URL:** `https://byor.app` (or `https://github.com/ahammadshibil/reportforge` if domain isn't live)

**Post body** (the textbox below the URL):

```
Hi HN — I built BYOR because every founder I know loses 2-4 hours per
month writing investor updates: opening Stripe + GitHub + the runway
spreadsheet, eyeballing numbers, copy-pasting last month's doc, then
staring at "what shipped" for 20 minutes.

BYOR pulls live data from Stripe / GitHub / Notion / Airtable / Obsidian
/ any MCP server, drafts the update via your own LLM key (Anthropic /
OpenAI / Gemini / Perplexity / any OpenAI-compatible), cites every
quantitative claim back to its source, and delivers to email + your
Obsidian vault + Substack draft + webhook on schedule.

Recipes that ship today: Founder Monthly Update, VC Weekly LP Digest,
Engineering Weekly Digest, Marketing Performance Monthly, OSS Maintainer
Update, Atoms & Cells-style newsletter, IC Memo, Quarterly Portfolio
Update. The recipe library is exportable as recipe.byor.json so anyone
can contribute their own vertical.

A few specific choices that turned out to matter:

- "Bring your own LLM key" — every other report tool locks you into
  their model and takes a markup. With BYOR you pay the LLM provider
  directly. Gemini Flash works at ~$0.001 per generation.

- Citations all the way through — every section of the Outline JSON
  has sourceRefs:[1,3] that flow into PDF footnotes, HTML <sup>
  links, and Obsidian [^N]:[[Source]] wikilinks. Trust the output OR
  catch the model's mistake; either way you know which source produced
  which claim.

- Bidirectional MCP — BYOR consumes any MCP server as a source, AND
  BYOR is itself an MCP server other agents can call. Claude Desktop
  / Cursor / any MCP-aware agent can drive the whole pipeline.

- One-command per-tenant deploy: scripts/provision.sh <slug>
  "<Brand>" <email>. Each customer gets their own Railway service
  with isolated data and brand. No multi-tenant code yet — that
  refactor comes at 30+ customers, not before.

Stack: Node 20 + Express + SQLite (better-sqlite3) + React 18 + Vite +
shadcn/ui. MIT licensed. Single-file SQLite means zero database ops.

Demo: https://byor-shibil-production.up.railway.app
Repo: https://github.com/ahammadshibil/reportforge
Deploy your own in 30 seconds:
  https://railway.com/deploy?template=https://github.com/ahammadshibil/reportforge

The honest gaps: it's brand-new (v1.0.0 shipped this week). The
recipe library has 8 starter recipes — community contributions are
how it grows. No multi-tenant cloud yet; per-tenant deploys + a
provisioning script is what's there today.

Happy to answer questions on architecture, the recipe-export format,
the MCP-as-source design, the per-tenant economics, or anything else.

— Shibil [edit me — add: e.g. "VC at Speciale Invest, building this on the side because I kept seeing the same pain in portfolio CEOs"]
```

**Tactics:**
- Post at exactly 9:00 AM ET / 6:00 AM PT Tuesday — peak HN traffic
- Reply to every comment within 30 minutes for the first 6 hours
- Don't be defensive in replies; HN respects "good point, here's the trade-off I made"
- If someone says "why not Notion AI?" — answer with the specific differentiators (data connectors, MCP, citations, BYO-LLM-key)
- If it doesn't hit front page in the first hour, it likely won't. Don't repost.

---

## 2. Product Hunt

**Title** (60 chars):
```
BYOR — Open-source autopilot for recurring reports
```

**Tagline** (60 chars):
```
Stop writing your monthly investor update by hand
```

**Description** (260 chars):
```
BYOR pulls live numbers from Stripe + GitHub + your data tools, drafts
your monthly report in your voice with citations, and delivers it on
schedule. Open source. Self-host free or use the cloud. Bring your own
LLM key. 8 starter recipes.
```

**Gallery** (upload in this order):
1. Hero screenshot — Recipes page with all 8 cards
2. Schedule fired → draft in Obsidian vault (split-screen GIF)
3. Connections page — Stripe + GitHub + Notion + MCP server tiles
4. Generated PDF with footnote citations
5. Pricing page — Self-host / Starter / Founder / Team / Whitelabel tiers

**First comment** (post this immediately as the maker — drives engagement):

```
Hi Product Hunt 👋

I built BYOR because every founder I know loses 2-4 hours per month
writing the investor update. The work is gathering + formatting, not
writing — and that's the part a machine should do.

What makes BYOR different from "ChatGPT writes my update":

🔌 Auto-pulls live data — Stripe MRR + GitHub commits + Notion notes,
   never stale screenshots
📎 Cites every claim — every section footnotes back to the source row
🔑 Bring your own LLM key — Anthropic / OpenAI / Gemini / Perplexity,
   no vendor lock-in or markup
🏠 Self-host free — full feature parity in cloud + self-host, no
   "enterprise tier" hostage
🍳 Recipes — 8 starter workflows shipped (Founder Monthly Update, VC
   LP Digest, Engineering Weekly, OSS Maintainer, A&C-style bio
   newsletter, IC Memo, Quarterly Portfolio, Marketing Monthly).
   Exportable as recipe.byor.json so the community can grow it.

Demo: [link]
Self-host: [GitHub link]
Cloud: [byor.app pricing]

The cloud version starts at $29/mo. The repo is MIT. Either way, your
data stays connected to your tools and your LLM — not ours.

Happy to answer anything in the comments. Will be hanging out here all
day.

— [edit me with your name/role]
```

**Tactics:**
- Submit the page 1 week before launch so it's queued for "scheduled launch"
- Set launch day, midnight PT
- The first 30 minutes of upvotes count most — DM 20 people in advance asking them to upvote at 7 AM PT
- Reply to every comment with substance, not "thanks!"

---

## 3. DEV.to

The full draft is already in `docs/launch-dev-to.md`. Light edits:

- Add a screenshot at the top (hero shot)
- Update the date in the "shipped this week" line
- Personal anecdote in the opening paragraph: pick a specific portfolio CEO friction you saw (no names — or with permission)

Publish at 10:00 AM ET. DEV.to's algorithm bumps posts with high
early-engagement velocity, so reply to every comment fast.

---

## 4. Reddit — r/SideProject

**Title:**
```
[Show] BYOR — open-source autopilot for monthly reports (founder updates / newsletters / LP digests)
```

**Body:**
```
Hey r/SideProject,

After spending too many Sundays watching founder friends write their
monthly investor updates by hand, I built BYOR — an open-source engine
that pulls live data from Stripe / GitHub / Notion / Obsidian / any MCP
server, drafts the report in your voice with citations, and delivers it
to email + vault + Substack on schedule.

Repo: https://github.com/ahammadshibil/reportforge
Demo: https://byor-shibil-production.up.railway.app
Deploy on Railway in 30s: https://railway.com/deploy?template=https://github.com/ahammadshibil/reportforge

8 recipes ship today:
- Founder Monthly Update (Stripe + GitHub)
- VC Weekly LP Digest (Airtable + Notion)
- Engineering Weekly (GitHub)
- Marketing Performance Monthly (URL + Notion)
- OSS Maintainer Update (GitHub)
- Bio newsletter (Obsidian + any MCP)
- IC Memo template
- Quarterly Portfolio Update

Recipes are exportable as recipe.byor.json so the community can grow
the library. PRs welcome.

Stack: Node + SQLite + React. MIT licensed. Self-host free, cloud
from $29/mo. Bring your own LLM key.

Happy to answer anything — especially feedback on what recipe is
missing for your specific report.
```

**Tactics:** Post at 10:00 AM ET. r/SideProject loves "I built this on the side and shipped it." Don't oversell. Reply to every comment.

---

## 5. Reddit — r/SaaS

**Title:**
```
Open-sourced my SaaS for recurring reports — here's what shipped + what I'm pricing it at
```

**Body:**
```
TL;DR: BYOR is an open-source engine for recurring reports (monthly
investor updates, weekly newsletters, LP digests, OSS maintainer
updates, etc). MIT licensed. Self-host free. Cloud from $29-$499/mo.

Repo: https://github.com/ahammadshibil/reportforge

The bet: in a saturated reporting market (Notion / Beehiiv / Substack /
HubSpot), an open-source alternative with feature parity + bring-your-
own-LLM-key + recipe marketplace + per-tenant deploys is a structural
opening. Nevo David (Postiz, Novu) proved this model works.

What's pre-shipped:
- 8 recipes spanning founder / VC / engineering / marketing / OSS / bio
- 7 connectors: Stripe, GitHub, Notion, Airtable, URL, MCP, Obsidian
- Multi-provider LLM (Anthropic / OpenAI / Gemini / Perplexity / any
  OpenAI-compatible) — separate text + vision providers
- Citations passthrough (sourceRefs → PDF footnotes + Obsidian
  wikilinks)
- Asset versioning + regenerate
- Per-recipient personalization ({{firstName}} substitution)
- Vault writeback (saves drafts as .md in Obsidian)
- Scheduler + multi-target delivery (email + vault + Substack + webhook)
- Per-tenant brand override (Settings UI, no env restart)
- One-command provisioning script for the hosted side

The pricing thinking:
- $0 self-host forever (open source = trust flywheel, not a moat)
- $29 Starter (you don't want to self-host)
- $79 Founder (the vertical pitch — monthly investor update)
- $199 Team (multi-user, custom domain)
- $499 + $50/seat Whitelabel (partner resell)

Cost per customer ~$1-6/mo (Railway + LLM). Margin is structural.

Open question I'd love opinions on: is $29 starter too cheap given
self-host is the same product? Or is it priced for the "I don't want
to run a server" segment that doesn't price-shop?

Repo + demo above. AMA.
```

---

## 6. Reddit — r/selfhosted

**Title:**
```
BYOR — self-hostable autopilot for recurring reports. Pulls Stripe / GitHub / Obsidian / any MCP, drafts, schedules, delivers. MIT.
```

**Body:**
```
Hi r/selfhosted,

Released BYOR today — an open-source engine for recurring reports.
Built to self-host first (the cloud version uses the same Docker image).

Why I think it might be interesting here:

- Single-file SQLite — no Postgres requirement, no separate DB ops
- Docker + railway.toml shipped — one-command deploy on Railway,
  Fly, Render, Hetzner, or your own Docker host
- Bring your own LLM key — Anthropic / OpenAI / Gemini / any
  OpenAI-compatible. Default to Gemini Flash for free.
- AES-256-GCM at-rest encryption for connection tokens
- SSRF defense on URL fetches (private IP blocklist, scheme allowlist)
- The data stays on your machine. Connector tokens encrypted in DB.
- AGPL-free — MIT licensed. No enterprise gotchas.

Connectors: Stripe, GitHub, Notion, Airtable, URL, Google Drive,
Obsidian (via Local REST API), and a generic MCP-server connector
that consumes any MCP server (NotebookLM, Colab, Jupyter, Substack,
your own).

Repo: https://github.com/ahammadshibil/reportforge
Docker:
  docker build -t byor .
  docker run -d -p 5000:5000 -v $(pwd)/data:/data \\
    -e SESSION_SECRET=$(openssl rand -hex 32) \\
    -e ADMIN_EMAIL=x -e ADMIN_PASSWORD=y \\
    -e LLM_API_KEY=AIza... -e LLM_PROVIDER=gemini \\
    byor

Includes a smoke-test script that runs end-to-end functional checks
against any deploy (curl + grep, no deps).

The honest gaps for self-hosters specifically:
- No telemetry. By design.
- Multi-user is single-admin-only today; multi-user is on the roadmap
  but only when there's demand signal.
- Backup is "you back up data.db." Docs link explains why this is
  enough for SQLite.

Happy to answer security / ops / scale questions.
```

---

## 7. Reddit — r/opensource

**Title:**
```
BYOR — open-source autopilot for recurring reports. MIT. Recipe marketplace built in.
```

**Body:**
```
Released today: BYOR, an MIT-licensed engine for recurring reports
(monthly investor updates, weekly newsletters, LP digests, etc).

Repo: https://github.com/ahammadshibil/reportforge

A few design choices that might matter to this sub:

- MIT, not AGPL. The Postiz pattern works fine; I don't want
  copyleft friction for downstream packagers.
- No telemetry. No "phone home" license check. No premium features
  gated by license server.
- No enterprise tier hostage. Cloud and self-host run from the same
  code path, same feature set.
- Recipe marketplace IS the protocol — workflows are exportable as
  recipe.byor.json files. PRs to add recipes welcome at
  server/recipes.ts.
- Bring your own LLM key. The project doesn't markup LLM costs;
  cloud is hosting + ops + support, not AI markup.

Open contribution surface that needs help:
1. **Recipe contributions** — biggest leverage. Your specific
   recurring report (board update, sales weekly, customer health
   review, etc) → a recipe. Build it in the UI → export → PR.
2. **MCP server integrations** — BYOR has a generic MCP connector;
   docs are light on which MCP servers play well. PRs adding
   tested-server presets to server/connectors/mcpPresets.ts welcome.
3. **Translations / i18n** — not started. If your community wants
   non-English UI, that's a clean PR to scope.

Stack: Node 20 + Express + SQLite + React. Single Dockerfile.

Roadmap is in the README. Issues are open. Discussions are on.
```

---

## 8. Reddit — r/indiehackers

**Title:**
```
$0 to MIT-licensed v1.0.0 in 3 weeks. Now what? (open-source autopilot for monthly reports)
```

**Body:**
```
Building in public for the first time. BYOR is an open-source engine
for recurring reports — monthly investor updates, weekly newsletters,
LP digests. Shipped v1.0.0 today.

Repo: https://github.com/ahammadshibil/reportforge

What I built:
- 22 build phases, ~40 commits
- 8 starter recipes, 7 connectors, multi-provider LLM
- One-command per-tenant Railway deploy
- Same code in cloud + self-host (no enterprise gating)
- MIT licensed

What I'm betting:
- The Postiz / Cal.com model works in this space too
- "Bring your own LLM key" beats "subscribe to our AI"
- Recipe library compounds (community PRs > my output)
- $29-$499 per tenant, hand-deployed via script until 30+ customers

What I haven't figured out yet:
- Will anyone actually pay when self-host is free?
- Is the $79 Founder tier the right anchor, or should I go higher?
- Should I launch with Stripe Checkout wired or wait for first 3
  manual sales?

Day job is at a VC firm so this is a side bet. Bandwidth cap is real.

If you've launched an open-source SaaS — what did you under-build
before launch? What did you over-build that nobody asked for?

Genuinely curious to hear from anyone who's run this play.
```

---

## 9. X / Twitter launch thread (10 tweets)

Post at 9:30 AM ET. Schedule via Typefully. Each tweet ≤ 280 chars.

```
1/10
Today I'm open-sourcing BYOR.

It's the autopilot for recurring reports — monthly investor updates,
weekly newsletters, LP digests, OSS maintainer notes.

MIT licensed. Self-host free. Cloud from $29/mo.

🧵 below for the build + the bet.

[Hero screenshot]


2/10
The problem:

Every founder I know loses 2-4 hours per month writing the investor
update. Half on gathering numbers from Stripe + GitHub + the runway
spreadsheet. Half on copy-pasting last month's doc and changing the
metrics.

The actual writing is the small part.


3/10
The fix:

BYOR pulls live data from your tools, drafts the update in your
voice with citations, delivers it to email + your Obsidian vault +
Substack draft on schedule.

You do the editorial. The machine does the gathering + formatting.


4/10
What's different from "ChatGPT writes my update":

🔑 Bring your own LLM key (Anthropic / OpenAI / Gemini / Perplexity)
🔌 Auto-pulls from Stripe / GitHub / Notion / Airtable / any MCP
📎 Cites every claim to its source — PDF footnotes, Obsidian wikilinks
🏠 Self-host free, cloud is opt-in


5/10
8 recipes ship today:

• Founder Monthly Update (Stripe + GitHub)
• VC Weekly LP Digest (Airtable)
• Engineering Weekly Digest (GitHub)
• Marketing Performance Monthly
• OSS Maintainer Update
• Bio / niche newsletter (Obsidian-connected)
• IC Memo template
• Quarterly Portfolio Update


6/10
Recipes are exportable as recipe.byor.json files.

That means anyone can fork a workflow, customize it, share it back.
The library grows from the community, not from me.

PRs at server/recipes.ts welcome.


7/10
The technical bet that surprised me:

MCP turned out to be the right integration surface. Instead of
building one connector per service forever, BYOR has a generic MCP
client that consumes ANY MCP server.

BYOR is also an MCP server itself — Claude Desktop can drive it.


8/10
The architectural choice I'm proud of:

Per-tenant deploys via one provisioning script:

./scripts/provision.sh acme "Acme Corp" admin@acme.com

Spins up a fresh Railway service in 5 min. Each customer
gets isolated data + their own brand. Multi-tenant refactor
waits until 30+ customers.


9/10
Stack:
• Node 20 + Express + SQLite (single file, zero ops)
• React 18 + Vite + Tailwind + shadcn/ui
• better-sqlite3 + drizzle for the DB
• AES-256-GCM at-rest encryption for tokens
• Docker + railway.toml shipped


10/10
Repo: github.com/ahammadshibil/reportforge

Star ⭐ if BYOR is useful — that's the leading indicator I use to
decide where to push next.

Demo: byor-shibil-production.up.railway.app
Cloud / pricing: byor.app

What recurring report should BYOR have a recipe for?
```

---

## 10. LinkedIn launch post

(Different audience from X — denser, more "professional," less hashtag-y.)

```
After 22 build phases and three weeks of nights/weekends, I'm
open-sourcing BYOR today.

[Hero screenshot]

BYOR is an autopilot for recurring reports — the monthly investor
update, the weekly LP digest, the engineering rollup to the
non-engineering leadership team, the bio newsletter.

The premise is simple: every founder, partner, marketer, and
maintainer I know writes the same recurring report every cycle.
Half their time is on gathering data from their tools and
formatting it. The other half is editorial — judgment, voice, the
specific paragraph that gets cited in the next board meeting.

The first half should be automated. The second half shouldn't.

BYOR is the engine for the first half. It pulls live data from
Stripe, GitHub, Notion, Airtable, Obsidian, or any MCP server.
Drafts the report through your own LLM key. Cites every
quantitative claim back to its source row. Delivers to email +
your vault + Substack on schedule.

Eight recipes ship today: Founder Monthly Update, VC Weekly LP
Digest, Engineering Weekly Digest, Marketing Performance Monthly,
OSS Maintainer Update, a bio-newsletter recipe (which I'm
dogfooding for Atoms & Cells), an IC Memo template, and a
Quarterly Portfolio Update.

Three architectural choices made the most difference:

1. The recipe layer — each "report type" is a click-installable
   workflow. The engine is horizontal; each recipe is a vertical.
2. Bring your own LLM key — no vendor lock-in. Anthropic, OpenAI,
   Gemini, Perplexity, anything OpenAI-compatible. Gemini Flash
   runs at ~$0.001 per generation.
3. MIT license, full feature parity in self-host and cloud. No
   enterprise-tier hostage features.

Self-host free, forever. Cloud from $29/mo when you don't want to
run your own infrastructure.

The repo, the docs, the recipes:
github.com/ahammadshibil/reportforge

Live demo:
byor-shibil-production.up.railway.app

If you write a monthly report by hand, I'd love your feedback.
What's the recurring report you write that BYOR should have a
recipe for? Reply, I read every one.

— Shibil
```

---

## 11. IndieHackers post

(Long-form, story-driven. IH audience loves "here's what I built + here's the numbers I'm going to share monthly.")

```
Title: Open-sourced my SaaS for recurring reports — building in public, monthly numbers from here

Body:

I'm launching BYOR today and committing to monthly transparency reports
on what's working and what's not.

What I built (3 weeks of nights/weekends):
- An open-source engine for recurring reports
- 8 starter recipes spanning founder updates / VC digests / engineering
  rollups / OSS maintainer notes
- 7 native connectors + a generic MCP-as-source layer
- Multi-provider LLM (no lock-in)
- Per-tenant Railway provisioning via one bash script
- MIT licensed, single Dockerfile, single SQLite file

What I'm betting:
- The Postiz/Cal.com/Plausible model works for reports too
- Self-host free + cloud opt-in is the right shape, not "enterprise
  tier with SSO held hostage"
- The recipe marketplace is the moat — community contributions
  compound, my output doesn't
- Per-tenant deploys until 30 customers, then refactor to multi-tenant

The first numbers I'll share next month (Day +30):
- GitHub stars
- Self-host download/deploy count
- Cloud sign-ups
- Paid customers + MRR
- Time spent on support vs feature work
- Honest assessment of whether this is working

If you've launched an open-source SaaS, I'd genuinely love advice on
the failure modes you didn't see coming. Specifically:
- Conversion from self-host to cloud (the Postiz challenge)
- Support burden : revenue ratio at small scale
- When you stopped feature-building and started selling

Repo: github.com/ahammadshibil/reportforge

I'll be in the comments all day.
```

---

## 12. Email to existing audience (Atoms & Cells subscribers + personal network)

(Send via your existing newsletter platform OR direct via personal email. ~150 recipients max for personal touch.)

**Subject:**
```
A side bet, finally shipped (and what I'd love your help with today)
```

**Body:**
```
Hi —

Quick break from the usual bio newsletter to tell you about something
I've been building on the side.

I open-sourced BYOR today — an autopilot for recurring reports. The
monthly investor update, the weekly LP digest, the bio newsletter, the
engineering rollup. Pulls live data from Stripe / GitHub / Notion / your
Obsidian vault / any MCP server, drafts the report in your voice with
citations, delivers it on schedule.

I built it because I kept watching portfolio CEOs at Speciale lose
half their Sunday to writing the monthly investor update, and because
I needed a real autopilot for Atoms & Cells. So I dogfooded it on A&C
and a few founder-update test runs.

What I'd love today:

1. ⭐ Star the repo if it's useful to you — that's the leading
   indicator I'll use to decide where to push next.
   → https://github.com/ahammadshibil/reportforge

2. If you write a recurring report by hand, try the cloud demo and
   tell me what's wrong with it. Brutal honesty preferred.
   → [byor.app or Railway demo URL]

3. If you know a founder writing monthly investor updates by hand,
   forward this. The "Founder Monthly Update" recipe pulls live
   Stripe + GitHub numbers — drafts the update in 30 seconds.

The repo is MIT. Self-host free. Cloud starts at $29/mo for people who
don't want to run their own infrastructure.

I'll write up monthly numbers (stars, sign-ups, MRR) here and on
LinkedIn / DEV.to. Transparent build-in-public.

Atoms & Cells continues its normal cadence. This is the side thing
finally seeing daylight.

Thanks for reading,
Shibil
```

---

## How to use this file

1. Edit `[edit me]` lines for personal voice
2. Drop in real screenshots / URLs once you have them
3. Schedule via Typefully (X), Buffer (LinkedIn), Product Hunt scheduled launch
4. Day-of: follow the timeline in `launch-playbook.md`

Don't over-edit. The first draft is usually the right voice. Founders fiddle their launch copy into mush.
