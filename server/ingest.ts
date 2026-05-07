// Source ingestion helpers. Convert raw uploads (PDF, CSV, plain text) and
// fetched URLs into the plain-text form sources expect.

const MAX_TEXT_BYTES = 1_500_000; // ~1.5MB of text — generous, but caps malformed inputs

export type IngestResult = {
  title: string;
  type: "pdf" | "csv" | "url" | "note";
  content: string;
  meta?: Record<string, unknown>;
};

function trimToBudget(s: string): string {
  if (s.length <= MAX_TEXT_BYTES) return s;
  return s.slice(0, MAX_TEXT_BYTES) + "\n[…truncated]";
}

// PDF — uses pdf-parse if installed, otherwise reports a clear error.
async function parsePdf(buf: Buffer): Promise<string> {
  // @ts-ignore — optional dep; will be installed via package.json
  const mod: any = await import("pdf-parse").catch(() => null);
  if (!mod) throw new Error("pdf-parse not installed; run npm install");
  const fn = mod.default ?? mod;
  const out = await fn(buf);
  return (out?.text ?? "").trim();
}

// CSV — minimal parser that handles quoted fields. Renders as
// "Header1: value1\nHeader2: value2\n\n" per row so the LLM can read
// records as natural text.
function parseCsv(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const rows = parseCsvRows(text);
  if (rows.length < 2) return text;
  const headers = rows[0];
  const out: string[] = [];
  for (let r = 1; r < rows.length; r++) {
    const lines: string[] = [];
    for (let c = 0; c < headers.length; c++) {
      const v = rows[r][c];
      if (v == null || v === "") continue;
      lines.push(`${headers[c]}: ${v}`);
    }
    if (lines.length) out.push(lines.join("\n"));
  }
  return out.join("\n\n");
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\n") {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

// HTML — strip to readable plain text. Same logic as the URL connector.
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h\d|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function extractTitle(html: string): string | null {
  const ogt = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (ogt) return ogt[1];
  const t = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return t ? t[1].trim() : null;
}

// ---- Public ingestors ----

export async function ingestUpload(args: {
  filename: string;
  contentBase64: string;
  mimeType: string;
}): Promise<IngestResult> {
  const buf = Buffer.from(args.contentBase64, "base64");
  const lower = args.filename.toLowerCase();
  const isPdf = args.mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isCsv =
    args.mimeType === "text/csv" ||
    args.mimeType === "application/csv" ||
    lower.endsWith(".csv");

  if (isPdf) {
    const text = await parsePdf(buf);
    return {
      title: args.filename,
      type: "pdf",
      content: trimToBudget(text || `[empty PDF: ${args.filename}]`),
      meta: { mimeType: args.mimeType, byteSize: buf.length },
    };
  }
  if (isCsv) {
    const rendered = parseCsv(buf.toString("utf-8"));
    return {
      title: args.filename,
      type: "csv",
      content: trimToBudget(rendered),
      meta: { mimeType: args.mimeType, byteSize: buf.length },
    };
  }
  // text-ish fallback
  return {
    title: args.filename,
    type: "note",
    content: trimToBudget(buf.toString("utf-8")),
    meta: { mimeType: args.mimeType, byteSize: buf.length },
  };
}

export async function ingestUrl(url: string): Promise<IngestResult> {
  if (!/^https?:\/\//i.test(url)) throw new Error("URL must start with http(s)");
  const res = await fetch(url, {
    headers: {
      "User-Agent": "BYOR/1.0 (+https://github.com/ahammadshibil/reportforge)",
      Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const ctype = (res.headers.get("content-type") || "").toLowerCase();

  if (ctype.includes("application/pdf")) {
    const buf = Buffer.from(await res.arrayBuffer());
    const text = await parsePdf(buf);
    return {
      title: url.split("/").pop() || url,
      type: "url",
      content: trimToBudget(text),
      meta: { url, mimeType: "application/pdf", byteSize: buf.length },
    };
  }

  if (ctype.includes("text/csv") || ctype.includes("application/csv")) {
    const raw = await res.text();
    return {
      title: url,
      type: "url",
      content: trimToBudget(parseCsv(raw)),
      meta: { url, mimeType: "text/csv" },
    };
  }

  // Default: HTML / text
  const html = await res.text();
  const title = extractTitle(html) ?? url;
  return {
    title,
    type: "url",
    content: trimToBudget(stripHtml(html)),
    meta: { url, fetchedAt: Date.now() },
  };
}
