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
  FolderInput,
  RefreshCcw,
  History,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import type { Asset, Connection } from "@shared/schema";

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
  const [saveAsset, setSaveAsset] = useState<Asset | null>(null);

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

  const regen = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/assets/${id}/regenerate`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", current?.id, "assets"] });
      toast({ title: "Regenerated", description: "Prior version snapshotted." });
    },
    onError: (e: any) => toast({ title: "Regenerate failed", description: e?.message ?? "" }),
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
              <AssetCard
                key={a.id}
                a={a}
                meta={meta}
                Icon={Icon}
                onPreview={() => setPreviewAsset(a)}
                onSaveToVault={() => setSaveAsset(a)}
                onRegenerate={() => regen.mutate(a.id)}
                onDelete={() => del.mutate(a.id)}
                regenPending={regen.isPending && regen.variables === a.id}
              />
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
                    className="inline-flex mt-3 text-primary text-sm underline"
                  >
                    Download
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <SaveToVaultDialog asset={saveAsset} onClose={() => setSaveAsset(null)} />
    </div>
  );
}

// ---- Asset card with version badge + actions ----

type AssetCardProps = {
  a: Asset;
  meta: { label: string; icon: any; color: string };
  Icon: any;
  onPreview: () => void;
  onSaveToVault: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  regenPending: boolean;
};

function AssetCard({ a, meta, Icon, onPreview, onSaveToVault, onRegenerate, onDelete, regenPending }: AssetCardProps) {
  const { data: versions = [] } = useQuery<Array<{
    id: number;
    version: number;
    status: string;
    createdAt: number;
    prompt: string | null;
    hasHtml: boolean;
    hasFile: boolean;
  }>>({
    queryKey: [`/api/assets/${a.id}/versions`],
  });
  const [historyOpen, setHistoryOpen] = useState(false);

  const versionCount = versions.length;
  return (
    <Card className="p-4 flex flex-col" data-testid={`card-asset-${a.id}`}>
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-md bg-muted grid place-items-center shrink-0">
          <Icon className={`h-4 w-4 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{a.title}</div>
          <div className="text-xs text-muted-foreground">
            {meta.label} · {new Date(a.createdAt).toLocaleDateString()}
            {versionCount > 0 && (
              <>
                {" "}·{" "}
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="inline-flex items-center gap-0.5 hover:text-foreground underline-offset-2 hover:underline"
                  data-testid={`button-history-${a.id}`}
                >
                  <History className="h-3 w-3" /> v{versionCount + 1}
                </button>
              </>
            )}
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
      <div className="mt-4 pt-3 border-t border-border flex items-center gap-1.5 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={onPreview}
          data-testid={`button-preview-${a.id}`}
        >
          <Eye className="h-3.5 w-3.5 mr-1" /> Preview
        </Button>
        <a href={apiUrl(`/api/assets/${a.id}/file`)} download>
          <Button size="sm" variant="outline">
            <Download className="h-3.5 w-3.5 mr-1" /> Download
          </Button>
        </a>
        <Button
          size="sm"
          variant="outline"
          onClick={onSaveToVault}
          data-testid={`button-save-vault-${a.id}`}
        >
          <FolderInput className="h-3.5 w-3.5 mr-1" /> Save to vault
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRegenerate}
          disabled={regenPending}
          data-testid={`button-regen-${a.id}`}
        >
          <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${regenPending ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
        <div className="flex-1" />
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          data-testid={`button-delete-asset-${a.id}`}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <VersionHistoryDialog
        asset={a}
        versions={versions}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </Card>
  );
}

// ---- Version history dialog (preview + restore) ----

type VersionRow = {
  id: number;
  version: number;
  status: string;
  createdAt: number;
  prompt: string | null;
  hasHtml: boolean;
  hasFile: boolean;
};

function VersionHistoryDialog({
  asset,
  versions,
  open,
  onClose,
}: {
  asset: Asset;
  versions: VersionRow[];
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [previewVid, setPreviewVid] = useState<number | null>(null);

  const restore = useMutation({
    mutationFn: async (vid: number) => {
      const r = await apiRequest("POST", `/api/assets/${asset.id}/versions/${vid}/restore`);
      return r.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      queryClient.invalidateQueries({ queryKey: [`/api/assets/${asset.id}/versions`] });
      toast({
        title: `Restored v${r?.restoredFromVersion}`,
        description: "Current state was snapshotted as a new version.",
      });
      onClose();
    },
    onError: (e: any) => toast({ title: "Restore failed", description: e?.message ?? "" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Version history — {asset.title}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto p-3 flex flex-col gap-2">
          <div className="rounded-md border border-border px-3 py-2.5 bg-primary/5 text-xs">
            <div className="font-medium flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              v{versions.length + 1} · current
            </div>
            <div className="text-muted-foreground mt-0.5">
              {new Date(asset.createdAt).toLocaleString()}
            </div>
            {asset.prompt && (
              <div className="text-muted-foreground mt-1.5 italic line-clamp-2">{asset.prompt}</div>
            )}
          </div>
          {versions.map((v) => (
            <div
              key={v.id}
              className="rounded-md border border-border px-3 py-2.5 text-xs"
              data-testid={`version-${v.version}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-medium">v{v.version}</div>
                <div className="text-muted-foreground">
                  {new Date(v.createdAt).toLocaleString()}
                </div>
              </div>
              {v.prompt && (
                <div className="text-muted-foreground italic line-clamp-2 mb-2">
                  {v.prompt}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {(v.hasHtml || v.hasFile) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreviewVid(v.id)}
                    data-testid={`preview-version-${v.id}`}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restore.mutate(v.id)}
                  disabled={restore.isPending}
                  data-testid={`restore-version-${v.id}`}
                >
                  Restore this version
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
      {/* Version preview overlay (separate dialog so it nests cleanly) */}
      <Dialog open={previewVid !== null} onOpenChange={(o) => !o && setPreviewVid(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b">
            <DialogTitle className="text-base">Version preview</DialogTitle>
          </DialogHeader>
          {previewVid !== null && (
            <iframe
              src={apiUrl(`/api/assets/${asset.id}/versions/${previewVid}/file?inline=1`)}
              className="w-full"
              style={{ height: "calc(85vh - 56px)", border: 0 }}
              title="Version preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ----- Save to vault (Obsidian / any MCP) -----

type ConnectionRow = Connection & { hasConfig?: boolean };
type ToolDef = { name: string; description?: string };

function defaultPath(title: string): string {
  const slug = (title || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `06-Content-Drafts/${date}-${slug || "untitled"}.md`;
}

function looksLikeWriteTool(name: string): boolean {
  const n = name.toLowerCase();
  return (
    /create|write|append|save|update|put|new/.test(n) &&
    /note|file|page|content|document/.test(n)
  );
}

function SaveToVaultDialog({
  asset,
  onClose,
}: {
  asset: Asset | null;
  onClose: () => void;
}) {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [connectionId, setConnectionId] = useState<string>("");
  const [toolName, setToolName] = useState<string>("");
  const [path, setPath] = useState<string>("");

  const { data: connections = [] } = useQuery<ConnectionRow[]>({
    queryKey: [`/api/workspaces/${current?.id}/connections`],
    enabled: !!current && !!asset,
  });
  const mcpConnections = connections.filter((c) => c.type === "mcp");

  const { data: toolsData } = useQuery<{ tools: ToolDef[] }>({
    queryKey: [`/api/connections/${connectionId}/tools`],
    enabled: !!connectionId,
  });
  const tools = toolsData?.tools ?? [];
  const writeTools = tools.filter((t) => looksLikeWriteTool(t.name));
  const visibleTools = writeTools.length ? writeTools : tools;

  // Defaults when dialog opens
  if (asset && path === "") setPath(defaultPath(asset.title));
  if (mcpConnections.length === 1 && !connectionId) {
    setConnectionId(String(mcpConnections[0].id));
  }
  if (visibleTools.length && !toolName) {
    setToolName(visibleTools[0].name);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      const r = await apiRequest("POST", `/api/assets/${asset.id}/save-to-mcp`, {
        connectionId: Number(connectionId),
        toolName,
        path,
      });
      return r.json();
    },
    onSuccess: (r: any) => {
      toast({
        title: "Saved to vault",
        description: r?.path ?? "",
      });
      onClose();
      setConnectionId("");
      setToolName("");
      setPath("");
    },
    onError: (e: any) => {
      toast({ title: "Save failed", description: e?.message ?? "" });
    },
  });

  return (
    <Dialog
      open={!!asset}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setConnectionId("");
          setToolName("");
          setPath("");
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save to vault</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {mcpConnections.length === 0 ? (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              No MCP connections in this workspace yet. Add one (e.g. Obsidian) on the
              Connections page.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="save-conn">Connection</Label>
                <Select value={connectionId} onValueChange={setConnectionId}>
                  <SelectTrigger id="save-conn">
                    <SelectValue placeholder="Pick MCP connection…" />
                  </SelectTrigger>
                  <SelectContent>
                    {mcpConnections.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="save-tool">Write tool</Label>
                <Select value={toolName} onValueChange={setToolName}>
                  <SelectTrigger id="save-tool">
                    <SelectValue placeholder="Pick tool…" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleTools.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {writeTools.length > 0 && writeTools.length < tools.length && (
                  <p className="text-xs text-muted-foreground">
                    Showing {writeTools.length} write-shaped tools (filtered from {tools.length}).
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="save-path">Vault path</Label>
                <Input
                  id="save-path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="06-Content-Drafts/2026-05-08-q1-update.md"
                  data-testid="input-save-path"
                />
                <p className="text-xs text-muted-foreground">
                  Relative to your vault root. Folders are created automatically by Obsidian.
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!connectionId || !toolName || !path || saveMut.isPending}
            data-testid="button-save-vault-go"
          >
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
