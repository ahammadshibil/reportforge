import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspaceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, apiUrl } from "@/lib/queryClient";
import {
  Mail,
  FileText,
  Presentation,
  Download,
  Eye,
  Trash2,
  Search,
} from "lucide-react";
import type { Asset } from "@shared/schema";

const KIND: Record<string, { label: string; icon: any; color: string }> = {
  newsletter: { label: "Newsletter", icon: Mail, color: "text-fuchsia-500" },
  report: { label: "Report", icon: FileText, color: "text-emerald-500" },
  deck: { label: "Deck", icon: Presentation, color: "text-amber-500" },
};

export default function Library() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "newsletter" | "report" | "deck">("all");
  const [q, setQ] = useState("");
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/workspaces", current?.id, "assets"],
    queryFn: async () => {
      if (!current) return [];
      const r = await apiRequest("GET", `/api/workspaces/${current.id}/assets`);
      return r.json();
    },
    enabled: !!current,
  });

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/assets/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", current?.id, "assets"] });
      toast({ title: "Deleted" });
    },
  });

  const filtered = assets
    .filter((a) => filter === "all" || a.kind === filter)
    .filter((a) => a.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Library
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Generated assets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All newsletters, reports, and decks for this workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              data-testid="input-library-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="pl-8 w-56"
            />
          </div>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All ({assets.length})</TabsTrigger>
          <TabsTrigger value="newsletter">Newsletters</TabsTrigger>
          <TabsTrigger value="report">Reports</TabsTrigger>
          <TabsTrigger value="deck">Decks</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="py-16 text-center">
          <div className="text-sm text-muted-foreground">No matching assets.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((a) => {
            const meta = KIND[a.kind];
            const Icon = meta.icon;
            return (
              <Card key={a.id} className="p-4 flex flex-col" data-testid={`card-asset-${a.id}`}>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-md bg-muted grid place-items-center shrink-0">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {meta.label} · {new Date(a.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {a.status}
                  </Badge>
                </div>
                {a.prompt && (
                  <div className="text-xs text-muted-foreground mt-3 line-clamp-3 border-l-2 border-border pl-2.5 italic">
                    {a.prompt}
                  </div>
                )}
                <div className="mt-4 pt-3 border-t border-border flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewAsset(a)}
                    data-testid={`button-preview-${a.id}`}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                  </Button>
                  <a
                    href={apiUrl(`/api/assets/${a.id}/file`)}
                    download
                    data-testid={`link-download-${a.id}`}
                  >
                    <Button size="sm" variant="outline">
                      <Download className="h-3.5 w-3.5 mr-1" /> Download
                    </Button>
                  </a>
                  <div className="flex-1" />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => del.mutate(a.id)}
                    data-testid={`button-delete-asset-${a.id}`}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewAsset} onOpenChange={(o) => !o && setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b">
            <DialogTitle className="text-base">{previewAsset?.title}</DialogTitle>
          </DialogHeader>
          {previewAsset && (
            <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 56px)" }}>
              {previewAsset.kind === "newsletter" ? (
                <iframe
                  srcDoc={previewAsset.contentHtml ?? ""}
                  className="w-full"
                  style={{ height: "calc(85vh - 56px)", border: 0 }}
                  title="Newsletter preview"
                />
              ) : previewAsset.kind === "report" ? (
                <iframe
                  src={apiUrl(`/api/assets/${previewAsset.id}/file?inline=1`)}
                  className="w-full"
                  style={{ height: "calc(85vh - 56px)", border: 0 }}
                  title="PDF preview"
                />
              ) : (
                <div className="p-6 text-center">
                  <Presentation className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <div className="text-sm">PPTX preview is not supported in-browser.</div>
                  <a
                    href={apiUrl(`/api/assets/${previewAsset.id}/file`)}
                    download
                    className="inline-flex items-center gap-1.5 mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover-elevate"
                  >
                    <Download className="h-4 w-4" /> Download deck
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
