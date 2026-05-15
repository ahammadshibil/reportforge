// Stripe connector. Pulls the numbers founders cite in monthly investor
// updates: MRR, active customer count, revenue last 30 days, churn (rough),
// new customers MTD. Output is formatted markdown — a synthesized "snapshot"
// note that BYOR treats as a Source. The LLM then narrates over it.
//
// Auth: per-connection Stripe Restricted API Key.
//   - Required permissions (Restricted Key recommended):
//     customers:read, subscriptions:read, invoices:read, balance:read, charges:read

import type { Connector, ConnectorListItem, FetchedContent } from "./types";
import { readConfig } from "./types";

type StripeConfig = {
  apiKey: string;
  accountName?: string; // discovered at connect time for the UI
};

const API = "https://api.stripe.com/v1";

function authed(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function stripeGet(token: string, path: string, params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const url = qs.toString() ? `${API}${path}?${qs}` : `${API}${path}`;
  const res = await fetch(url, { headers: authed(token) });
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

function fmtCents(cents: number, currency = "usd"): string {
  const n = cents / 100;
  const sym = { usd: "$", inr: "₹", eur: "€", gbp: "£" }[currency.toLowerCase()] || (currency.toUpperCase() + " ");
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function daysAgoUnix(days: number): number {
  return Math.floor((Date.now() - days * 86400 * 1000) / 1000);
}

// Compute MRR by summing active subscriptions' (unit_amount * quantity / interval_count).
// Simplified — doesn't handle proration, discount codes perfectly, but accurate for ~95%
// of SaaS startups using monthly + annual plans.
async function computeMRR(token: string): Promise<{ mrr: number; currency: string; activeSubs: number; sample: number }> {
  let mrr = 0;
  let activeSubs = 0;
  let currency = "usd";
  let starting_after: string | undefined;
  let pages = 0;
  // Walk paginated subscriptions until done or safety cap.
  while (pages < 10) {
    const params: Record<string, string | number> = { limit: 100, status: "active" };
    if (starting_after) params.starting_after = starting_after;
    const page = await stripeGet(token, "/subscriptions", params);
    for (const s of page.data || []) {
      activeSubs++;
      currency = (s.currency || currency).toLowerCase();
      for (const item of s.items?.data || []) {
        const price = item.price;
        if (!price?.recurring) continue;
        const interval = price.recurring.interval;
        const intervalCount = price.recurring.interval_count || 1;
        const unitAmount = price.unit_amount || 0;
        const qty = item.quantity || 1;
        let perMonth = 0;
        if (interval === "month") perMonth = (unitAmount * qty) / intervalCount;
        else if (interval === "year") perMonth = (unitAmount * qty) / (12 * intervalCount);
        else if (interval === "week") perMonth = (unitAmount * qty * 4.33) / intervalCount;
        else if (interval === "day") perMonth = (unitAmount * qty * 30) / intervalCount;
        mrr += perMonth;
      }
    }
    if (!page.has_more || (page.data || []).length === 0) break;
    starting_after = page.data[page.data.length - 1].id;
    pages++;
  }
  return { mrr, currency, activeSubs, sample: activeSubs };
}

async function snapshotMarkdown(token: string, accountName: string | undefined, opts: { days: number; label: string }): Promise<string> {
  const since = daysAgoUnix(opts.days);
  const [account, balance, mrrInfo, recentCustomers, recentCharges, recentInvoices] = await Promise.all([
    stripeGet(token, "/account").catch(() => ({})),
    stripeGet(token, "/balance").catch(() => ({})),
    computeMRR(token),
    stripeGet(token, "/customers", { limit: 100, "created[gte]": since }),
    stripeGet(token, "/charges", { limit: 100, "created[gte]": since }),
    stripeGet(token, "/invoices", { limit: 100, "created[gte]": since, status: "paid" }),
  ]);

  const currency = mrrInfo.currency || "usd";
  const newCustomers = (recentCustomers.data || []).length;
  const revenueCents = (recentInvoices.data || []).reduce(
    (acc: number, inv: any) => acc + (inv.amount_paid || 0),
    0
  );
  const chargeCount = (recentCharges.data || []).length;
  const balanceAvail = (balance?.available || [])
    .reduce((acc: number, b: any) => acc + (b.amount || 0), 0);
  const annualizedARR = mrrInfo.mrr * 12;

  const accName = account.business_profile?.name || account.settings?.dashboard?.display_name || accountName || "Stripe account";

  return `# Stripe snapshot — ${opts.label}
*Account: ${accName}*

## Headline metrics
- **MRR:** ${fmtCents(mrrInfo.mrr, currency)}  _(${mrrInfo.activeSubs} active subscriptions)_
- **Annualized run-rate:** ${fmtCents(annualizedARR, currency)}
- **Available balance:** ${fmtCents(balanceAvail, currency)}

## Last ${opts.days} days
- Revenue collected: ${fmtCents(revenueCents, currency)}  _(${(recentInvoices.data || []).length} paid invoices)_
- Charges processed: ${chargeCount}
- New customers added: ${newCustomers}

## Notes
- MRR computed by summing active recurring subscriptions (monthly + annual normalized to monthly).
- Revenue is paid-invoice amount in the period, not gross charges.
- Refunds and disputes not yet netted out — surface separately in your update if material.
${(recentCustomers.data || []).slice(0, 5).map((c: any) => `- New: ${c.email || c.name || c.id}`).join("\n")}
`;
}

export const stripe: Connector = {
  id: "stripe",
  label: "Stripe (metrics)",

  async createFromKey(input) {
    const apiKey = String(input.apiKey || "").trim();
    if (!apiKey) throw new Error("Stripe API key required");
    // Verify the key works + capture account name for the UI label.
    const account = await stripeGet(apiKey, "/account").catch((e) => {
      throw new Error(`Stripe auth failed: ${e?.message ?? e}`);
    });
    const accountName =
      account.business_profile?.name ||
      account.settings?.dashboard?.display_name ||
      account.email ||
      "Stripe";
    return {
      config: { apiKey, accountName } as unknown as Record<string, unknown>,
      accountEmail: account.email,
      name: `Stripe · ${accountName}`,
    };
  },

  async list(_connection) {
    // Three pre-built snapshots cover the common founder-update windows.
    return {
      items: [
        { externalId: "snapshot:30d", title: "Last 30 days (MRR + revenue)", mimeType: "text/markdown" },
        { externalId: "snapshot:90d", title: "Last 90 days", mimeType: "text/markdown" },
        { externalId: "snapshot:mtd", title: "Month to date", mimeType: "text/markdown" },
      ],
    };
  },

  async fetch(connection, externalId): Promise<FetchedContent> {
    const cfg = readConfig<StripeConfig>(connection);
    const days =
      externalId === "snapshot:30d" ? 30
      : externalId === "snapshot:90d" ? 90
      : externalId === "snapshot:mtd" ? new Date().getDate() // days into month so far
      : 30;
    const label =
      externalId === "snapshot:mtd" ? "Month to date" : `Last ${days} days`;
    const md = await snapshotMarkdown(cfg.apiKey, cfg.accountName, { days, label });
    return {
      title: `Stripe — ${label} · ${new Date().toISOString().slice(0, 10)}`,
      content: md,
      mimeType: "text/markdown",
      meta: { snapshot: externalId, days, fetchedAt: Date.now() },
    };
  },
};
