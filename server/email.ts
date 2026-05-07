// Email delivery. Resend preferred (zero-dep, just fetch); nodemailer is the
// SMTP fallback when SMTP_HOST is set. Either is optional — schedules without
// a delivery target still produce assets, they just don't send.

import fs from "node:fs";
import path from "node:path";

export type Attachment = {
  filename: string;
  contentBase64: string; // base64 of file bytes
  contentType: string;
};

export type Mail = {
  to: string[];
  subject: string;
  html: string;
  attachments?: Attachment[];
};

export type DeliveryResult =
  | { ok: true; provider: "resend" | "smtp" }
  | { ok: false; reason: string };

function envOrNull(key: string): string | null {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : null;
}

function fromAddress(): string {
  const explicit = envOrNull("EMAIL_FROM");
  if (explicit) return explicit;
  const brand = envOrNull("BRAND_NAME") || "BYOR";
  const domain = envOrNull("BRAND_DOMAIN") || "example.com";
  return `${brand} <reports@${domain.replace(/^https?:\/\//, "")}>`;
}

export function emailConfigured(): boolean {
  return !!envOrNull("RESEND_API_KEY") || !!envOrNull("SMTP_HOST");
}

export async function sendEmail(mail: Mail): Promise<DeliveryResult> {
  if (mail.to.length === 0) return { ok: false, reason: "no_recipients" };

  const resendKey = envOrNull("RESEND_API_KEY");
  if (resendKey) {
    try {
      return await sendViaResend(resendKey, mail);
    } catch (e: any) {
      console.error("[email] Resend failed:", e?.message);
      // fall through to SMTP if configured
    }
  }
  if (envOrNull("SMTP_HOST")) {
    try {
      return await sendViaSmtp(mail);
    } catch (e: any) {
      return { ok: false, reason: e?.message ?? "smtp_failed" };
    }
  }
  return { ok: false, reason: "no_email_provider" };
}

async function sendViaResend(apiKey: string, mail: Mail): Promise<DeliveryResult> {
  const body = {
    from: fromAddress(),
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    attachments: mail.attachments?.map((a) => ({
      filename: a.filename,
      content: a.contentBase64,
    })),
  };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend ${res.status}: ${t}`);
  }
  return { ok: true, provider: "resend" };
}

async function sendViaSmtp(mail: Mail): Promise<DeliveryResult> {
  // @ts-ignore — nodemailer is optional at install time
  const nodemailer: any = await import("nodemailer").catch(() => null);
  if (!nodemailer) {
    return { ok: false, reason: "nodemailer_not_installed" };
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "1",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  await transport.sendMail({
    from: fromAddress(),
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    attachments: mail.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, "base64"),
      contentType: a.contentType,
    })),
  });
  return { ok: true, provider: "smtp" };
}

// Utility: read a generated file off disk and turn it into a base64 attachment.
export function fileToAttachment(filePath: string, contentType: string): Attachment | null {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return {
    filename: path.basename(filePath),
    contentBase64: buf.toString("base64"),
    contentType,
  };
}
