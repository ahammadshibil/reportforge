# Pre-Launch Content (14 days of build-in-public)

The goal of these 14 days: by launch morning, you have **200+ X followers**, **100+ Product Hunt upcoming-subscribers**, and **30+ GitHub stars from your existing network**.

Post one tweet per day on X. Post 3 long-form LinkedIn posts during the 14 days (one per week, roughly). Bias content toward **specific** + **technical** + **a real number** — Postiz/Nevo's pattern.

Each item below: paste, light edit, publish. Posts ladder — early ones tease the problem, mid ones reveal the build, late ones drive toward launch day.

---

## Day −14 (Tuesday before launch Tuesday)

**X:**
```
Every founder I know loses 2-4 hours per month writing the investor update.

The work is gathering data from 5 different tools and copy-pasting last month's doc. The actual writing is 20 minutes.

The 2 hours should be a machine. I'm building that machine.

Launching in 2 weeks.
```

---

## Day −13

**X:**
```
What "the gathering" actually looks like for a typical founder monthly update:

1. Open Stripe → screenshot MRR chart
2. Open GitHub → eyeball commits
3. Open runway spreadsheet
4. Open last month's Notion doc, copy-paste, change the numbers
5. Stare at empty "what shipped" for 20 minutes

Building an alternative.
```

---

## Day −12

**LinkedIn (post 1 of 3):**
```
A subtle thing I've noticed across portfolio CEOs:

The monthly investor update gets shorter the longer they've been
founder. Not because there's less to say. Because they're tired of
the gathering work.

Pattern I keep seeing:
- Month 1 of YC: 800 words, three sections, specific deals named
- Month 12: 200 words, generic "we hit our targets"
- Month 24: monthly becomes quarterly, then becomes "I'll send when I
  have time"

The decline isn't writing fatigue. It's the gathering fatigue — Stripe
+ GitHub + Notion + Slack + runway sheet — every single month.

Investors notice. The founder reads as "things must be bad."

The fix isn't more writing. It's automating the gathering so the
writing becomes the easy 20 minutes again.

Building it. More soon.
```

---

## Day −11

**X (technical post — these do well in dev / founder Twitter):**
```
Building BYOR. Architectural choice that surprised me:

MCP (Model Context Protocol) is the right integration layer.

Instead of writing one connector per service forever, ship a generic
MCP client. Now any MCP server becomes a data source.

Notion MCP, Colab MCP, NotebookLM, Obsidian, your own — all
consumable without per-service code.
```

---

## Day −10

**X:**
```
Show > tell. Today: BYOR pulled my actual Stripe metrics + my actual
GitHub repos + drafted a monthly update with citations.

Output: 600 words, 3 sections, every $ figure footnoted to the Stripe
snapshot that produced it.

Time: 9 seconds.

Manual baseline: 2-4 hours.
```
*(Include a screenshot of the actual output with footnotes visible.)*

---

## Day −9

**X:**
```
"Bring your own LLM key" is the right design for vertical AI SaaS:

- You pay the LLM provider directly (no markup)
- You're not locked to one model (swap Claude for Gemini in env)
- Privacy: your prompts go to the provider you trust
- Costs ~$0.001 per generation on Gemini Flash

Most B2B AI SaaS charges $99/mo and marks up tokens 5x. Other path
works.
```

---

## Day −8

**X:**
```
Recipe = workflow as a JSON file.

A BYOR recipe is workspace + template + schedule + sample sources +
metadata. ~300 lines of JSON.

Anyone can customize their workflow, export it, share it.

Founder Monthly Update is one recipe. Atoms & Cells weekly is
another. Engineering rollup is another. Same engine.
```

---

## Day −7 (Tuesday before launch)

**X:**
```
1 week until BYOR launches.

The open-source autopilot for recurring reports. Pulls live data from
your tools, drafts the report in your voice with citations, schedules
delivery to email + your vault + Substack.

Star the repo: github.com/ahammadshibil/reportforge

Tuesday next week.
```

**LinkedIn (post 2 of 3):**
```
Some numbers I've been chewing on:

- Founders spend ~3 hours/month writing the investor update
- 12 updates/year × 3 hours = 36 hours = roughly a full work week of CEO time
- CEO time is worth $200-400/hour fully loaded
- That's $7,200-$14,400 per year of monthly-update labor

Per founder. Per year.

If the gathering + first-draft step gets automated and the editorial
step stays human (where it belongs), you reclaim ~2/3 of that.

This is the "obviously should be automated" piece of running a
startup that has stayed manual mostly because the existing tools want
you to live in their walled garden.

Built BYOR over the last 3 weeks. Open source, MIT, self-host free.

Launching next Tuesday.
```

---

## Day −6

**X:**
```
The cleanest signal I've gotten while building BYOR:

When I showed it to a founder friend, he asked "wait — it can also
do my OSS maintainer monthly update?"

Yes. Different recipe, same engine.

The horizontal pattern under the vertical product.
```

---

## Day −5

**X:**
```
The cloud version of BYOR uses the same Docker image as the self-
hosted version. No feature gating.

The cloud price is for the work of running it (uptime, patches,
backup, support). Not for the software.

If you want to run it yourself, the repo is the whole thing.
```

---

## Day −4

**X:**
```
Citations matter more than I thought.

When the LLM drafts "MRR grew 18% to $42k", BYOR footnotes it back to
the exact Stripe snapshot row. Click [1] → see the source.

Either trust the output, or catch the model's mistake. Either way you
know what produced what.

This is the difference between "looks right" and "is right."
```

---

## Day −3

**X:**
```
Tomorrow I'll send a personal note to ~10 people I'd love to have
upvoting BYOR on launch day.

If you've ever written a monthly investor update / LP digest /
engineering newsletter by hand AND you'd be willing to RT or upvote
on Tuesday — reply and I'll send you the launch links 30min before.

(No bulk asks. Just 10 quality reciprocal asks.)
```

---

## Day −2

**X:**
```
2 days. Final dry run done.

The full loop:
- Stripe + GitHub auto-pull
- Synthesis via Perplexity / Gemini / Claude (your key)
- Citations + branded HTML output
- Delivered to email + Obsidian vault + Substack draft

You write the judgment paragraph. Everything else is the machine.
```

**LinkedIn (post 3 of 3):**
```
Two days until I open-source BYOR.

A reflection on the build:

I committed to a date 3 weeks ago. Wrote down "Tuesday, [date], MIT
license, public" and pinned it. Every architectural choice since then
has been "does this help us ship on Tuesday or hurt us?"

Most product-quality choices got made fast because they were
filtered through that one constraint.

The things I deferred:
- Multi-tenant (waiting for 30+ customers)
- Stripe Checkout in pricing (waiting for first 3 yeses)
- Telemetry (waiting until I have something to be told about)
- Mobile design audit (only 5% of usage)

The things I shipped:
- 8 starter recipes
- 7 connectors + a generic MCP layer
- Citations passthrough
- Per-tenant brand override
- Asset versioning
- Provisioning script

The hardest part wasn't building. It was deciding what NOT to build
to keep the date.

Tuesday. github.com/ahammadshibil/reportforge

If you'd like to be one of the first 20 people to try the cloud
version, message me — I'll set up an instance personally.
```

---

## Day −1

**X (single tweet, no thread, kept short for retweet):**
```
Tomorrow: open-sourcing BYOR.

The autopilot for recurring reports. MIT. Self-host free.

Quiet today. Loud tomorrow.

⏰ 9 AM ET • Show HN + Product Hunt • github.com/ahammadshibil/reportforge
```

---

## Day 0 — Launch Day

Follow the timeline in `launch-playbook.md`. The launch-day posts themselves are in `launch-posts.md`.

The pre-launch sequence ends here. Don't post the day-of tease tweet — let the launch content carry the day.
