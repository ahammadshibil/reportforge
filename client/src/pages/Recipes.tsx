import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/lib/workspaceContext";
import {
  ChefHat,
  CheckCircle2,
  LayoutTemplate,
  CalendarClock,
  FileStack,
} from "lucide-react";

type Recipe = {
  id: string;
  name: string;
  description: string;
  category: "vc" | "biotech" | "general";
  creates: {
    workspace: string;
    template: string | null;
    schedule: string | null;
    sources: number;
  };
};

const CATEGORY_COLOR: Record<Recipe["category"], string> = {
  biotech: "bg-emerald-100 text-emerald-700 border-emerald-200",
  vc: "bg-sky-100 text-sky-700 border-sky-200",
  general: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

export default function Recipes() {
  const { toast } = useToast();
  const { setCurrentId } = useWorkspace();

  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const install = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/recipes/${id}/install`);
      return r.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      // Switch to the newly-created/found workspace
      if (r?.workspaceId) setCurrentId(r.workspaceId);
      toast({
        title: r?.workspaceCreated
          ? `Installed → new workspace`
          : `Installed → existing workspace`,
        description: [
          r?.templateId ? "template ✓" : null,
          r?.scheduleId ? "schedule (disabled) ✓" : null,
          r?.sourceIds?.length ? `${r.sourceIds.length} source${r.sourceIds.length > 1 ? "s" : ""} ✓` : null,
        ]
          .filter(Boolean)
          .join("  ·  "),
      });
    },
    onError: (e: any) => {
      toast({ title: "Install failed", description: e?.message ?? "" });
    },
  });

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center">
          <ChefHat className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recipes</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Pre-baked workflows. One click installs a workspace + template + schedule
            for a concrete use case. After install, wire delivery targets (vault,
            Substack, email) on the Schedules page and enable the schedule.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recipes.map((r) => (
          <Card key={r.id} className="p-5 flex flex-col gap-3" data-testid={`recipe-${r.id}`}>
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
                <p className="text-sm text-muted-foreground">{r.description}</p>
              </div>
            </div>

            <div className="rounded-md bg-muted/40 px-3 py-2.5 text-xs space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileStack className="h-3 w-3" />
                <span>Workspace: <span className="text-foreground font-medium">{r.creates.workspace}</span></span>
              </div>
              {r.creates.template && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LayoutTemplate className="h-3 w-3" />
                  <span>Template: <span className="text-foreground font-medium">{r.creates.template}</span></span>
                </div>
              )}
              {r.creates.schedule && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  <span>
                    Schedule: <span className="text-foreground font-medium">{r.creates.schedule}</span>
                    <span className="text-muted-foreground"> · installed disabled</span>
                  </span>
                </div>
              )}
              {r.creates.sources > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>
                    {r.creates.sources} sample source{r.creates.sources > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => install.mutate(r.id)}
                disabled={install.isPending}
                data-testid={`button-install-${r.id}`}
              >
                {install.isPending && install.variables === r.id ? "Installing…" : "Install"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
