// Template extraction + rendering.
// Generalizes the invoice-template flow: upload an image of any branded
// document → LLM vision returns a structured schema → user fills form →
// render branded HTML/PDF that matches the original.

import { callVisionJson, type VisionImage } from "./llm";

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
