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
  category: "vc" | "biotech" | "general";
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

// ----- Registry -----

export const RECIPES: Recipe[] = [
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
