// Lightweight content synthesizer.
// Builds an outline + section copy from source documents and the user prompt.
// Deterministic + offline; designed so an LLM can be swapped in by replacing
// `synthesize()` with an OpenAI/Claude call. Output shape stays the same.

import type { Source } from "@shared/schema";

export type Section = { heading: string; bullets: string[]; paragraph: string };
export type Outline = {
  title: string;
  subtitle: string;
  executiveSummary: string;
  sections: Section[];
  metrics: { label: string; value: string; delta?: string }[];
  callouts: string[];
};

// --- text utils ---
const STOP = new Set(
  "a an and are as at be but by for from has have he her him his i if in is it its not of on or our she so than that the their them they this to was we were what when where which who will with you your".split(
    " "
  )
);

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 320);
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t) && t.length > 2);
}

function topKeywords(text: string, k = 12): string[] {
  const counts = new Map<string, number>();
  tokens(text).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([w]) => w);
}

function scoreSentence(s: string, kw: string[]): number {
  const t = new Set(tokens(s));
  let score = 0;
  kw.forEach((k, i) => {
    if (t.has(k)) score += kw.length - i;
  });
  return score / Math.max(1, Math.sqrt(t.size));
}

function pickSentences(text: string, n: number, kw: string[]): string[] {
  const sents = sentences(text);
  if (sents.length === 0) return [];
  const ranked = sents
    .map((s) => ({ s, score: scoreSentence(s, kw) }))
    .sort((a, b) => b.score - a.score);
  const picked: string[] = [];
  const seen = new Set<string>();
  for (const { s } of ranked) {
    const key = s.slice(0, 60).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(s);
    if (picked.length >= n) break;
  }
  return picked;
}

// derive simple metrics: counts, percentages, $ figures from text
function extractMetrics(text: string): { label: string; value: string; delta?: string }[] {
  const out: { label: string; value: string; delta?: string }[] = [];
  const moneyRe = /\$\s?\d[\d,\.]*\s?(?:million|billion|M|B|K|thousand)?/gi;
  const pctRe = /\d+(?:\.\d+)?\s?%/g;
  const money = Array.from(text.matchAll(moneyRe)).slice(0, 2).map((m) => m[0]);
  const pcts = Array.from(text.matchAll(pctRe)).slice(0, 2).map((m) => m[0]);
  money.forEach((m, i) =>
    out.push({ label: i === 0 ? "Headline figure" : "Secondary figure", value: m })
  );
  pcts.forEach((p, i) =>
    out.push({ label: i === 0 ? "Key change" : "Secondary change", value: p, delta: p })
  );
  return out.slice(0, 4);
}

function chunkByHeadings(text: string): { heading: string; body: string }[] {
  // Split on lines that look like headings (Title Case short lines or all caps)
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const groups: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string } | null = null;
  for (const line of lines) {
    const isHeading =
      line.length < 80 &&
      /^[A-Z0-9]/.test(line) &&
      !/[.!?]$/.test(line) &&
      line.split(" ").length <= 10;
    if (isHeading && current && current.body.length > 200) {
      groups.push(current);
      current = { heading: line, body: "" };
    } else if (isHeading && !current) {
      current = { heading: line, body: "" };
    } else if (current) {
      current.body += " " + line;
    } else {
      current = { heading: "Overview", body: line };
    }
  }
  if (current && current.body.length > 50) groups.push(current);
  if (groups.length === 0) groups.push({ heading: "Overview", body: text });
  return groups.slice(0, 6);
}

// Extractive (offline) synthesizer. Phase 3 wraps this with an LLM-aware
// async entry point that falls back here when ANTHROPIC_API_KEY is absent.
export function synthesizeExtractive(args: {
  title: string;
  prompt: string;
  tone: "formal" | "conversational" | "punchy";
  sources: Source[];
  kind: "newsletter" | "report" | "deck";
}): Outline {
  const corpus = args.sources.map((s) => `${s.title}\n${s.content}`).join("\n\n");
  const promptText = args.prompt;
  const allText = `${promptText}\n\n${corpus}`;
  const kw = topKeywords(allText, 16);

  // Executive summary: top sentences across all sources
  const exec = pickSentences(corpus || promptText, 4, kw).join(" ");

  // Section breakdown
  const chunks =
    corpus.length > 200 ? chunkByHeadings(corpus) : [{ heading: "Context", body: promptText }];

  const sections: Section[] = chunks.map((c) => {
    const localKw = topKeywords(c.body, 8);
    const sents = pickSentences(c.body, 4, localKw);
    const bullets = sents.slice(0, 4).map((s) => s.replace(/\s+/g, " ").trim());
    const paragraph = sents.slice(0, 3).join(" ");
    return { heading: c.heading.replace(/^#+\s*/, ""), bullets, paragraph };
  });

  // Sub-headers based on the user prompt — surface what the user actually asked
  const promptBullets = sentences(promptText)
    .slice(0, 3)
    .map((s) => s.replace(/^[-•]\s*/, ""));
  if (promptBullets.length) {
    sections.unshift({
      heading: "Brief",
      bullets: promptBullets,
      paragraph: promptBullets.join(" "),
    });
  }

  const metrics = extractMetrics(corpus);
  if (metrics.length === 0) {
    metrics.push(
      { label: "Sources analyzed", value: String(args.sources.length) },
      { label: "Sections", value: String(sections.length) },
      { label: "Tone", value: args.tone[0].toUpperCase() + args.tone.slice(1) }
    );
  }

  const callouts = pickSentences(corpus || promptText, 3, kw).map((s) =>
    s.length > 220 ? s.slice(0, 217) + "…" : s
  );

  const subtitleByTone: Record<string, string> = {
    formal: "Synthesis · " + new Date().toDateString(),
    conversational: "What you need to know · " + new Date().toDateString(),
    punchy: "Highlights · " + new Date().toDateString(),
  };

  return {
    title: args.title,
    subtitle: subtitleByTone[args.tone],
    executiveSummary:
      exec ||
      `This briefing addresses: ${args.prompt.slice(0, 240)}. Sources reviewed: ${args.sources.length}.`,
    sections: sections.slice(0, 6),
    metrics,
    callouts: callouts.slice(0, 3),
  };
}

// Async entrypoint. Routes to the LLM when any provider key is configured;
// falls back to the offline extractive path otherwise (or on LLM error).
export async function synthesize(args: {
  title: string;
  prompt: string;
  tone: "formal" | "conversational" | "punchy";
  sources: Source[];
  kind: "newsletter" | "report" | "deck";
}): Promise<Outline> {
  const llmConfigured =
    !!process.env.ANTHROPIC_API_KEY ||
    !!process.env.OPENAI_API_KEY ||
    !!process.env.GEMINI_API_KEY ||
    !!process.env.GOOGLE_API_KEY ||
    !!process.env.LLM_API_KEY;
  if (llmConfigured) {
    try {
      const { synthesizeWithLLM } = await import("./llm.js");
      return await synthesizeWithLLM(args);
    } catch (e) {
      console.error("[synthesizer] LLM path failed, falling back to extractive:", e);
    }
  }
  return synthesizeExtractive(args);
}
