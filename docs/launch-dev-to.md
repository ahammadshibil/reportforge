---
title: "I built an open-source autopilot for monthly investor updates 🤯"
published: false
description: "Every founder loses 2-4 hours a month writing investor updates. So I built BYOR — open source, MIT, self-host on Railway in 30 seconds. Here's how + why."
tags: opensource, indiehackers, javascript, ai
cover_image: https://github.com/ahammadshibil/reportforge/raw/master/docs/social-preview.png
canonical_url: https://github.com/ahammadshibil/reportforge
---

> *Draft notes for Shibil — this is the launch post for DEV.to / X / LinkedIn. Edit the personal bits (the section about Speciale Invest + Atoms & Cells), keep the structure. Cross-post to: DEV.to, r/SideProject, r/SaaS, r/selfhosted, r/IndieBiz, LinkedIn, X. Stagger by 24 hours so each one gets first-look momentum.*

---

## The thing I kept hearing from founder friends

"I spend half my Sunday writing the monthly investor update."

Same pattern, every time:

1. Open Stripe → screenshot the MRR chart
2. Open GitHub → eyeball commit counts
3. Open the runway spreadsheet
4. Open a fresh Notion doc, copy last month's update, change the numbers
5. Stare at the empty "what shipped" section for 20 minutes
6. Write the asks paragraph that gets ignored
7. Send. Repeat next month.

Two-to-four hours of gathering + formatting. Then 20 minutes of actual editorial.

The ratio is upside down.

## So I built BYOR

**Build Your Own Report.** Open source. MIT. Self-host on Railway in 30 seconds. Or use the hosted cloud.

→ https://github.com/ahammadshibil/reportforge

What it does:

```
Stripe + GitHub + Notion + your vault   →   BYOR pulls fresh data
        ↓
LLM synthesizes a structured update     →   in your voice, with citations
        ↓
PDF / HTML / branded newsletter         →   delivered to email + vault + Substack
```

Pick a recipe (founder monthly update, weekly LP digest, OSS maintainer update, A&C-style newsletter). Wire your data sources once. Schedule it. Every month a draft lands ready for editorial.

You write the judgment paragraph. BYOR does the gathering-and-formatting.

## The pitch in one screen

| Recipe | Best for | Cadence | Connectors needed |
|---|---|---|---|
| **Founder Monthly Update** | YC / seed / Series A founders | End of every month | Stripe + GitHub |
| **VC Weekly LP Digest** | Solo GPs and small VCs | Friday afternoon | Airtable + Notion |
| **Engineering Weekly Digest** | CTOs explaining work to non-eng leadership | Every Friday | GitHub |
| **OSS Maintainer Update** | Maintainers running GitHub Sponsors | Every month | GitHub |
| **Marketing Performance Monthly** | Solo marketers | 1st of every month | URL + Notion |
| **Bio / niche newsletter** | Newsletter writers | Weekly | Obsidian + any MCP |

8 recipes ship today. Export your own as `recipe.byor.json` and the community grows the catalog.

## Why open source

Three reasons:

**1. Your data is the product.** Stripe metrics, GitHub activity, the qualitative notes you've been writing in Obsidian for years — that's *your* operating story. Pumping it through a closed SaaS feels wrong. With BYOR, you self-host. Your data never leaves your machine + your LLM provider.

**2. Bring your own LLM key.** Anthropic, OpenAI, Gemini, Perplexity, any OpenAI-compatible. Gemini Flash free tier covers most use cases — ~$0.001 per generation. The product doesn't lock you into a vendor + take a markup.

**3. Permissive license.** MIT. No "enterprise edition." No SSO held hostage. No telemetry. Fork it, sell it, host it. I'll happily merge your PRs.

## What I learned shipping this

A few things that surprised me building BYOR:

**The recipe abstraction was the unlock.** I started with "BYOR is a report engine." That was too abstract. It became real when I committed to "BYOR is a recipe runner — each recipe is a vertical product wrapping the same engine." Founder Monthly Update is one recipe. Atoms & Cells weekly is another. IC Memo is another. Same code, totally different products from the buyer's perspective.

**MCP turned out to be the killer integration surface.** Instead of building one connector per service forever, BYOR has a generic MCP connector that consumes any MCP server (NotebookLM, Notion, Colab, Substack, Obsidian, your own). The recipe library compounds even when *I'm* not adding connectors.

**Citations changed how I felt about LLM output.** I added `sourceRefs: [1, 3]` to every section in the synthesizer's JSON contract. PDFs render footnotes. Obsidian gets proper `[^N]: [[Source Title]]` wikilinks. Now when a draft says *"MRR grew 18%"*, you can click [1] and see the Stripe snapshot it came from. Trust the output OR catch the model's mistake — either way, you know.

**Per-tenant deploys before multi-tenant.** I almost built a full multi-tenant SaaS. Then I realized: spinning up a fresh Railway service per customer with one `provision.sh` command works fine for the first 50 customers. The refactor to true multi-tenant is the kind of thing you do once you have signal, not once you have features.

## What's next

- v1.0.0 is shipped. 22 build phases ([see release notes](https://github.com/ahammadshibil/reportforge/releases/tag/v1.0.0))
- I'll be writing here monthly about what I'm shipping + what the GitHub star + MRR numbers look like (yes, Nevo David inspired this)
- If BYOR helps you write your monthly update, ⭐ star the repo. That's the leading indicator I use to decide where to push next.

## Try it

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy?template=https://github.com/ahammadshibil/reportforge)

```bash
git clone https://github.com/ahammadshibil/reportforge
cd reportforge
npm install
npm run dev
```

Open http://localhost:5000. Click **Recipes** → **Founder Monthly Update** → install. Wire Stripe + GitHub. Run now.

5 minutes to your first auto-generated monthly investor update.

Or sign up at https://byor.app *(coming soon — the hosted version for people who don't want to self-host)*.

---

Let me know in the comments:
- What recurring report do you write that BYOR should have a recipe for?
- Self-host or hosted-cloud — which are you trying first?
- What's your existing workflow that BYOR is replacing?

I read every comment. Star the repo if you want me to keep building this in public.

— Shibil ([@ahammadshibil](https://github.com/ahammadshibil))
