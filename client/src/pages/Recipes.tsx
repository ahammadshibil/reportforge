import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, apiUrl, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
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
  Download,
  Upload,
} from "lucide-react";
import type { Workspace } from "@shared/schema";

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
  const [exportOpen, setExportOpen] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const importRecipe = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("File is not valid JSON");
      }
      const r = await apiRequest("POST", "/api/recipes/import", parsed);
      return r.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      if (r?.workspaceId) setCurrentId(r.workspaceId);
      toast({
        title: "Recipe imported",
        description: [
          r?.workspaceCreated ? "new workspace" : "existing workspace",
          r?.templateId ? "template" : null,
          r?.scheduleId ? "schedule" : null,
          r?.sourceIds?.length ? `${r.sourceIds.length} source(s)` : null,
        ]
          .filter(Boolean)
          .join("  ·  "),
      });
    },
    onError: (e: any) => {
      toast({ title: "Import failed", description: e?.message ?? "" });
    },
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
      <div className="flex items-start justify-between gap-4">
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
        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json,.byor.json"
            className="hidden"
            data-testid="input-import-recipe"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importRecipe.mutate(f);
              e.currentTarget.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => importFileRef.current?.click()}
            disabled={importRecipe.isPending}
            data-testid="button-import-recipe"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {importRecipe.isPending ? "Importing…" : "Import"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            data-testid="button-export-recipe"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
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

      <ExportRecipeDialog open={exportOpen} onClose={() => setExportOpen(false)} />

      {/* Recipe preview / install dialog */}
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

// ---- Export workspace as recipe.byor.json ----

function ExportRecipeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [bestFor, setBestFor] = useState("");
  const [cadenceLabel, setCadenceLabel] = useState("");
  const [includeTemplate, setIncludeTemplate] = useState(true);
  const [includeSchedule, setIncludeSchedule] = useState(true);
  const [includeSources, setIncludeSources] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function doExport() {
    if (!workspaceId) return;
    setExporting(true);
    try {
      const res = await fetch(apiUrl("/api/recipes/export"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: Number(workspaceId),
          includeTemplate,
          includeSchedule,
          includeSources,
          meta: {
            name: name || undefined,
            description: description || undefined,
            category,
            bestFor: bestFor || undefined,
            cadenceLabel: cadenceLabel || undefined,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      // Filename comes from Content-Disposition; fall back to a sane default.
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/i.exec(cd);
      const filename = match?.[1] || "recipe.byor.json";
      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Recipe exported", description: filename });
      onClose();
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message ?? "" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export workspace as recipe
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Source workspace</Label>
            <Select value={workspaceId} onValueChange={setWorkspaceId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a workspace to export…" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Recipe name (optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="defaults to workspace name + ' recipe'"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this recipe does, who it's for"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["founder", "vc", "biotech", "engineering", "marketing", "oss", "general"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cadence label</Label>
              <Input
                value={cadenceLabel}
                onChange={(e) => setCadenceLabel(e.target.value)}
                placeholder="End of every month"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Best for (optional)</Label>
            <Input
              value={bestFor}
              onChange={(e) => setBestFor(e.target.value)}
              placeholder="who the recipe is for in one line"
            />
          </div>

          <div className="space-y-2 rounded-md bg-muted/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              What to include
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={includeTemplate}
                onChange={(e) => setIncludeTemplate(e.target.checked)}
              />
              Template (if workspace has one)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={includeSchedule}
                onChange={(e) => setIncludeSchedule(e.target.checked)}
              />
              Schedule (prompt + cadence; connection IDs stripped)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={includeSources}
                onChange={(e) => setIncludeSources(e.target.checked)}
              />
              Source notes (editorial principles, samples)
            </label>
            {includeSources && (
              <p className="text-[11px] text-muted-foreground pl-6">
                Caution: source content goes into the file as-is. Don't ship private vault notes
                unless you've reviewed.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={doExport}
            disabled={!workspaceId || exporting}
            data-testid="button-export-go"
          >
            {exporting ? "Exporting…" : "Download recipe.byor.json"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
