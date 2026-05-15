// Recipes — pre-baked workflow installers. Each recipe creates the
// workspace + (optional) template + (optional) schedule + (optional)
// sample sources for a concrete use case.
//
// Add a recipe by appending to RECIPES below. Recipes are static —
// they describe what to create, not how to run it.

import { storage } from "./storage";
import type { TemplateSchema } from "./templates";

export type Recipe = {
  id: string;
  name: string;
  description: string;
  category: "vc" | "biotech" | "general" | "founder" | "engineering" | "marketing" | "oss";
  // Who this is for (one-liner shown in the marketplace card)
  bestFor?: string;
  // Connectors the user should wire to get the full value. Recipe still
  // installs without these; values populate the install dialog as a checklist.
  connectorsRecommended?: Array<{ type: string; label: string; required?: boolean }>;
  // Human-readable cadence label (the schedule's cadence field is enum,
  // this displays e.g. "End of every month" / "Every Monday 9am")
  cadenceLabel?: string;
  // Short example excerpt of what the generated output looks like — shown
  // before install so users can see if the voice matches what they want.
  exampleOutput?: string;
  // What to create
  workspace: {
    name: string;
    industry?: string;
    brandColor?: string;
    logoText?: string;
  };
  template?: {
    name: string;
    kind: "invoice" | "report" | "newsletter" | "other";
    schema: TemplateSchema;
  };
  schedule?: {
    name: string;
    kind: "newsletter" | "report" | "deck";
    cadence: "daily" | "weekly" | "monthly";
    prompt: string;
    // deliveryTargets is optional; user fills in connection IDs after install
    // via Schedules UI. We seed a working email target if provided.
    recipients?: string;
    deliveryTargets?: any[];
  };
  sampleSources?: Array<{
    title: string;
    type: "note" | "pdf" | "csv" | "url";
    content: string;
  }>;
};

// ----- Atoms & Cells weekly bio newsletter -----

const ATOMS_AND_CELLS: Recipe = {
  id: "atoms-and-cells",
  name: "Atoms & Cells — Weekly Bio Newsletter",
  description:
    "Bio research + Indian biotech roundup. Pulls weekly papers + portfolio updates into a Substack-ready draft. Pair with NotebookLM MCP (paper grounding) + Obsidian MCP (vault drafts) + Substack MCP (publish).",
  category: "biotech",
  workspace: {
    name: "Atoms & Cells",
    industry: "Bio newsletter",
    brandColor: "#0f766e",
    logoText: "AC",
  },
  schedule: {
    name: "Weekly A&C draft",
    kind: "newsletter",
    cadence: "weekly",
    prompt: `Write the weekly Atoms & Cells edition. Voice: first-principles biology, India-aware. India companies treated as peers to global ones, not sidebar.

Structure:
1. Lead — the one signal of the week, framed as a mutation worth tracking.
2. Three primary-literature picks — for each: the paper's claim, why now, why this year, what's downstream.
3. India biotech beat — one company, one milestone, plain English.
4. Sector mutation — a connection across the week's signals.
5. Reading list — three things to chase next.

Avoid: business-school jargon, generic "AI in healthcare" framing, hype. Prefer concrete mechanism over hand-waving.`,
    recipients: "",
    deliveryTargets: [
      // User wires connectionId post-install via Schedules UI
      // Example shapes (commented):
      // { type: "vault", connectionId: 0, toolName: "obsidian_create_note", pathTemplate: "06-Content-Drafts/{date}-AC-{slug}.md" },
      // { type: "substack", connectionId: 0, toolName: "create_draft_post" }
    ],
  },
  sampleSources: [
    {
      title: "AC editorial principles",
      type: "note",
      content: `Atoms & Cells voice principles (apply to every edition):
- Biology metaphors over business jargon. "Mutation, drift, selection pressure" not "disruption, moat, runway."
- Connections over categories. Show how a TRIBE-style model in human cells connects to last month's CRISPR base-editor improvements.
- Conviction over consensus. If the week's consensus take is wrong, say so directly with reasoning.
- Indian biotech treated as a peer space. Not a "watch this emerging market" sidebar.
- Always ask: what would have to be true for this to compound into a 10-year shift?`,
    },
  ],
};

// ----- IC Memo template -----

const IC_MEMO_TEMPLATE: Recipe = {
  id: "ic-memo",
  name: "IC Memo Template",
  description:
    "Speciale-style investment committee memo. Structured fields for company, deal, market, team, risks, ask. Fill from deal sources (calls, deck, due diligence) via the LLM.",
  category: "vc",
  workspace: {
    name: "Deal Memos",
    industry: "VC IC",
    brandColor: "#1d4ed8",
    logoText: "IC",
  },
  template: {
    name: "IC Memo",
    kind: "report",
    schema: {
      name: "IC Memo",
      kind: "report",
      brand: { primaryColor: "#1d4ed8", accentColor: "#475569", logoPosition: "left" },
      layoutHints: [
        "Page 1 cover: company name, one-liner, ask, recommendation",
        "Page 2: company + market + team (left col) + financials (right col)",
        "Page 3: thesis + risks + diligence findings",
      ],
      fields: [
        // Header
        { key: "company_name", label: "Company", type: "text", required: true, group: "Header" },
        { key: "one_liner", label: "One-Liner", type: "text", required: true, group: "Header" },
        { key: "stage", label: "Stage", type: "text", group: "Header", placeholder: "Seed / Series A" },
        { key: "ask", label: "Ask", type: "currency", required: true, group: "Header" },
        { key: "round_size", label: "Round Size", type: "currency", group: "Header" },
        { key: "valuation", label: "Valuation (post)", type: "currency", group: "Header" },
        { key: "recommendation", label: "Recommendation", type: "text", required: true, group: "Header", placeholder: "Lead / Follow / Pass" },
        // Company
        { key: "what_they_do", label: "What they do", type: "textarea", required: true, group: "Company" },
        { key: "why_now", label: "Why now", type: "textarea", required: true, group: "Company" },
        { key: "founders", label: "Founders", type: "textarea", required: true, group: "Team" },
        // Market
        { key: "market_size", label: "Market size + growth", type: "textarea", group: "Market" },
        { key: "competition", label: "Competition", type: "textarea", group: "Market" },
        // Thesis
        { key: "thesis", label: "Investment thesis", type: "textarea", required: true, group: "Thesis" },
        { key: "what_must_be_true", label: "What has to be true", type: "textarea", group: "Thesis" },
        // Risks
        { key: "risks", label: "Top 3 risks", type: "textarea", required: true, group: "Risks" },
        { key: "diligence_open", label: "Open diligence items", type: "textarea", group: "Risks" },
        // Financials
        { key: "revenue", label: "Revenue (TTM)", type: "currency", group: "Financials" },
        { key: "burn", label: "Monthly burn", type: "currency", group: "Financials" },
        { key: "runway_months", label: "Runway (months)", type: "number", group: "Financials" },
        // Footer
        { key: "memo_date", label: "Memo date", type: "date", group: "Metadata" },
        { key: "memo_author", label: "Author", type: "text", group: "Metadata" },
      ],
    },
  },
};

// ----- Quarterly portfolio update -----

const QUARTERLY_PORTFOLIO: Recipe = {
  id: "quarterly-portfolio",
  name: "Quarterly Portfolio Update",
  description:
    "Quarterly LP-facing portfolio update. Synthesizes deal-level updates, headline metrics, sector commentary, watchlist into a cited PDF.",
  category: "vc",
  workspace: {
    name: "Portfolio Updates",
    industry: "VC LP comms",
    brandColor: "#7c3aed",
    logoText: "PU",
  },
  schedule: {
    name: "Quarterly portfolio update",
    kind: "report",
    cadence: "monthly",
    prompt: `Produce the quarterly portfolio update for LPs. Tone: candid, numerical, no hype.

Required sections:
1. Headline metrics — aggregate MRR / ARR growth, new investments closed, follow-ons led.
2. Winners — top 3 portfolio wins this quarter (with citations to sources).
3. Misses — companies that missed milestones; bridge needs called out honestly.
4. Sector commentary — 2-3 paragraphs on sector dynamics (capital flows, valuations, talent).
5. Watch list — 3 companies to watch next quarter.
6. Capital deployment — what was deployed, what's reserved.

Write only what the sources support. Cite every quantitative claim.`,
    recipients: "",
  },
};

// ----- Founder Monthly Investor Update -----

const FOUNDER_MONTHLY_UPDATE: Recipe = {
  id: "founder-monthly-update",
  name: "Founder Monthly Update",
  description:
    "End-of-month investor update. Pulls live numbers from Stripe + GitHub via connectors, synthesizes a structured update with TL;DR, KPIs, ship log, hires, asks. Wire it once, fire on the 28th forever.",
  category: "founder",
  bestFor: "YC / seed / Series A founders writing monthly investor updates",
  cadenceLabel: "End of every month (28th)",
  connectorsRecommended: [
    { type: "stripe", label: "Stripe (revenue + MRR + customers)", required: true },
    { type: "github", label: "GitHub (commits + PRs + releases)", required: true },
    { type: "notion", label: "Notion (qualitative notes — wins, lowlights, asks)" },
  ],
  exampleOutput: `**TL;DR.** MRR grew 18% to $42k, two enterprise pilots converted, and we shipped the redesigned onboarding. Burn held flat at $58k; runway is 14 months.

**The numbers.**
- MRR: $42k (+18% MoM) [Stripe]
- Active customers: 87 (+9 net new) [Stripe]
- Paid invoices last 30d: $48k collected
- Commits: 312 across 4 repos [GitHub]
- PRs merged: 47

**What we shipped.** Onboarding redesign cut TTV from 14min → 4min. New billing portal eliminated 60% of support tickets…`,

  workspace: {
    name: "Monthly Update",
    industry: "Startup",
    brandColor: "#1d4ed8",
    logoText: "MU",
  },
  schedule: {
    name: "Monthly investor update",
    kind: "newsletter",
    cadence: "monthly",
    prompt: `Write the monthly investor update. Audience: existing investors who already understand the business. Tone: candid, specific, no hype.

Required structure (use these exact section headings):

1. **TL;DR** — 3 sentences. The single most important signal, the headline metric direction, the one thing on the team's mind.
2. **The numbers** — Pull from the Stripe + GitHub snapshot sources. MRR + month-over-month change, customer count + delta, revenue last 30 days, runway (if mentioned in sources). Use exact figures with cited sources.
3. **What we shipped** — From the GitHub snapshot. Group by theme (not chronology). Cite repo + PR # when material.
4. **Team** — Hires, departures, key role openings. Only if material this month — otherwise omit the section entirely.
5. **Wins** — 2-4 specific wins. Customer logo names where allowed, deal sizes where appropriate, product milestones.
6. **Lowlights** — Things that didn't go well. Include even when uncomfortable — credibility compounds.
7. **Asks** — Specific intros, hires, or feedback. Each ask should be concrete enough that an investor could act on it in one reply.

Voice rules:
- Numbers first, narrative second.
- Cite every quantitative claim to its source.
- Lowlights are required, not optional. Investors trust founders who name them.
- Replace 'we're seeing X' with 'X happened — here's what we did'.
- Maximum 600 words total. Investors skim.`,
    recipients: "",
    deliveryTargets: [
      // User wires connectionIds post-install via Schedules UI
      // Example shape (commented out — uncomment in UI):
      // { type: "email", recipients: "lead@vc.com, board@vc.com" }
    ],
  },
  sampleSources: [
    {
      title: "Monthly update editorial principles",
      type: "note",
      content: `Editorial principles for monthly investor updates (apply every month):

- Numbers first. Every quantitative claim cites the snapshot it came from.
- Lowlights are required, not optional. They build credibility faster than wins do.
- Specific over general: "Acme Corp signed at \$2k MRR" beats "we landed a logo".
- Asks should be actionable in one reply. Vague "we'd love intros to anyone in retail" gets ignored; "we're looking for an intro to a CFO at a Series B+ vertical SaaS company in payments" gets responses.
- 600 words max. Investors skim. Lead with the headline metric.
- No hype words: 'tremendous', 'incredible', 'unprecedented'. Replace with the actual number.
- Show momentum direction even when the absolute number is small: "MRR grew 18% to \$12k" beats "MRR is \$12k".
- Track the same metrics every month. Investors notice when you stop reporting one.
- The TL;DR is three sentences. Not four. Not two.`,
    },
  ],
};

// ----- Engineering Weekly Digest -----

const ENGINEERING_WEEKLY: Recipe = {
  id: "engineering-weekly",
  name: "Engineering Weekly Digest",
  description:
    "Weekly engineering update for non-engineering leadership. Pulls commits + PRs + releases across all repos, surfaces themes (not chronology), highlights what's blocked. Reduces 'what did engineering do this week' meetings to zero.",
  category: "engineering",
  bestFor: "CTOs, eng managers, founders explaining engineering work to investors / sales / board",
  cadenceLabel: "Every Friday afternoon",
  connectorsRecommended: [
    { type: "github", label: "GitHub (multi-repo aggregation)", required: true },
    { type: "notion", label: "Notion (sprint goals, blockers)" },
    { type: "mcp", label: "Linear / Jira / Airtable via MCP (optional — ticket status)" },
  ],
  exampleOutput: `**This week, engineering shipped onboarding redesign + billing portal v2, with 47 PRs merged across 4 repos.**

**Themes (not chronology):**
1. *Onboarding velocity.* The redesigned flow (PRs #412, #418, #423) reduced TTV from 14 to 4 minutes…
2. *Reliability.* Three p99 latency fixes (#430, #434) brought the API 95th percentile from 800ms to 220ms…
3. *Billing.* Portal v2 (#445) eliminated 60% of support tickets…

**What's blocked.** SOC 2 audit waiting on infrastructure documentation — Sarah owns, ETA Tuesday.`,
  workspace: {
    name: "Engineering Weekly",
    industry: "Internal",
    brandColor: "#1d4ed8",
    logoText: "EW",
  },
  schedule: {
    name: "Engineering Friday digest",
    kind: "newsletter",
    cadence: "weekly",
    prompt: `Write the weekly engineering digest for non-engineering leadership (CEO, sales lead, head of customer success). Audience knows the business, doesn't know engineering specifics.

Required structure:
1. **One-line headline** — the single most important thing engineering shipped this week.
2. **The numbers** — From the GitHub snapshot. PRs merged, repos touched, contributor count, releases. Cite repo + PR # when material.
3. **Themes (not chronology)** — 3-5 themed groupings of work. Each theme: one sentence framing + bullet list of specific PRs/commits with their impact translated to business outcome ('cut TTV from 14min to 4min' not 'refactored onboarding state machine').
4. **What's blocked** — Honest. Naming blockers builds trust. Each blocker: what it is, who owns, ETA.
5. **What's planned next week** — 3 specific outcomes (not tasks).

Voice rules:
- Translate engineering work into business outcomes. PRs are evidence, not the story.
- Group by theme, not by repo or chronology — non-engineers don't have the mental model for either.
- Blockers are required when they exist. 'Nothing blocked' is allowed only when actually true.
- 350 words max. This is a digest, not a sprint review.`,
    recipients: "",
    deliveryTargets: [],
  },
  sampleSources: [
    {
      title: "Engineering digest editorial principles",
      type: "note",
      content: `Editorial principles for the weekly engineering digest:

- Audience: smart people who don't speak engineering. Translate every PR title into business outcome.
- Themes > chronology. 'Onboarding velocity' beats 'Monday we did X, Tuesday we did Y'.
- Specific over general: '47 PRs across 4 repos' beats 'a lot of work'.
- Cite the PR number once — readers click through if they care, ignore if they don't.
- Blockers are required when they exist. The week you stop reporting blockers is the week leadership stops trusting the report.
- 350 words max. Anything longer doesn't get read.`,
    },
  ],
};

// ----- VC Weekly LP Digest -----

const VC_LP_DIGEST: Recipe = {
  id: "vc-lp-digest",
  name: "VC Weekly LP Digest",
  description:
    "Weekly fund-level digest for LPs. Reads from the deal pipeline + portfolio milestones + sector commentary, synthesizes into a tight LP-facing update. The thing partners write but never on time.",
  category: "vc",
  bestFor: "Solo GPs and small VC firms keeping LPs warm between quarterly updates",
  cadenceLabel: "Every Friday afternoon",
  connectorsRecommended: [
    { type: "airtable", label: "Airtable (deal pipeline)", required: true },
    { type: "notion", label: "Notion (sector intel, meeting notes)" },
    { type: "url", label: "URLs (relevant news + portfolio company posts)" },
  ],
  exampleOutput: `**This week:** Two term sheets out (one signed), three new pilots from portfolio Q1 cohort, India deeptech valuations holding firm against US compression.

**Pipeline.** 14 new pitches reviewed, 3 advanced to second meetings. Strongest signal: enzyme design platform from IIT Bombay group…

**Portfolio milestones.**
- *Aerogenix* shipped first commercial pilot with ISRO.
- *Protomer Bio* closed Series A bridge at flat valuation — bridge to $30M Series B in Q3.
- *Locksmith Bio* missed Q1 milestone; on watchlist…

**Sector signal.** Indian biotech valuations are decoupling from US compression…`,
  workspace: {
    name: "LP Digest",
    industry: "VC LP comms",
    brandColor: "#7c3aed",
    logoText: "LP",
  },
  schedule: {
    name: "Weekly LP digest",
    kind: "newsletter",
    cadence: "weekly",
    prompt: `Write the weekly LP digest. Audience: existing LPs who already understand the fund + portfolio. Tone: candid, partner-direct, no fund-marketing voice.

Required structure:
1. **One-line summary** — most important fund-level signal this week.
2. **Pipeline** — Numbers from this week's pitches reviewed + advanced. 2-3 sentences on strongest signal (no company names if confidential).
3. **Portfolio milestones** — 3-5 specific portfolio events. Bullet per company, named, with one-sentence context. Wins AND lowlights — LPs trust GPs who report both.
4. **Sector signal** — One thread the fund is watching this week. 2-3 sentences max.
5. **Capital activity** — New commitments, dry powder, reserves. Numbers only when material.

Voice rules:
- LP-facing voice = partner voice, not associate voice. No fund-marketing phrases ('we're excited to…', 'tremendous opportunity').
- Named portfolio companies only when public OR with prior LP consent.
- Lowlights required. 'On watchlist' is a credible phrase.
- 400 words max. LPs read 30+ digests a week.`,
    recipients: "",
    deliveryTargets: [],
  },
  sampleSources: [
    {
      title: "LP digest editorial principles",
      type: "note",
      content: `Editorial principles for the weekly LP digest:

- Partner voice, not associate voice. 'We saw X' / 'we passed because Y' beats 'we're excited about X'.
- Named portfolio companies require public news OR prior LP consent. When in doubt, anonymize.
- Lowlights are required, not optional. LPs trust GPs who name miss + bridge needs early.
- Numbers carry weight: '14 pitches reviewed, 3 advanced' beats 'strong pipeline activity'.
- 400 words max. LPs receive dozens of weekly digests; brevity respects their time.
- Sector signal is the differentiator — LPs read every quarterly update. They read your weekly because of your taste.`,
    },
  ],
};

// ----- Marketing Performance Monthly -----

const MARKETING_MONTHLY: Recipe = {
  id: "marketing-monthly",
  name: "Marketing Performance Monthly",
  description:
    "End-of-month marketing performance report. Pulls site analytics (via URL connector to a Plausible/Umami/PostHog public dashboard), email metrics, and pipeline impact. For solo marketers and small marketing teams.",
  category: "marketing",
  bestFor: "Solo marketers + small marketing teams reporting to founders / heads of growth",
  cadenceLabel: "1st of every month",
  connectorsRecommended: [
    { type: "url", label: "URLs (Plausible / PostHog public dashboards, blog post URLs)" },
    { type: "notion", label: "Notion (campaign notes, copy versions)" },
    { type: "stripe", label: "Stripe (revenue attribution if you tag UTMs through to subscribe)" },
  ],
  exampleOutput: `**Headline:** Organic search drove 62% of qualified signups this month, up from 41% in March — content moat compounding.

**Traffic.** 38k uniques (+21% MoM). Top channels: organic (62%) → direct (18%) → referral (12%) → social (8%).

**Content.** 4 posts published, top performer 'The Obsidian-of-CRM thesis' drove 8.4k uniques + 312 newsletter signups…

**Funnel.**
- Site → newsletter: 4.1% (from 3.2% last month — landing page test winning)
- Newsletter → trial: 12% (flat)
- Trial → paid: 18% (from 14% — onboarding redesign helping)

**Spend.** $0 paid this month. CAC payback for organic-attributed = 2.4 months.

**Next month.** Triple down on the thesis-essay format that's working. Test newsletter referral incentive.`,
  workspace: {
    name: "Marketing Monthly",
    industry: "Marketing",
    brandColor: "#dc2626",
    logoText: "MM",
  },
  schedule: {
    name: "Monthly marketing report",
    kind: "newsletter",
    cadence: "monthly",
    prompt: `Write the monthly marketing performance report. Audience: founder + small marketing team. Tone: candid analyst, not promotional.

Required structure:
1. **Headline** — Single most important marketing signal this month, framed as a directional change.
2. **Traffic** — Sources, deltas, where attention is coming from. Cite the analytics source.
3. **Content** — What got published, what performed, top piece by attribution. 1-2 sentences per top piece.
4. **Funnel** — Site → newsletter → trial → paid conversion rates with month-over-month deltas.
5. **Spend** — What was spent, on what, with CAC + payback if computable. Be specific.
6. **What's working / what's not** — 2 short paragraphs. Equal weight.
7. **Next month** — 2-3 specific experiments planned.

Voice rules:
- Numbers first. Every claim cites a source.
- Directional language: 'organic share rose from 41% to 62%' beats 'organic is doing well'.
- 'What's not working' is required. Marketing reports that only show wins teach leadership nothing.
- 500 words max.`,
    recipients: "",
    deliveryTargets: [],
  },
};

// ----- Open Source Maintainer Update -----

const OSS_MAINTAINER_UPDATE: Recipe = {
  id: "oss-maintainer-update",
  name: "Open Source Maintainer Update",
  description:
    "Monthly update for an OSS project's community. Stars + contributors + releases + community signals. For maintainers explaining what shipped + asking for sponsorship without it feeling like begging.",
  category: "oss",
  bestFor: "OSS maintainers running GitHub Sponsors / Open Collective / Polar",
  cadenceLabel: "1st of every month",
  connectorsRecommended: [
    { type: "github", label: "GitHub (stars + commits + contributors + releases)", required: true },
    { type: "url", label: "URLs (blog posts, discussion threads, sponsor pages)" },
  ],
  exampleOutput: `**February in one line:** Shipped v2.0 with the long-promised plugin API, jumped to 14k stars, 23 new contributors landed PRs.

**By the numbers.** ⭐ 14,247 (+1,840 this month) · 312 commits · 47 PRs merged · 23 first-time contributors · 4 releases (v2.0 + 3 patches).

**v2.0 ships.** The plugin API is now stable. Six community plugins already published…

**Community moments.**
- A high school student in São Paulo built a Spanish-language plugin marketplace…
- Maintainer of competing project asked to merge…

**How you can help.** Three open issues need a Rust expert (#412, #418, #423). Sponsorship at $5/mo from anyone using this commercially keeps maintenance time funded.`,
  workspace: {
    name: "OSS Maintainer",
    industry: "Open source",
    brandColor: "#059669",
    logoText: "OS",
  },
  schedule: {
    name: "Monthly OSS update",
    kind: "newsletter",
    cadence: "monthly",
    prompt: `Write the monthly OSS maintainer update. Audience: contributors, sponsors, users, prospective contributors. Tone: warm but specific, no marketing speak.

Required structure:
1. **One-line month summary.**
2. **By the numbers** — From GitHub snapshot. Stars + delta, commits, PRs merged, contributors (named when material), releases shipped.
3. **What shipped** — Notable features/fixes. Cite PR # for each. Translate from changelog to user value.
4. **Community moments** — Specific named contributions or moments. Often the most-read section. New contributor stories, surprising use cases.
5. **How you can help** — 3 concrete asks (which issues need help, what kind of sponsorship matters). Never beg.

Voice rules:
- Specific named contributors > generic 'thanks to our community'. Recognition compounds.
- 'How you can help' must be concrete. 'Sponsor at $5/mo' beats 'consider supporting us'.
- Translate changelog → user impact. 'Fixed memory leak in worker pool' becomes 'long-running scripts no longer eat 4GB by hour 6'.
- 600 words max.`,
    recipients: "",
    deliveryTargets: [],
  },
};

// ----- Registry -----

export const RECIPES: Recipe[] = [
  FOUNDER_MONTHLY_UPDATE,
  ENGINEERING_WEEKLY,
  VC_LP_DIGEST,
  MARKETING_MONTHLY,
  OSS_MAINTAINER_UPDATE,
  ATOMS_AND_CELLS,
  IC_MEMO_TEMPLATE,
  QUARTERLY_PORTFOLIO,
];

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

// ----- Install -----

export type InstallResult = {
  recipe: { id: string; name: string };
  workspaceId: number;
  workspaceCreated: boolean;
  templateId: number | null;
  scheduleId: number | null;
  sourceIds: number[];
};

export function installRecipe(recipeId: string): InstallResult {
  const recipe = getRecipe(recipeId);
  if (!recipe) throw new Error(`unknown_recipe: ${recipeId}`);
  return installRecipeObject(recipe);
}

// Install any Recipe-shaped object. Used by both the built-in catalog
// (installRecipe → getRecipe → this) AND user-imported recipe.json files
// (POST /api/recipes/import → this).
export function installRecipeObject(recipe: Recipe): InstallResult {
  if (!recipe?.workspace?.name) {
    throw new Error("invalid_recipe: missing workspace.name");
  }

  // Find or create workspace by name (so re-install doesn't dupe).
  const existing = storage
    .listWorkspaces()
    .find((w) => w.name === recipe.workspace.name);
  let workspaceId: number;
  let workspaceCreated = false;
  if (existing) {
    workspaceId = existing.id;
  } else {
    const w = storage.createWorkspace({
      name: recipe.workspace.name,
      industry: recipe.workspace.industry ?? null,
      brandColor: recipe.workspace.brandColor ?? "#0f766e",
      logoText: recipe.workspace.logoText ?? recipe.workspace.name.slice(0, 2).toUpperCase(),
    });
    workspaceId = w.id;
    workspaceCreated = true;
  }

  // Sources
  const sourceIds: number[] = [];
  for (const s of recipe.sampleSources ?? []) {
    const created = storage.createSource({
      workspaceId,
      title: s.title,
      type: s.type,
      status: "ready",
      content: s.content,
      meta: null,
      connectionId: null,
      externalId: null,
      syncedAt: null,
    });
    sourceIds.push(created.id);
  }

  // Template
  let templateId: number | null = null;
  if (recipe.template) {
    const t = storage.createTemplate({
      workspaceId,
      name: recipe.template.name,
      kind: recipe.template.kind,
      schema: JSON.stringify(recipe.template.schema),
      previewImage: null,
      brandColor: recipe.template.schema.brand?.primaryColor ?? null,
    });
    templateId = t.id;
  }

  // Schedule
  let scheduleId: number | null = null;
  if (recipe.schedule) {
    const cadenceMs =
      recipe.schedule.cadence === "daily"
        ? 86400000
        : recipe.schedule.cadence === "weekly"
          ? 604800000
          : 2592000000;
    const s = storage.createSchedule({
      workspaceId,
      name: recipe.schedule.name,
      kind: recipe.schedule.kind,
      cadence: recipe.schedule.cadence,
      prompt: recipe.schedule.prompt,
      recipients: recipe.schedule.recipients ?? null,
      deliveryTargets: recipe.schedule.deliveryTargets
        ? JSON.stringify(recipe.schedule.deliveryTargets)
        : null,
      enabled: 0, // installed disabled — user reviews + enables explicitly
      lastRunAt: null,
      nextRunAt: Date.now() + cadenceMs,
    });
    scheduleId = s.id;
  }

  return {
    recipe: { id: recipe.id, name: recipe.name },
    workspaceId,
    workspaceCreated,
    templateId,
    scheduleId,
    sourceIds,
  };
}

// ----- Export -----
//
// Walk a workspace and serialize its current state as a Recipe JSON.
// Caller decides what to include (template, schedule, sources, and which
// specific sources). The returned shape is exactly the same as a built-in
// Recipe, so it round-trips through installRecipeObject without any
// translation layer.

export type ExportOpts = {
  includeTemplate?: boolean;     // include first template found, default true
  includeSchedule?: boolean;     // include first schedule found, default true
  includeSources?: boolean;      // include sources, default true
  sourceIds?: number[];          // when set, only these source ids — else all
  meta?: {
    id?: string;
    name?: string;
    description?: string;
    category?: Recipe["category"];
    bestFor?: string;
    cadenceLabel?: string;
    exampleOutput?: string;
    connectorsRecommended?: Recipe["connectorsRecommended"];
  };
};

export function exportWorkspaceAsRecipe(
  workspaceId: number,
  opts: ExportOpts = {}
): Recipe {
  const ws = storage.getWorkspace(workspaceId);
  if (!ws) throw new Error("workspace_not_found");

  const includeTemplate = opts.includeTemplate !== false;
  const includeSchedule = opts.includeSchedule !== false;
  const includeSources = opts.includeSources !== false;

  // Pick first template and first schedule (most workspaces have one of each
  // when used recipe-style). UI can be extended later to pick specific rows.
  const templates = storage.listTemplates(workspaceId);
  const schedules = storage.listSchedules(workspaceId);
  const allSources = storage.listSources(workspaceId);
  const sources = opts.sourceIds
    ? allSources.filter((s) => opts.sourceIds!.includes(s.id))
    : allSources;

  const recipeId =
    opts.meta?.id ||
    ws.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);

  const recipe: Recipe = {
    id: recipeId,
    name: opts.meta?.name || `${ws.name} recipe`,
    description:
      opts.meta?.description ||
      `Recipe exported from ${ws.name} on ${new Date().toISOString().slice(0, 10)}.`,
    category: opts.meta?.category || "general",
    bestFor: opts.meta?.bestFor,
    cadenceLabel: opts.meta?.cadenceLabel,
    connectorsRecommended: opts.meta?.connectorsRecommended,
    exampleOutput: opts.meta?.exampleOutput,
    workspace: {
      name: ws.name,
      industry: ws.industry || undefined,
      brandColor: ws.brandColor || undefined,
      logoText: ws.logoText || undefined,
    },
  };

  if (includeTemplate && templates[0]) {
    const t = templates[0];
    try {
      const schema = JSON.parse(t.schema) as TemplateSchema;
      recipe.template = {
        name: t.name,
        kind: (t.kind as any) || "other",
        schema,
      };
    } catch {
      // skip a template whose schema doesn't parse
    }
  }

  if (includeSchedule && schedules[0]) {
    const s = schedules[0];
    let deliveryTargets: any[] | undefined;
    try {
      deliveryTargets = s.deliveryTargets ? JSON.parse(s.deliveryTargets) : undefined;
    } catch {
      deliveryTargets = undefined;
    }
    // Strip connectionId from vault/substack targets — they're local to the
    // exporting deploy and won't make sense on import. Tool name + path
    // template survive (importer re-wires connectionId after install).
    if (deliveryTargets) {
      deliveryTargets = deliveryTargets.map((t: any) => {
        if (t?.type === "vault" || t?.type === "substack") {
          const { connectionId: _drop, ...rest } = t;
          return rest;
        }
        return t;
      });
    }
    recipe.schedule = {
      name: s.name,
      kind: s.kind as any,
      cadence: s.cadence as any,
      prompt: s.prompt,
      recipients: s.recipients || undefined,
      deliveryTargets,
    };
  }

  if (includeSources && sources.length > 0) {
    recipe.sampleSources = sources.map((s) => ({
      title: s.title,
      type: (["note", "pdf", "csv", "url"].includes(s.type) ? s.type : "note") as any,
      content: s.content,
    }));
  }

  return recipe;
}
