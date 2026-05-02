import { storage } from "./storage";

const SAMPLE_DEEPTECH = `
Quarterly portfolio update
Speciale Invest closed Q1 2026 with 4 new investments totaling $14M across deeptech, AI infrastructure, and biotech. Aggregate portfolio MRR grew 32% quarter-on-quarter. The healthcare AI segment outpaced others, contributing 41% of revenue growth.

Deal flow
Inbound deal flow rose 18% to 312 qualified pitches, driven by stronger founder communities in Bangalore and Chennai. Average pre-seed cheque size held at $750K. Two follow-on rounds were led at Series A: Aerogenix raised $12M and Protomer Bio raised $8M.

Sector commentary
Biotech and protein engineering remain the most capital-efficient segment in the portfolio with median burn under $180K per month. Aerospace and propulsion startups are showing strong commercial traction with three companies signing pilots with ISRO. AI infrastructure remains the most competitive segment, with valuations stretching beyond comparable global benchmarks.

Risks and watch list
Three portfolio companies missed quarterly milestones. Two require bridge rounds in the next six months. Currency volatility added 4% to dollar-denominated burn for India-based companies. The fund is reserving an additional $3M for follow-on protection.
`;

const SAMPLE_AI_TRENDS = `
Foundation models in 2026
Open-weights models continue to close the gap with frontier proprietary systems. Mid-tier 70B parameter models now match GPT-4-class performance on most reasoning benchmarks at 1/15th the inference cost. Specialized vertical models in biology, chemistry, and code are outperforming generalists in their domains.

Inference economics
Inference costs have fallen 47% year-on-year. Latency for streaming chat is now sub-300ms for most providers. Edge inference on consumer GPUs is viable for 13B models. Enterprises are increasingly running mixed deployments — frontier models for agents, mid-tier models for retrieval, edge models for completions.

Agent architectures
Long-horizon agents that can plan over hundreds of steps are reaching production quality. Tool-use accuracy is now above 92% on standard benchmarks. The next frontier is reliable multi-agent coordination, where current accuracy drops below 60% on complex workflows.

Capital flows
$48B was deployed into AI startups in the first quarter. 60% concentrated in foundation model labs and infrastructure. Enterprise AI applications captured $11B. Most importantly, application-layer revenue is growing 3x faster than infrastructure revenue, signaling a shift in where durable value will accrue.
`;

export async function seedIfEmpty() {
  if (storage.listWorkspaces().length > 0) return;

  const w1 = storage.createWorkspace({
    name: "Speciale Invest",
    industry: "Deeptech VC",
    brandColor: "#0f766e",
    logoText: "SI",
  });
  const w2 = storage.createWorkspace({
    name: "Northwind Labs",
    industry: "AI Research",
    brandColor: "#7c3aed",
    logoText: "NW",
  });

  storage.createSource({
    workspaceId: w1.id,
    title: "Q1 2026 Portfolio Memo",
    type: "note",
    status: "ready",
    content: SAMPLE_DEEPTECH,
    meta: null,
  });
  storage.createSource({
    workspaceId: w1.id,
    title: "Founder calls — March digest",
    type: "note",
    status: "ready",
    content:
      "Sentiment from 22 founder calls in March 2026 was cautiously optimistic. Hiring remains the top constraint. 18 of 22 cited GPU access as a near-term risk. 6 founders flagged extended sales cycles in enterprise pilots, averaging 4.2 months versus 2.8 last year.",
    meta: null,
  });
  storage.createSource({
    workspaceId: w2.id,
    title: "AI market trends — 2026",
    type: "note",
    status: "ready",
    content: SAMPLE_AI_TRENDS,
    meta: null,
  });

  storage.createSchedule({
    workspaceId: w1.id,
    name: "Weekly portfolio digest",
    kind: "newsletter",
    cadence: "weekly",
    prompt:
      "Summarize the latest portfolio updates, highlight winners and risks, end with three things to watch next week.",
    recipients: "team@speciale.invest",
    enabled: 1,
    lastRunAt: null,
    nextRunAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });
}
