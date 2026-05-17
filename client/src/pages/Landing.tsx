// Public landing page — shown to unauthenticated visitors when auth is
// configured. Marketing-shaped, not app-shaped.

import { useQuery } from "@tanstack/react-query";
import { useBrand } from "@/lib/brandContext";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Sparkles,
  Plug,
  ChefHat,
  Github,
  Mail,
  ArrowRight,
  FileText,
  Newspaper,
  TrendingUp,
  Briefcase,
  Code,
  Heart,
  Package,
} from "lucide-react";

// Icon map — recipes from the API don't ship an icon, we pick one per category
// so the visuals stay rich without hardcoding the recipe list.
const CATEGORY_ICONS: Record<string, any> = {
  founder: TrendingUp,
  vc: Briefcase,
  engineering: Code,
  marketing: TrendingUp,
  oss: Heart,
  biotech: Newspaper,
  general: FileText,
};

type PublicRecipe = {
  id: string;
  name: string;
  description: string;
  category: string;
  bestFor: string | null;
  cadenceLabel: string | null;
  connectorsRecommended: Array<{ type: string; label: string; required?: boolean }>;
};

const COMPARISON = [
  ["Open source", true, false, false, false, false],
  ["Self-host free", true, false, false, false, false],
  ["Bring your own LLM key", true, false, false, false, false],
  ["Auto-pull from Stripe / GitHub / Notion", true, false, false, false, "CRM only"],
  ["Cited claims with footnotes", true, false, false, false, false],
  ["Autonomous delivery (email + vault + Substack)", true, false, "post only", "post only", "email only"],
  ["Per-recipient personalization", true, false, true, "tiers", true],
  ["Recipe marketplace (import/export)", true, false, "paid", false, false],
  ["Cloud price", "$29-99/mo", "$10-25/seat", "$49+/mo", "10% rev", "$45-1200/seat"],
];
const COLS = ["", "BYOR", "Notion", "Beehiiv", "Substack", "HubSpot"];

function Cell({ v }: { v: any }) {
  if (v === true) return <span className="text-emerald-600">✓</span>;
  if (v === false) return <span className="text-zinc-400">—</span>;
  return <span className="text-xs">{v}</span>;
}

export default function Landing() {
  const brand = useBrand();
  const { data: recipes = [] } = useQuery<PublicRecipe[]>({
    queryKey: ["/api/recipes/public"],
  });
  return (
    <div className="min-h-dvh bg-background">
      {/* Top nav */}
      <nav className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
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
          </div>
          <div className="flex items-center gap-2">
            <a href="https://github.com/ahammadshibil/reportforge" target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm">
                <Github className="h-4 w-4 mr-1.5" />
                GitHub
              </Button>
            </a>
            <Link href="/pricing">
              <Button variant="ghost" size="sm">Pricing</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground mb-6">
          <Sparkles className="h-3 w-3" />
          Open source · MIT · v1.0.0
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Your monthly report writes itself.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
          {brand.name} pulls live numbers from your tools, drafts the report in your voice with citations, and delivers it to email + your vault + Substack — on a schedule.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          An open-source alternative to <span className="font-medium">Notion</span>,{" "}
          <span className="font-medium">Beehiiv</span>,{" "}
          <span className="font-medium">Substack</span>,{" "}
          <span className="font-medium">HubSpot</span>.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link href="/login">
            <Button size="lg" data-testid="cta-signin">
              Try the demo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <a href="https://railway.com/deploy?template=https://github.com/ahammadshibil/reportforge" target="_blank" rel="noreferrer">
            <Button size="lg" variant="outline">
              <Plug className="h-4 w-4 mr-2" />
              Deploy on Railway
            </Button>
          </a>
          <a href="https://github.com/ahammadshibil/reportforge" target="_blank" rel="noreferrer">
            <Button size="lg" variant="outline">
              <Github className="h-4 w-4 mr-2" />
              Self-host (free)
            </Button>
          </a>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Free self-host forever · Cloud from $29/mo · Bring your own LLM key
        </p>
      </section>

      {/* Diagram */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <pre className="text-xs md:text-sm bg-muted/40 rounded-lg p-6 overflow-x-auto font-mono text-muted-foreground">
{`   Stripe · GitHub · Notion · Airtable · Obsidian · any MCP
                          ↓
              ${brand.name} LLM synthesizes (with citations)
                          ↓
              branded PDF · HTML · PPTX
                          ↓
   email · Obsidian vault · Substack draft · webhook`}
        </pre>
      </section>

      {/* Recipes grid */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">
            <ChefHat className="h-3.5 w-3.5" />
            Recipes
          </div>
          <h2 className="text-3xl font-bold mt-2">Pick the report you write. Install in one click.</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            8 recipes ship. More land monthly. Each one is a workflow: connect data, schedule, autonomous draft on cadence. Export your own as <code>.byor.json</code> and share with the community.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {recipes.length === 0 ? (
            // Skeleton while the public catalog loads — avoids empty-state flash
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-4 animate-pulse">
                <div className="h-4 w-32 bg-muted rounded mb-3" />
                <div className="h-3 w-full bg-muted rounded mb-2" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))
          ) : (
            recipes.map((r) => {
              const Icon = CATEGORY_ICONS[r.category] ?? Package;
              const reqConnectors = r.connectorsRecommended
                .filter((c) => c.required)
                .map((c) => c.type);
              return (
                <div key={r.id} className="rounded-lg border border-border p-4 hover-elevate">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-7 w-7 rounded-md bg-muted grid place-items-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="text-sm font-semibold tracking-tight">{r.name}</div>
                  </div>
                  {r.bestFor && (
                    <div className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {r.bestFor}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-1">
                    {r.cadenceLabel && (
                      <span className="px-1.5 py-0.5 rounded bg-muted">{r.cadenceLabel}</span>
                    )}
                    {reqConnectors.map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">How {brand.name} compares</h2>
          <p className="text-muted-foreground mt-3">
            Open-source, self-hostable, full feature parity in cloud + self-host. No enterprise gotchas.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {COLS.map((c, i) => (
                  <th
                    key={i}
                    className={`p-3 text-left ${i === 1 ? "bg-primary/5 font-semibold" : "text-muted-foreground font-medium"}`}
                  >
                    {c || ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={i} className="border-b border-border">
                  {row.map((v: any, j: number) => (
                    <td key={j} className={`p-3 ${j === 0 ? "" : "text-center"} ${j === 1 ? "bg-primary/5" : ""}`}>
                      {j === 0 ? v : <Cell v={v} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold">Stop writing the same report by hand every month.</h2>
        <p className="text-muted-foreground mt-3">
          Self-host in 30 seconds, or use the hosted cloud. Either way, your data stays connected to your tools and your LLM key — not ours.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <Link href="/login">
            <Button size="lg">
              Try the demo <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline">See pricing</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-muted-foreground">
          <div>
            © 2026 {brand.name} · MIT licensed · {brand.footer}
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/ahammadshibil/reportforge" target="_blank" rel="noreferrer" className="hover:text-foreground">
              GitHub
            </a>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            {brand.supportEmail && (
              <a href={`mailto:${brand.supportEmail}`} className="hover:text-foreground inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {brand.supportEmail}
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
