// Public pricing page — no auth required.
import { useBrand } from "@/lib/brandContext";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Github, ArrowRight, Check, Plug } from "lucide-react";

const TIERS = [
  {
    name: "Self-host",
    price: "$0",
    period: "forever",
    blurb: "Run BYOR on your own infrastructure. Same code as cloud. No feature gating.",
    cta: "Clone the repo",
    ctaHref: "https://github.com/ahammadshibil/reportforge",
    ctaIcon: Github,
    highlight: false,
    features: [
      "All 8+ recipes",
      "All connectors (Stripe, GitHub, Notion, Airtable, Obsidian, MCP)",
      "Multi-provider LLM (Anthropic, OpenAI, Gemini, etc)",
      "Citations + versioning + scheduling",
      "Recipe marketplace (import / export)",
      "Per-recipient personalization",
      "Community support",
      "MIT license",
    ],
  },
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    blurb: "Hosted by us. One person, one workspace, your monthly report on autopilot.",
    cta: "Get a starter instance",
    ctaHref: "mailto:hello@byor.app?subject=BYOR%20Starter",
    highlight: false,
    features: [
      "Everything in Self-host",
      "1 workspace",
      "We host + patch + back up",
      "Bring your own LLM key",
      "Email support",
      "Standard subdomain",
    ],
  },
  {
    name: "Founder",
    price: "$79",
    period: "/month",
    blurb: "For founders writing monthly investor updates. Pre-wired for Stripe + GitHub.",
    cta: "Try Founder tier",
    ctaHref: "mailto:hello@byor.app?subject=BYOR%20Founder",
    highlight: true,
    badge: "Most popular",
    features: [
      "Everything in Starter",
      "3 workspaces",
      "Custom domain",
      "Premium recipes monthly",
      "Priority email support",
      "Founder-update recipe pre-installed",
    ],
  },
  {
    name: "Team",
    price: "$199",
    period: "/month",
    blurb: "Small firms with multi-user needs. Custom domain, tenant branding.",
    cta: "Talk to us",
    ctaHref: "mailto:hello@byor.app?subject=BYOR%20Team",
    highlight: false,
    features: [
      "Everything in Founder",
      "Unlimited workspaces",
      "Multi-user (coming soon)",
      "Full tenant branding (logo, colors, domain)",
      "Onboarding call",
    ],
  },
  {
    name: "Whitelabel",
    price: "$499",
    period: "/month + $50/seat",
    blurb: "Partners reselling under their own brand. Your name, our engine.",
    cta: "Become a partner",
    ctaHref: "mailto:hello@byor.app?subject=BYOR%20Whitelabel",
    highlight: false,
    features: [
      "Everything in Team",
      "Whitelabel (your brand, your domain, your support)",
      "Co-marketing if it makes sense",
      "Custom recipes built by us",
      "Dedicated Slack channel with the maintainer",
    ],
  },
];

export default function Pricing() {
  const brand = useBrand();
  return (
    <div className="min-h-dvh bg-background">
      <nav className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="h-6" />
            ) : (
              <div
                className="h-7 w-7 rounded-md grid place-items-center text-[11px] font-semibold text-white"
                style={{ background: brand.color }}
              >
                {brand.logoText}
              </div>
            )}
            <div className="font-semibold tracking-tight">{brand.name}</div>
          </Link>
          <div className="flex items-center gap-2">
            <a href="https://github.com/ahammadshibil/reportforge" target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm">
                <Github className="h-4 w-4 mr-1.5" />
                GitHub
              </Button>
            </a>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Open core. Honest pricing.</h1>
        <p className="text-muted-foreground text-lg mt-4">
          Self-host {brand.name} for free, forever — every feature, no enterprise tier hostage. Or let us host it for you when you'd rather not.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <Plug className="h-3 w-3" />
          Cloud price ≠ infrastructure cost. You also bring your own LLM key — typically $0–5/mo on Gemini Flash or free tier.
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {TIERS.map((t) => {
            const Icon = t.ctaIcon ?? ArrowRight;
            return (
              <Card
                key={t.name}
                className={`p-6 flex flex-col ${t.highlight ? "border-primary border-2 ring-2 ring-primary/20" : ""}`}
              >
                {t.badge && (
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-primary font-semibold">
                    {t.badge}
                  </div>
                )}
                <h3 className="text-xl font-semibold tracking-tight">{t.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{t.price}</span>
                  <span className="text-sm text-muted-foreground">{t.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-3 min-h-[3rem]">{t.blurb}</p>
                <a
                  href={t.ctaHref}
                  target={t.ctaHref.startsWith("http") ? "_blank" : undefined}
                  rel={t.ctaHref.startsWith("http") ? "noreferrer" : undefined}
                  className="mt-5"
                >
                  <Button
                    className="w-full"
                    variant={t.highlight ? "default" : "outline"}
                    data-testid={`tier-${t.name.toLowerCase()}`}
                  >
                    <Icon className="h-4 w-4 mr-1.5" />
                    {t.cta}
                  </Button>
                </a>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            Looking for something different? Email <a href="mailto:hello@byor.app" className="underline hover:text-foreground">hello@byor.app</a>.
          </p>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-muted-foreground">
          © 2026 {brand.name} · MIT licensed
        </div>
      </footer>
    </div>
  );
}
