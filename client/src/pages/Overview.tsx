import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspaceContext";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  FileText,
  Mail,
  Presentation,
  TrendingUp,
  Sparkles,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { Asset, Source, Schedule } from "@shared/schema";

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  newsletter: { label: "Newsletter", icon: Mail, color: "text-fuchsia-500" },
  report: { label: "Report", icon: FileText, color: "text-emerald-500" },
  deck: { label: "Deck", icon: Presentation, color: "text-amber-500" },
};

function StatCard({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon: any;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 flex items-end gap-3">
        <div className="text-2xl font-semibold tracking-tight num">{value}</div>
        {delta && (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 num pb-1">
            {delta}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Overview() {
  const { current } = useWorkspace();
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/workspaces", current?.id, "assets"],
    queryFn: async () => {
      if (!current) return [];
      const r = await apiRequest("GET", `/api/workspaces/${current.id}/assets`);
      return r.json();
    },
    enabled: !!current,
  });
  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ["/api/workspaces", current?.id, "sources"],
    queryFn: async () => {
      if (!current) return [];
      const r = await apiRequest("GET", `/api/workspaces/${current.id}/sources`);
      return r.json();
    },
    enabled: !!current,
  });
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/workspaces", current?.id, "schedules"],
    queryFn: async () => {
      if (!current) return [];
      const r = await apiRequest("GET", `/api/workspaces/${current.id}/schedules`);
      return r.json();
    },
    enabled: !!current,
  });

  // Build a 12-week activity series from createdAt
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const start = now - (11 - i) * weekMs;
    return {
      week: new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      newsletter: 0,
      report: 0,
      deck: 0,
    };
  });
  assets.forEach((a) => {
    const idx = Math.floor((a.createdAt - (now - 12 * weekMs)) / weekMs);
    if (idx >= 0 && idx < 12) {
      (buckets[idx] as any)[a.kind] += 1;
    }
  });

  const recent = assets.slice(0, 6);

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Overview
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {current?.name ?? "Workspace"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {current?.industry || "—"} · {assets.length} assets generated · {sources.length} sources
          </p>
        </div>
        <Link href="/generate">
          <a
            data-testid="link-cta-generate"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover-elevate"
          >
            <Sparkles className="h-4 w-4" /> New generation
          </a>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Assets generated"
          value={assets.length}
          icon={FileText}
          delta={assets.length ? `+${assets.filter((a) => Date.now() - a.createdAt < 7 * weekMs).length} this week` : undefined}
        />
        <StatCard label="Sources" value={sources.length} icon={FileStackIcon} />
        <StatCard
          label="Active schedules"
          value={schedules.filter((s) => s.enabled).length}
          icon={CalendarClock}
        />
        <StatCard
          label="Avg / week"
          value={(assets.length / 12).toFixed(1)}
          icon={TrendingUp}
        />
      </div>

      {/* Activity chart */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Generation activity
            </div>
            <div className="text-sm font-medium mt-0.5">Last 12 weeks</div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-1))]" /> Newsletter
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-2))]" /> Report
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-3))]" /> Deck
            </span>
          </div>
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={buckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="newsletter" stroke="hsl(var(--chart-1))" fill="url(#g1)" strokeWidth={2} />
              <Area type="monotone" dataKey="report" stroke="hsl(var(--chart-2))" fill="url(#g2)" strokeWidth={2} />
              <Area type="monotone" dataKey="deck" stroke="hsl(var(--chart-3))" fill="url(#g3)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Recent + Schedules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Recent generations
              </div>
              <div className="text-sm font-medium mt-0.5">Last 6 outputs</div>
            </div>
            <Link href="/library">
              <a className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                View library <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No generations yet — head to Generate.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((a) => {
                const meta = KIND_META[a.kind];
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="flex items-center gap-3 py-3" data-testid={`row-asset-${a.id}`}>
                    <div className="h-8 w-8 rounded-md bg-muted grid place-items-center">
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {meta.label} · {new Date(a.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant={a.status === "ready" ? "secondary" : "outline"} className="capitalize">
                      {a.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
            Active schedules
          </div>
          {schedules.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No recurring jobs yet.
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.slice(0, 4).map((s) => (
                <div key={s.id} className="border border-border rounded-md p-3" data-testid={`row-schedule-${s.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {s.cadence}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 capitalize">
                    {s.kind} · {s.recipients ?? "no recipients"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FileStackIcon(props: any) {
  return <FileText {...props} />;
}
