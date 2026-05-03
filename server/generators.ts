// Document generators: PDF report, PPTX deck, HTML newsletter.
import PDFDocument from "pdfkit";
import pptxgen from "pptxgenjs";
// pptxgenjs ships both as default and as the module export; resolve safely.
const PptxGenJS: any = (pptxgen as any).default ?? pptxgen;
import fs from "node:fs";
import path from "node:path";
import type { Outline } from "./synthesizer";

// Honor DATA_DIR so generated artifacts land on the persistent volume in prod.
const OUTPUT_DIR = path.resolve(process.env.DATA_DIR || ".", "generated");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function safeFilename(s: string) {
  return s.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
}

// ---------- PDF REPORT ----------
export async function generatePdfReport(args: {
  outline: Outline;
  brandColor: string;
  workspaceName: string;
  assetId: number;
}): Promise<string> {
  const { outline, brandColor, workspaceName, assetId } = args;
  const fileName = `${assetId}_${safeFilename(outline.title)}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: { Title: outline.title, Author: workspaceName },
      bufferPages: true,
    });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const accent = brandColor || "#0f766e";
    const ink = "#0a0a0a";
    const muted = "#525b67";
    const rule = "#e5e7eb";

    // -------- Cover --------
    doc.rect(0, 0, doc.page.width, 8).fill(accent);
    doc.fillColor(muted).fontSize(10).text(workspaceName.toUpperCase(), 56, 60, {
      characterSpacing: 1.5,
    });
    doc.moveDown(2);
    doc
      .fillColor(ink)
      .fontSize(34)
      .font("Helvetica-Bold")
      .text(outline.title, 56, 130, { width: 480 });
    doc
      .moveDown(0.6)
      .fontSize(13)
      .fillColor(muted)
      .font("Helvetica")
      .text(outline.subtitle, { width: 480 });

    // metric strip
    const metricY = 260;
    const metricW = (doc.page.width - 112) / Math.max(1, outline.metrics.length);
    outline.metrics.forEach((m, i) => {
      const x = 56 + i * metricW;
      doc.rect(x, metricY, metricW - 8, 78).fill("#f7f8fa");
      doc.fillColor(muted).fontSize(9).font("Helvetica").text(m.label.toUpperCase(), x + 14, metricY + 14, {
        characterSpacing: 1,
        width: metricW - 36,
      });
      doc
        .fillColor(ink)
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(m.value, x + 14, metricY + 32, { width: metricW - 36 });
    });

    // exec summary block
    doc
      .fillColor(accent)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("EXECUTIVE SUMMARY", 56, metricY + 110, { characterSpacing: 1.5 });
    doc.moveTo(56, metricY + 124).lineTo(doc.page.width - 56, metricY + 124).strokeColor(rule).stroke();
    doc
      .moveDown(0.6)
      .fillColor(ink)
      .fontSize(11)
      .font("Helvetica")
      .text(outline.executiveSummary, 56, metricY + 134, {
        width: doc.page.width - 112,
        align: "left",
        lineGap: 3,
      });

    // -------- Body sections --------
    outline.sections.forEach((s) => {
      doc.addPage();
      // section number bar
      doc.rect(56, 56, 4, 28).fill(accent);
      doc
        .fillColor(ink)
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(s.heading, 72, 58, { width: doc.page.width - 128 });

      let y = 110;
      doc.fillColor(ink).fontSize(11).font("Helvetica").text(s.paragraph, 56, y, {
        width: doc.page.width - 112,
        lineGap: 3,
      });
      y = doc.y + 16;

      if (s.bullets.length) {
        doc
          .fillColor(muted)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("KEY POINTS", 56, y, { characterSpacing: 1.5 });
        y = doc.y + 8;
        s.bullets.forEach((b) => {
          doc.circle(60, y + 7, 2.2).fill(accent);
          doc
            .fillColor(ink)
            .font("Helvetica")
            .fontSize(11)
            .text(b, 72, y, { width: doc.page.width - 128, lineGap: 2 });
          y = doc.y + 8;
        });
      }
    });

    // Callouts page
    if (outline.callouts.length) {
      doc.addPage();
      doc
        .fillColor(ink)
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("Notable callouts", 56, 60);
      let y = 110;
      outline.callouts.forEach((c) => {
        doc.rect(56, y, doc.page.width - 112, 1).fill(rule);
        y += 14;
        doc.rect(56, y, 3, 50).fill(accent);
        doc
          .fillColor(ink)
          .font("Helvetica-Oblique")
          .fontSize(13)
          .text(c, 72, y + 4, { width: doc.page.width - 128, lineGap: 2 });
        y = doc.y + 24;
      });
    }

    // Footer on every page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fillColor(muted)
        .fontSize(8)
        .font("Helvetica")
        .text(
          `${workspaceName}  ·  ${outline.title}  ·  Page ${i - range.start + 1} of ${range.count}`,
          56,
          doc.page.height - 36,
          { align: "left", width: doc.page.width - 112 }
        );
    }

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

// ---------- PPTX DECK ----------
export async function generatePptxDeck(args: {
  outline: Outline;
  brandColor: string;
  workspaceName: string;
  assetId: number;
}): Promise<string> {
  const { outline, brandColor, workspaceName, assetId } = args;
  const fileName = `${assetId}_${safeFilename(outline.title)}.pptx`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5"
  pptx.title = outline.title;
  pptx.company = workspaceName;

  const accent = (brandColor || "#0f766e").replace("#", "");
  const ink = "0A0A0A";
  const muted = "525B67";
  const rule = "E5E7EB";

  // Title slide
  const s1 = pptx.addSlide();
  s1.background = { color: "FFFFFF" };
  s1.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.18, fill: { color: accent } });
  s1.addText(workspaceName.toUpperCase(), {
    x: 0.6,
    y: 0.5,
    w: 12,
    h: 0.4,
    fontFace: "Helvetica",
    fontSize: 11,
    color: muted,
    charSpacing: 3,
  });
  s1.addText(outline.title, {
    x: 0.6,
    y: 2.0,
    w: 11.5,
    h: 2.4,
    fontFace: "Helvetica",
    fontSize: 44,
    bold: true,
    color: ink,
  });
  s1.addText(outline.subtitle, {
    x: 0.6,
    y: 4.6,
    w: 11.5,
    h: 0.6,
    fontFace: "Helvetica",
    fontSize: 18,
    color: muted,
  });
  s1.addShape("rect", { x: 0.6, y: 5.6, w: 1.2, h: 0.06, fill: { color: accent } });

  // Executive summary slide
  const s2 = pptx.addSlide();
  s2.addText("Executive summary", {
    x: 0.6,
    y: 0.5,
    w: 12,
    h: 0.6,
    fontFace: "Helvetica",
    fontSize: 28,
    bold: true,
    color: ink,
  });
  s2.addShape("rect", { x: 0.6, y: 1.2, w: 0.6, h: 0.05, fill: { color: accent } });
  s2.addText(outline.executiveSummary, {
    x: 0.6,
    y: 1.5,
    w: 12,
    h: 2.5,
    fontFace: "Helvetica",
    fontSize: 16,
    color: ink,
    lineSpacingMultiple: 1.3,
  });
  // metrics row
  const mY = 5.0;
  const mW = 12 / Math.max(1, outline.metrics.length);
  outline.metrics.forEach((m, i) => {
    const x = 0.6 + i * mW;
    s2.addShape("rect", { x, y: mY, w: mW - 0.2, h: 1.6, fill: { color: "F7F8FA" }, line: { color: rule, width: 0.5 } });
    s2.addText(m.label.toUpperCase(), {
      x: x + 0.2,
      y: mY + 0.15,
      w: mW - 0.4,
      h: 0.3,
      fontSize: 10,
      color: muted,
      charSpacing: 2,
    });
    s2.addText(m.value, {
      x: x + 0.2,
      y: mY + 0.55,
      w: mW - 0.4,
      h: 0.9,
      fontSize: 26,
      bold: true,
      color: ink,
    });
  });

  // Section slides
  outline.sections.forEach((sec, idx) => {
    const sl = pptx.addSlide();
    sl.addText(`SECTION ${String(idx + 1).padStart(2, "0")}`, {
      x: 0.6,
      y: 0.4,
      w: 4,
      h: 0.3,
      fontSize: 10,
      color: muted,
      charSpacing: 3,
    });
    sl.addText(sec.heading, {
      x: 0.6,
      y: 0.75,
      w: 12,
      h: 0.8,
      fontSize: 30,
      bold: true,
      color: ink,
    });
    sl.addShape("rect", { x: 0.6, y: 1.55, w: 0.6, h: 0.05, fill: { color: accent } });
    if (sec.paragraph) {
      sl.addText(sec.paragraph, {
        x: 0.6,
        y: 1.85,
        w: 7.2,
        h: 4.5,
        fontSize: 14,
        color: ink,
        lineSpacingMultiple: 1.3,
      });
    }
    if (sec.bullets.length) {
      sl.addText(
        sec.bullets.map((b) => ({ text: b, options: { bullet: { code: "25CF" } } })),
        {
          x: 8.1,
          y: 1.85,
          w: 4.6,
          h: 4.5,
          fontSize: 13,
          color: ink,
          paraSpaceAfter: 8,
        }
      );
    }
  });

  // Closing
  const sc = pptx.addSlide();
  sc.background = { color: ink };
  sc.addText("Thank you", {
    x: 0.6,
    y: 3.0,
    w: 12,
    h: 1.2,
    fontSize: 48,
    bold: true,
    color: "FFFFFF",
    fontFace: "Helvetica",
  });
  sc.addText(workspaceName, {
    x: 0.6,
    y: 4.4,
    w: 12,
    h: 0.5,
    fontSize: 14,
    color: "BFC4CC",
  });
  sc.addShape("rect", { x: 0.6, y: 5.0, w: 1.2, h: 0.06, fill: { color: accent } });

  await pptx.writeFile({ fileName: filePath });
  return filePath;
}

// ---------- HTML NEWSLETTER ----------
export function generateNewsletterHtml(args: {
  outline: Outline;
  brandColor: string;
  workspaceName: string;
}): string {
  const { outline, brandColor, workspaceName } = args;
  const accent = brandColor || "#0f766e";
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sectionsHtml = outline.sections
    .map(
      (s) => `
      <tr><td style="padding:28px 32px 8px 32px;">
        <div style="font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:1.5px;color:${accent};text-transform:uppercase;margin-bottom:8px;">Section</div>
        <h2 style="font:700 22px/1.25 Helvetica,Arial,sans-serif;margin:0 0 12px 0;color:#0a0a0a;">${safe(s.heading)}</h2>
        <p style="font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#27313e;margin:0 0 12px 0;">${safe(s.paragraph)}</p>
        <ul style="margin:0;padding-left:18px;color:#27313e;font:400 14px/1.55 Helvetica,Arial,sans-serif;">
          ${s.bullets.map((b) => `<li style="margin:6px 0;">${safe(b)}</li>`).join("")}
        </ul>
      </td></tr>
      <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #ececec;margin:24px 0 0 0;"></td></tr>
    `
    )
    .join("");

  const metricsHtml = outline.metrics
    .map(
      (m) => `
      <td style="padding:0 6px;width:25%;vertical-align:top;">
        <div style="background:#f7f8fa;border-radius:8px;padding:14px;">
          <div style="font:600 9px/1 Helvetica,Arial,sans-serif;letter-spacing:1.5px;color:#525b67;text-transform:uppercase;margin-bottom:6px;">${safe(m.label)}</div>
          <div style="font:700 20px/1.1 Helvetica,Arial,sans-serif;color:#0a0a0a;">${safe(m.value)}</div>
        </div>
      </td>`
    )
    .join("");

  const calloutsHtml = outline.callouts
    .map(
      (c) => `
      <tr><td style="padding:8px 32px;">
        <div style="border-left:3px solid ${accent};padding:6px 0 6px 14px;font:italic 400 15px/1.5 Georgia,serif;color:#0a0a0a;">${safe(c)}</div>
      </td></tr>`
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${safe(outline.title)}</title></head>
  <body style="margin:0;padding:24px;background:#f4f4f6;font-family:Helvetica,Arial,sans-serif;color:#0a0a0a;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" width="640" style="background:#ffffff;border-radius:14px;overflow:hidden;">
      <tr><td style="height:6px;background:${accent};"></td></tr>
      <tr><td style="padding:28px 32px 0 32px;">
        <div style="font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:2px;color:#525b67;text-transform:uppercase;">${safe(workspaceName)}</div>
        <h1 style="font:800 30px/1.15 Helvetica,Arial,sans-serif;margin:8px 0 6px 0;color:#0a0a0a;">${safe(outline.title)}</h1>
        <div style="font:400 14px/1.4 Helvetica,Arial,sans-serif;color:#525b67;">${safe(outline.subtitle)}</div>
      </td></tr>
      <tr><td style="padding:24px 32px 0 32px;">
        <p style="font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#27313e;margin:0;">${safe(outline.executiveSummary)}</p>
      </td></tr>
      <tr><td style="padding:24px 26px 8px 26px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>${metricsHtml}</tr></table>
      </td></tr>
      <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #ececec;margin:16px 0 0 0;"></td></tr>
      ${sectionsHtml}
      ${calloutsHtml}
      <tr><td style="padding:24px 32px 28px 32px;text-align:center;color:#525b67;font:400 12px/1.4 Helvetica,Arial,sans-serif;">
        Generated by ReportForge for ${safe(workspaceName)}.
      </td></tr>
    </table>
  </body></html>`;
}
