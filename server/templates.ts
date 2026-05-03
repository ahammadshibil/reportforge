// Template extraction + rendering + auto-fill from sources.
// Generalizes the invoice-template flow: upload an image of any branded
// document → LLM vision returns a structured schema → user fills (or
// fills from sources via LLM) → render branded HTML/PDF that matches.

import { callVisionJson, type VisionImage } from "./llm";
import type { Source } from "@shared/schema";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "currency"
  | "email"
  | "textarea";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  group?: string;
  placeholder?: string;
};

export type LineItemColumn = { key: string; label: string; type: FieldType };

export type TemplateSchema = {
  name: string;
  kind: "invoice" | "report" | "newsletter" | "other";
  brand: { primaryColor?: string; accentColor?: string; logoPosition?: "left" | "right" | "center" };
  fields: Field[];
  lineItemColumns?: LineItemColumn[];
  layoutHints: string[];
};

const EXTRACTION_PROMPT = `You are analyzing a sample document image (invoice, report, newsletter, certificate, or other branded form). Extract its structure as JSON so we can build a fillable form that produces output matching this template.

Return ONLY valid JSON matching this schema — no prose, no markdown fences:
{
  "name": "short name for this template (e.g. 'Acme Invoice', 'Q1 Sales Report')",
  "kind": "invoice | report | newsletter | other",
  "brand": { "primaryColor": "#hex or null", "accentColor": "#hex or null", "logoPosition": "left|right|center" },
  "fields": [
    {
      "key": "snake_case",
      "label": "Human Label",
      "type": "text|number|date|currency|email|textarea",
      "required": true|false,
      "group": "Header|From|Bill To|Items|Totals|Body|Footer|Metadata",
      "placeholder": "example value if visible in the source"
    }
  ],
  "lineItemColumns": [
    { "key": "description", "label": "Description", "type": "text" }
  ],
  "layoutHints": ["one-line observations about layout, typography, distinguishing visual choices"]
}

Rules:
- Include EVERY visible field (numbers, dates, addresses, IDs, terms, notes, copy blocks).
- Group logically. Common groups: Header, From, Bill To, Ship To, Items, Totals, Body, Footer, Metadata.
- snake_case keys, specific names ("invoice_number" not "number", "issue_date" not "date").
- If you see a repeating row table (line items, transactions, sections), populate lineItemColumns. Otherwise omit it.
- brand.primaryColor: the dominant brand accent. brand.accentColor: secondary text/border color.
- Output ONLY the JSON object.`;

export async function extractTemplate(images: VisionImage[]): Promise<TemplateSchema> {
  const raw = await callVisionJson({
    prompt:
      EXTRACTION_PROMPT +
      (images.length > 1
        ? `\n\nNote: ${images.length} pages provided. Merge fields across pages into one schema.`
        : ""),
    images,
  });
  const parsed = parseExtractionJson(raw);
  return parsed;
}

function parseExtractionJson(raw: string): TemplateSchema {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n?/, "").replace(/```\s*$/, "").trim();
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first > 0) text = text.slice(first, last + 1);
  const j = JSON.parse(text) as Partial<TemplateSchema>;
  return {
    name: String(j.name || "Untitled template"),
    kind:
      (["invoice", "report", "newsletter", "other"].includes(j.kind as string)
        ? j.kind
        : "other") as TemplateSchema["kind"],
    brand: {
      primaryColor: j.brand?.primaryColor || undefined,
      accentColor: j.brand?.accentColor || undefined,
      logoPosition: j.brand?.logoPosition || "left",
    },
    fields: Array.isArray(j.fields)
      ? j.fields.map((f: any) => ({
          key: String(f?.key || "").replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
          label: String(f?.label || f?.key || ""),
          type: (["text", "number", "date", "currency", "email", "textarea"].includes(f?.type)
            ? f.type
            : "text") as FieldType,
          required: !!f?.required,
          group: f?.group ? String(f.group) : undefined,
          placeholder: f?.placeholder ? String(f.placeholder) : undefined,
        }))
      : [],
    lineItemColumns: Array.isArray(j.lineItemColumns)
      ? j.lineItemColumns.map((c: any) => ({
          key: String(c?.key || "").toLowerCase(),
          label: String(c?.label || c?.key || ""),
          type: (["text", "number", "date", "currency", "email", "textarea"].includes(c?.type)
            ? c.type
            : "text") as FieldType,
        }))
      : undefined,
    layoutHints: Array.isArray(j.layoutHints) ? j.layoutHints.map(String) : [],
  };
}

// ----- Fill from sources -----
//
// The killer combo: feed the schema + the workspace's sources to the LLM,
// get back a JSON object that the form can hydrate from. The LLM never
// sees the rendered document — it only sees the field schema, so there's
// no opportunity for it to invent layout or styling. Outputs are the
// strict shape `{ values, lineItems }` so the existing render path and
// any user tweaks just keep working.

const FILL_PROMPT_HEADER = `You are filling a structured document template from source material. You will be given:
1. A field schema (a list of fields with keys, labels, types).
2. Optionally: line-item table columns.
3. One or more source documents (text).
4. Optionally: a user brief steering tone or focus.

Return ONLY valid JSON with this exact shape — no prose, no markdown fences:
{
  "values": { "<field_key>": "<string value>", ... },
  "lineItems": [ { "<col_key>": "<string value>", ... }, ... ]
}

Rules:
- Use only information from the sources / brief. Do not invent figures, names, or dates.
- Omit fields you cannot fill confidently (do not write "N/A" or "TBD").
- Match the field type: dates as YYYY-MM-DD, currency as plain numbers ("12500" not "$12,500.00").
- For line items: produce one row per discrete entry inferable from sources. If no clear list exists, return [].
- Keep values terse — they will be rendered verbatim into a branded form.`;

function buildSchemaSummary(schema: TemplateSchema): string {
  const fieldsText = schema.fields
    .map(
      (f) =>
        `- ${f.key} (${f.type}${f.required ? ", required" : ""}${
          f.group ? `, group: ${f.group}` : ""
        }) — ${f.label}${f.placeholder ? ` [example: ${f.placeholder}]` : ""}`
    )
    .join("\n");
  const cols = schema.lineItemColumns || [];
  const colsText = cols.length
    ? "\n\nLine-item columns:\n" +
      cols.map((c) => `- ${c.key} (${c.type}) — ${c.label}`).join("\n")
    : "";
  return `Template: ${schema.name} (kind: ${schema.kind})\n\nFields:\n${fieldsText}${colsText}`;
}

function buildSourcesBlock(sources: Source[]): string {
  if (sources.length === 0) return "(no sources provided — fill from brief alone)";
  return sources
    .map(
      (s, i) =>
        `--- SOURCE ${i + 1}: ${s.title} (type: ${s.type}) ---\n${s.content.slice(0, 10_000)}`
    )
    .join("\n\n");
}

export type FillResult = {
  values: Record<string, string>;
  lineItems: Array<Record<string, string>>;
};

export async function fillFromSources(args: {
  schema: TemplateSchema;
  sources: Source[];
  brief?: string;
}): Promise<FillResult> {
  const raw = await callJsonText({
    system: FILL_PROMPT_HEADER,
    user: `${buildSchemaSummary(args.schema)}\n\nUser brief:\n${
      args.brief?.trim() || "(none — infer best fit from sources)"
    }\n\nSources:\n${buildSourcesBlock(args.sources)}`,
  });
  return parseFillJson(raw, args.schema);
}

async function callJsonText(args: { system: string; user: string }): Promise<string> {
  const { callTextJson } = await import("./llm");
  return callTextJson(args.system, args.user);
}

function parseFillJson(raw: string, schema: TemplateSchema): FillResult {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n?/, "").replace(/```\s*$/, "").trim();
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first > 0) text = text.slice(first, last + 1);
  let parsed: any = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { values: {}, lineItems: [] };
  }
  const validKeys = new Set(schema.fields.map((f) => f.key));
  const colKeys = new Set((schema.lineItemColumns || []).map((c) => c.key));

  const values: Record<string, string> = {};
  if (parsed.values && typeof parsed.values === "object") {
    for (const [k, v] of Object.entries(parsed.values)) {
      if (!validKeys.has(k)) continue;
      if (v == null) continue;
      values[k] = String(v);
    }
  }

  const lineItems: Array<Record<string, string>> = [];
  if (Array.isArray(parsed.lineItems)) {
    for (const row of parsed.lineItems) {
      if (!row || typeof row !== "object") continue;
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!colKeys.has(k)) continue;
        if (v == null) continue;
        cleaned[k] = String(v);
      }
      if (Object.keys(cleaned).length) lineItems.push(cleaned);
    }
  }
  return { values, lineItems };
}

// ----- Render -----

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]
  );

export function renderTemplateHtml(
  schema: TemplateSchema,
  values: Record<string, any>,
  lineItems: Array<Record<string, any>> = []
): string {
  const primary = schema.brand?.primaryColor || "#0f172a";
  const accent = schema.brand?.accentColor || "#64748b";

  const groups: Record<string, Field[]> = {};
  for (const f of schema.fields) {
    const g = f.group || "Details";
    (groups[g] ||= []).push(f);
  }

  const renderField = (f: Field) => {
    const v = values[f.key];
    if (v === undefined || v === null || v === "") return "";
    if (f.type === "textarea") {
      return `<div class="block"><div class="lbl">${esc(f.label)}</div><div class="val">${esc(v)}</div></div>`;
    }
    return `<div class="row"><span class="lbl">${esc(f.label)}</span><span class="val">${esc(v)}</span></div>`;
  };

  const renderGroup = (name: string, fields: Field[]) => `
    <section class="group">
      <h3>${esc(name)}</h3>
      ${fields.map(renderField).join("")}
    </section>`;

  const cols = schema.lineItemColumns || [];
  const itemsTable = cols.length
    ? `
    <table class="items">
      <thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
      <tbody>
        ${lineItems
          .map(
            (it) =>
              `<tr>${cols
                .map((c) => `<td>${esc(it[c.key])}</td>`)
                .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>`
    : "";

  // Headline value: prefer common "id-ish" fields if present.
  const headlineKey =
    ["invoice_number", "report_number", "title", "headline"].find((k) => values[k]) || null;
  const dateKey = ["issue_date", "date", "report_date"].find((k) => values[k]) || null;
  const dueKey = ["due_date"].find((k) => values[k]) || null;

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <title>${esc(schema.name)}${headlineKey ? " — " + esc(values[headlineKey]) : ""}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font: 12px/1.55 -apple-system, system-ui, Helvetica, Arial, sans-serif; color: #111; }
    h1 { color: ${primary}; margin: 0 0 4px; font-size: 28px; letter-spacing: -0.5px; }
    h3 { color: ${primary}; margin: 18px 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid ${accent}33; padding-bottom: 4px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .row { display:flex; justify-content:space-between; padding: 3px 0; gap: 12px; }
    .block { padding: 4px 0; }
    .lbl { color: ${accent}; }
    .val { font-weight: 500; white-space: pre-line; }
    .items { width:100%; border-collapse: collapse; margin-top: 16px; }
    .items th { background: ${primary}; color: white; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .items td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 2px solid ${primary}; color: ${accent}; font-size: 11px; }
    @media print { .noprint { display:none; } }
    .noprint { position:fixed; top:12px; right:12px; }
    .btn { background:${primary}; color:white; padding:8px 16px; border:0; border-radius:6px; cursor:pointer; font:inherit; }
  </style></head><body>
    <div class="noprint"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>
    <div class="header">
      <div>
        <h1>${esc(schema.name)}</h1>
        ${headlineKey ? `<div style="color:${accent}">#${esc(values[headlineKey])}</div>` : ""}
      </div>
      <div style="text-align:right">
        ${dateKey ? `<div><strong>Date:</strong> ${esc(values[dateKey])}</div>` : ""}
        ${dueKey ? `<div><strong>Due:</strong> ${esc(values[dueKey])}</div>` : ""}
      </div>
    </div>
    <div class="grid">${Object.entries(groups)
      .map(([n, fs]) => renderGroup(n, fs))
      .join("")}</div>
    ${itemsTable}
    ${values.notes ? `<div class="footer"><strong>Notes:</strong> ${esc(values.notes)}</div>` : ""}
  </body></html>`;
}
