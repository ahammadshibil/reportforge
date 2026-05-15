// LLM-backed synthesis. Provider-agnostic: works with Anthropic, OpenAI,
// Google Gemini, or any OpenAI-compatible endpoint (Groq, OpenRouter,
// Together, local llama.cpp, etc).
//
// Selection (in priority order):
//   1. LLM_PROVIDER explicitly set     ("anthropic" | "openai" | "gemini")
//   2. ANTHROPIC_API_KEY               → anthropic
//   3. OPENAI_API_KEY                  → openai
//   4. GEMINI_API_KEY / GOOGLE_API_KEY → gemini
//   5. LLM_API_KEY + LLM_BASE_URL      → openai-compatible
//
// Common knobs:
//   LLM_MODEL    — overrides the per-provider default
//   LLM_BASE_URL — required for openai-compatible; optional override otherwise

import type { Source } from "@shared/schema";
import type { Outline } from "./synthesizer";

type Args = {
  title: string;
  prompt: string;
  tone: "formal" | "conversational" | "punchy";
  sources: Source[];
  kind: "newsletter" | "report" | "deck";
};

type Provider = "anthropic" | "openai" | "gemini";
type Selection = { provider: Provider; apiKey: string; model: string; baseUrl?: string };

// `prefix` is "" for the main text LLM and "VISION_" for vision calls.
// This lets a deploy use a cheap text-only provider (Perplexity, Groq, etc.)
// for synthesis + a separate vision-capable key for template extraction.
function pickProviderWithPrefix(prefix: ""): Selection;
function pickProviderWithPrefix(prefix: "VISION_"): Selection | null;
function pickProviderWithPrefix(prefix: "" | "VISION_"): Selection | null {
  const envProvider = (process.env[`${prefix}LLM_PROVIDER`] || "").trim().toLowerCase();
  const explicitKey = (process.env[`${prefix}LLM_API_KEY`] || "").trim();
  const explicitModel = (process.env[`${prefix}LLM_MODEL`] || "").trim();
  const explicitBaseUrl = (process.env[`${prefix}LLM_BASE_URL`] || "").trim() || undefined;

  // For VISION_* with no overrides at all, return null so caller can fall
  // through to the main provider (don't accidentally use a text-only key).
  if (prefix === "VISION_" && !envProvider && !explicitKey) return null;

  const m = (def: string) => explicitModel || def;

  if (envProvider === "anthropic" || (!envProvider && process.env.ANTHROPIC_API_KEY)) {
    return {
      provider: "anthropic",
      apiKey: explicitKey || process.env.ANTHROPIC_API_KEY || "",
      model: m(process.env.ANTHROPIC_MODEL || "claude-opus-4-7"),
      baseUrl: explicitBaseUrl,
    };
  }
  if (
    envProvider === "gemini" ||
    (!envProvider && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY))
  ) {
    return {
      provider: "gemini",
      apiKey: explicitKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
      model: m("gemini-2.0-flash"),
      baseUrl: explicitBaseUrl,
    };
  }
  // default: openai or any OpenAI-compatible (Perplexity, Groq, OpenRouter, …)
  return {
    provider: "openai",
    apiKey: explicitKey || process.env.OPENAI_API_KEY || "",
    model: m("gpt-4o-mini"),
    baseUrl: explicitBaseUrl,
  };
}

function pickProvider(): Selection {
  return pickProviderWithPrefix("");
}

// Vision-only selector. Falls back to the main text provider if no
// VISION_* envs are set — that's fine for Anthropic/OpenAI/Gemini, but
// will fail at request time on text-only providers (Perplexity, Groq).
function pickProviderForVision(): Selection {
  return pickProviderWithPrefix("VISION_") ?? pickProvider();
}

// ---- Outline schema (must mirror synthesizer.Outline) ----
const OUTLINE_SCHEMA = `{
  "title": "string",
  "subtitle": "string (1 short sentence, dated if relevant)",
  "executiveSummary": "string (3–5 sentences)",
  "sections": [
    {
      "heading": "string",
      "paragraph": "string",
      "bullets": ["string", "..."],
      "sourceRefs": [1, 3]
    }
  ],
  "metrics": [
    { "label": "string", "value": "string", "delta": "string (optional)" }
  ],
  "callouts": ["string (1 quotable sentence)", "..."]
}`;

function buildSystemPrompt(brand: string) {
  return `You are a precise editor for ${brand}. Produce a JSON outline that follows the schema EXACTLY. Output ONLY the JSON object — no prose, no markdown fences. Use only information present in the provided sources; do not invent figures.

Schema:
${OUTLINE_SCHEMA}

Rules:
- 3 to 6 sections.
- Each section: 1-paragraph paragraph (40-90 words) + 3-5 bullets.
- metrics: surface real numbers from sources ($, %, counts) when present; otherwise return [].
- callouts: 1-3 short quotable sentences from sources.
- subtitle: include today's date in long form when relevant.
- CITATIONS: Each section MUST include "sourceRefs" — a list of 1-indexed source numbers (matching the SOURCE N labels in the user message) that the section's content draws from. Use the smallest set that justifies the claims; omit refs only if the section is brief framing copy with no factual claims. Do not invent refs — only use numbers that appear in the provided sources.`;
}

function buildUserPrompt(args: Args) {
  const sourcesBlock = args.sources
    .map(
      (s, i) =>
        `--- SOURCE ${i + 1}: ${s.title} (type: ${s.type}) ---\n${s.content.slice(0, 12_000)}`
    )
    .join("\n\n");
  return `Title: ${args.title}
Kind: ${args.kind}
Tone: ${args.tone}

Brief from user:
${args.prompt}

Sources:
${sourcesBlock || "(no sources provided — write from the brief alone)"}`;
}

// ---- Provider implementations ----

async function callAnthropic(
  apiKey: string,
  model: string,
  baseUrl: string | undefined,
  system: string,
  user: string
): Promise<string> {
  const url = (baseUrl || "https://api.anthropic.com") + "/v1/messages";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  return (j.content || []).map((c) => c.text || "").join("");
}

async function callOpenAI(
  apiKey: string,
  model: string,
  baseUrl: string | undefined,
  system: string,
  user: string
): Promise<string> {
  const url = (baseUrl || "https://api.openai.com/v1") + "/chat/completions";
  // response_format: {type:"json_object"} is OpenAI-specific. Perplexity
  // rejects it (only accepts text|json_schema|regex), Groq's older models
  // ignore it silently, OpenRouter passes it through to the underlying model
  // which may or may not support it. Safest: only send it when actually
  // hitting api.openai.com. For everything else, rely on the strict prompt
  // + the tolerant parser (parseOutline strips fences and finds the JSON).
  const isOpenAI = !baseUrl || /(^|\.)openai\.com\//.test(baseUrl);
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
  };
  if (isOpenAI) body.response_format = { type: "json_object" };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI(${url}) ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return j.choices[0]?.message?.content ?? "";
}

async function callGemini(
  apiKey: string,
  model: string,
  baseUrl: string | undefined,
  system: string,
  user: string
): Promise<string> {
  const root = baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  const url = `${root}/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}

// Robust JSON parsing — tolerate fenced output even though we asked for raw JSON.
function parseOutline(raw: string): Outline {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n?/, "").replace(/```\s*$/, "").trim();
  }
  // If model included extra prose, find first { ... } balanced block.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first > 0) text = text.slice(first, last + 1);
  const parsed = JSON.parse(text) as Partial<Outline>;
  return {
    title: String(parsed.title || ""),
    subtitle: String(parsed.subtitle || ""),
    executiveSummary: String(parsed.executiveSummary || ""),
    sections: Array.isArray(parsed.sections)
      ? parsed.sections.map((s: any) => ({
          heading: String(s?.heading || ""),
          paragraph: String(s?.paragraph || ""),
          bullets: Array.isArray(s?.bullets) ? s.bullets.map((b: any) => String(b)) : [],
          sourceRefs: Array.isArray(s?.sourceRefs)
            ? s.sourceRefs
                .map((n: any) => Number(n))
                .filter((n: number) => Number.isFinite(n) && n >= 1)
            : undefined,
        }))
      : [],
    metrics: Array.isArray(parsed.metrics)
      ? parsed.metrics.map((m: any) => ({
          label: String(m?.label || ""),
          value: String(m?.value || ""),
          delta: m?.delta ? String(m.delta) : undefined,
        }))
      : [],
    callouts: Array.isArray(parsed.callouts) ? parsed.callouts.map((c: any) => String(c)) : [],
  };
}

export async function synthesizeWithLLM(args: Args): Promise<Outline> {
  const sel = pickProvider();
  if (!sel.apiKey) throw new Error("no_llm_api_key");
  const brand = process.env.BRAND_NAME || "the editor";
  const system = buildSystemPrompt(brand);
  const user = buildUserPrompt(args);

  let raw = "";
  if (sel.provider === "anthropic") {
    raw = await callAnthropic(sel.apiKey, sel.model, sel.baseUrl, system, user);
  } else if (sel.provider === "gemini") {
    raw = await callGemini(sel.apiKey, sel.model, sel.baseUrl, system, user);
  } else {
    raw = await callOpenAI(sel.apiKey, sel.model, sel.baseUrl, system, user);
  }

  const outline = parseOutline(raw);
  // Fill in defaults the model may have skipped.
  if (!outline.title) outline.title = args.title;
  if (!outline.subtitle) {
    const tone = args.tone[0].toUpperCase() + args.tone.slice(1);
    outline.subtitle = `${tone} synthesis · ${new Date().toDateString()}`;
  }
  // Drop any sourceRefs the model invented that don't map to a real source.
  // Then attach the source map so generators can render footnotes.
  const validRefs = new Set(args.sources.map((_, i) => i + 1));
  for (const s of outline.sections) {
    if (s.sourceRefs) {
      s.sourceRefs = s.sourceRefs.filter((r) => validRefs.has(r));
      if (s.sourceRefs.length === 0) s.sourceRefs = undefined;
    }
  }
  outline.sources = args.sources.map((s, i) => ({
    ref: i + 1,
    id: s.id,
    title: s.title,
    type: s.type,
  }));

  if (outline.sections.length === 0) {
    outline.sections = [
      { heading: "Brief", paragraph: args.prompt, bullets: [] },
    ];
  }
  return outline;
}

// Generic text-only JSON call. Used by features that need structured
// output without going through the synthesis pipeline (e.g. template
// auto-fill from sources).
export async function callTextJson(system: string, user: string): Promise<string> {
  const sel = pickProvider();
  if (!sel.apiKey) throw new Error("no_llm_api_key");
  if (sel.provider === "anthropic") {
    return callAnthropic(sel.apiKey, sel.model, sel.baseUrl, system, user);
  }
  if (sel.provider === "gemini") {
    return callGemini(sel.apiKey, sel.model, sel.baseUrl, system, user);
  }
  return callOpenAI(sel.apiKey, sel.model, sel.baseUrl, system, user);
}

// Health check for /api/llm/status — surfaces both text + vision provider.
export function llmStatus() {
  const text = pickProvider();
  const vision = pickProviderForVision();
  const visionDistinct =
    !!process.env.VISION_LLM_API_KEY || !!process.env.VISION_LLM_PROVIDER;
  return {
    provider: text.provider,
    model: text.model,
    baseUrl: text.baseUrl ?? null,
    configured: !!text.apiKey,
    vision: {
      provider: vision.provider,
      model: vision.model,
      baseUrl: vision.baseUrl ?? null,
      distinctFromText: visionDistinct,
      configured: !!vision.apiKey,
    },
  };
}

// ----- Vision -----
//
// Provider-agnostic image-to-JSON. Used by the Templates feature to extract
// schemas from a sample document image. Vision-capable model is required —
// callers may pass `model` to override the default text model with a
// vision-capable one.

export type VisionImage = { base64: string; mimeType: string };

export async function callVisionJson(args: {
  prompt: string;
  images: VisionImage[];
  modelOverride?: string;
}): Promise<string> {
  const sel = pickProviderForVision();
  if (!sel.apiKey) throw new Error("no_llm_api_key");
  const model = args.modelOverride || sel.model;

  if (sel.provider === "anthropic") {
    return callAnthropicVision(sel.apiKey, model, sel.baseUrl, args.prompt, args.images);
  }
  if (sel.provider === "gemini") {
    return callGeminiVision(sel.apiKey, model, sel.baseUrl, args.prompt, args.images);
  }
  return callOpenAIVision(sel.apiKey, model, sel.baseUrl, args.prompt, args.images);
}

async function callAnthropicVision(
  apiKey: string,
  model: string,
  baseUrl: string | undefined,
  prompt: string,
  images: VisionImage[]
): Promise<string> {
  const url = (baseUrl || "https://api.anthropic.com") + "/v1/messages";
  const content: any[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mimeType, data: img.base64 },
  }));
  content.push({ type: "text", text: prompt });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic vision ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  return (j.content || []).map((c) => c.text || "").join("");
}

async function callOpenAIVision(
  apiKey: string,
  model: string,
  baseUrl: string | undefined,
  prompt: string,
  images: VisionImage[]
): Promise<string> {
  const url = (baseUrl || "https://api.openai.com/v1") + "/chat/completions";
  const content: any[] = images.map((img) => ({
    type: "image_url",
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
  }));
  content.push({ type: "text", text: prompt });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI vision ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return j.choices[0]?.message?.content ?? "";
}

async function callGeminiVision(
  apiKey: string,
  model: string,
  baseUrl: string | undefined,
  prompt: string,
  images: VisionImage[]
): Promise<string> {
  const root = baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  const url = `${root}/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const parts: any[] = images.map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 },
  }));
  parts.push({ text: prompt });
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini vision ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}
