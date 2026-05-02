import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspaceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Mail, FileText, Presentation, Sparkles, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Source, Asset } from "@shared/schema";
import { useLocation } from "wouter";

const TEMPLATES = [
  {
    kind: "newsletter" as const,
    icon: Mail,
    title: "Newsletter",
    desc: "Email-ready HTML with branded header, exec summary, sections, and callouts.",
    accent: "from-fuchsia-500/15 to-fuchsia-500/0",
  },
  {
    kind: "report" as const,
    icon: FileText,
    title: "Report",
    desc: "Multi-page branded PDF: cover, KPIs, executive summary, sections, callouts.",
    accent: "from-emerald-500/15 to-emerald-500/0",
  },
  {
    kind: "deck" as const,
    icon: Presentation,
    title: "Deck",
    desc: "Wide-format PPTX: title, summary slide with metrics, section slides, closing.",
    accent: "from-amber-500/15 to-amber-500/0",
  },
];

export default function Generate() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [kind, setKind] = useState<"newsletter" | "report" | "deck">("report");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<"formal" | "conversational" | "punchy">("formal");
  const [selected, setSelected] = useState<number[]>([]);

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ["/api/workspaces", current?.id, "sources"],
    queryFn: async () => {
      if (!current) return [];
      const r = await apiRequest("GET", `/api/workspaces/${current.id}/sources`);
      return r.json();
    },
    enabled: !!current,
  });

  const generate = useMutation({
    mutationFn: async (): Promise<Asset> => {
      const r = await apiRequest("POST", "/api/generate", {
        workspaceId: current!.id,
        kind,
        title: title || `Untitled ${kind}`,
        prompt,
        sourceIds: selected,
        tone,
      });
      return r.json();
    },
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", current?.id, "assets"] });
      toast({ title: "Generated", description: `${asset.title} is ready in your library.` });
      setLocation("/library");
    },
    onError: (e: any) =>
      toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const canGenerate = !!current && !!title && !!prompt;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Generate
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Build a new asset</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a template, write a brief, choose sources, and ship it.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          const active = kind === t.kind;
          return (
            <button
              key={t.kind}
              onClick={() => setKind(t.kind)}
              data-testid={`button-template-${t.kind}`}
              className={`relative text-left rounded-lg border ${
                active ? "border-primary ring-2 ring-primary/20" : "border-border"
              } bg-card p-5 hover-elevate overflow-hidden`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${t.accent} pointer-events-none`} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-md bg-background border border-border grid place-items-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  {active && (
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
                <div className="mt-4 font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                data-testid="input-gen-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q1 portfolio digest"
              />
            </div>
            <div>
              <Label>Brief</Label>
              <Textarea
                rows={6}
                data-testid="input-gen-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Summarize the latest portfolio updates, highlight winners and risks, end with three things to watch next week."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                  <SelectTrigger data-testid="select-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                    <SelectItem value="punchy">Punchy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!canGenerate || generate.isPending}
                  onClick={() => generate.mutate()}
                  data-testid="button-generate"
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  {generate.isPending ? "Generating…" : `Generate ${kind}`}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
            Sources
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            Selected sources are merged and synthesized. Leave empty to use all.
          </div>
          <div className="space-y-1.5 max-h-80 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
            {sources.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No sources in this workspace yet.
              </div>
            )}
            {sources.map((s) => (
              <label
                key={s.id}
                className="flex items-start gap-2.5 p-2 rounded-md hover-elevate cursor-pointer border border-transparent hover:border-border"
                data-testid={`label-source-${s.id}`}
              >
                <Checkbox
                  checked={selected.includes(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                  data-testid={`checkbox-source-${s.id}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {s.content.slice(0, 90)}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                  {s.type}
                </Badge>
              </label>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
