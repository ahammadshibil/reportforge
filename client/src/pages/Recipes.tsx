import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/lib/workspaceContext";
import {
  ChefHat,
  CheckCircle2,
  LayoutTemplate,
  CalendarClock,
  FileStack,
  Plug,
  Eye,
} from "lucide-react";

type ConnectorRec = { type: string; label: string; required?: boolean };

type Recipe = {
  id: string;
  name: string;
  description: string;
  category: "vc" | "biotech" | "general" | "founder" | "engineering" | "marketing" | "oss";
  bestFor: string | null;
  cadenceLabel: string | null;
  connectorsRecommended: ConnectorRec[];
  exampleOutput: string | null;
  creates: {
    workspace: string;
    template: string | null;
    schedule: string | null;
    sources: number;
  };
};

const CATEGORY_COLOR: Record<Recipe["category"], string> = {
  founder: "bg-blue-100 text-blue-700 border-blue-200",
  vc: "bg-sky-100 text-sky-700 border-sky-200",
  biotech: "bg-emerald-100 text-emerald-700 border-emerald-200",
  engineering: "bg-violet-100 text-violet-700 border-violet-200",
  marketing: "bg-rose-100 text-rose-700 border-rose-200",
  oss: "bg-amber-100 text-amber-700 border-amber-200",
  general: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

export default function Recipes() {
  const { toast } = useToast();
  const { setCurrentId } = useWorkspace();
  const [previewRecipe, setPreviewRecipe] = useState<Recipe | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const categories = Array.from(new Set(recipes.map((r) => r.category)));
  const filtered =
    categoryFilter === "all" ? recipes : recipes.filter((r) => r.category === categoryFilter);

  const install = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/recipes/${id}/install`);
      return r.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      if (r?.workspaceId) setCurrentId(r.workspaceId);
      toast({
        title: r?.workspaceCreated ? "Installed → new workspace" : "Installed → existing workspace",
        description: [
          r?.templateId ? "template ✓" : null,
          r?.scheduleId ? "schedule (disabled) ✓" : null,
          r?.sourceIds?.length
            ? `${r.sourceIds.length} source${r.sourceIds.length > 1 ? "s" : ""} ✓`
            : null,
        ]
          .filter(Boolean)
          .join("  ·  "),
      });
      setPreviewRecipe(null);
    },
    onError: (e: any) => {
      toast({ title: "Install failed", description: e?.message ?? "" });
    },
  });

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center">
          <ChefHat className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recipes</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Pre-baked workflows. Pick the report you want to write, install in one
            click, connect data sources, schedule it. Each recipe is a vertical
            wrapping the same engine.
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full border ${
            categoryFilter === "all"
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background"
          }`}
        >
          All ({recipes.length})
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize ${
              categoryFilter === c
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((r) => (
          <Card
            key={r.id}
            className="p-5 flex flex-col gap-3 hover-elevate cursor-pointer"
            onClick={() => setPreviewRecipe(r)}
            data-testid={`recipe-${r.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold tracking-tight">{r.name}</h2>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[r.category]} capitalize`}
                  >
                    {r.category}
                  </span>
                </div>
                {r.bestFor && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Best for:</span> {r.bestFor}
                  </p>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-3">{r.description}</p>

            <div className="flex flex-wrap gap-1.5 mt-auto">
              {r.cadenceLabel && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {r.cadenceLabel}
                </span>
              )}
              {r.connectorsRecommended
                .filter((c) => c.required)
                .map((c) => (
                  <span
                    key={c.type}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-flex items-center gap-1"
                  >
                    <Plug className="h-3 w-3" />
                    {c.type}
                  </span>
                ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Preview / install dialog */}
      <Dialog open={!!previewRecipe} onOpenChange={(o) => !o && setPreviewRecipe(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {previewRecipe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {previewRecipe.name}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[previewRecipe.category]} capitalize font-normal`}
                  >
                    {previewRecipe.category}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {previewRecipe.bestFor && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                      Best for
                    </div>
                    <p className="text-sm">{previewRecipe.bestFor}</p>
                  </div>
                )}

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                    What this does
                  </div>
                  <p className="text-sm">{previewRecipe.description}</p>
                </div>

                {previewRecipe.cadenceLabel && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                      Cadence
                    </div>
                    <p className="text-sm inline-flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {previewRecipe.cadenceLabel}
                    </p>
                  </div>
                )}

                {previewRecipe.connectorsRecommended.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                      Wire these connectors after install
                    </div>
                    <ul className="space-y-1.5">
                      {previewRecipe.connectorsRecommended.map((c) => (
                        <li key={c.type} className="text-sm flex items-start gap-2">
                          <Plug className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" />
                          <span>
                            <span className="font-medium capitalize">{c.type}</span>
                            {c.required && (
                              <span className="text-[10px] uppercase ml-1.5 text-destructive">required</span>
                            )}
                            <span className="text-muted-foreground"> — {c.label}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {previewRecipe.exampleOutput && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                      <Eye className="h-3 w-3" />
                      Example output
                    </div>
                    <div className="rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap font-sans border border-border">
                      {previewRecipe.exampleOutput}
                    </div>
                  </div>
                )}

                <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
                  <div className="font-medium mb-1.5">What installing creates</div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileStack className="h-3 w-3" />
                    Workspace: <span className="text-foreground font-medium">{previewRecipe.creates.workspace}</span>
                  </div>
                  {previewRecipe.creates.template && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <LayoutTemplate className="h-3 w-3" />
                      Template: <span className="text-foreground font-medium">{previewRecipe.creates.template}</span>
                    </div>
                  )}
                  {previewRecipe.creates.schedule && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      Schedule: <span className="text-foreground font-medium">{previewRecipe.creates.schedule}</span>{" "}
                      <span>· disabled by default</span>
                    </div>
                  )}
                  {previewRecipe.creates.sources > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" />
                      {previewRecipe.creates.sources} sample source
                      {previewRecipe.creates.sources > 1 ? "s" : ""} (editorial principles)
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setPreviewRecipe(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => install.mutate(previewRecipe.id)}
                  disabled={install.isPending}
                  data-testid={`button-install-${previewRecipe.id}`}
                >
                  {install.isPending ? "Installing…" : "Install recipe"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
