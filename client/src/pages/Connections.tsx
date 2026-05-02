import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, apiUrl } from "@/lib/queryClient";
import { useWorkspace } from "@/lib/workspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plug,
  RefreshCcw,
  Trash2,
  FolderOpen,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConnectorType = {
  id: string;
  label: string;
  available: boolean;
  authMode: "oauth" | "key";
};

type Connection = {
  id: number;
  workspaceId: number;
  type: string;
  name: string;
  status: string;
  accountEmail: string | null;
  lastSyncedAt: number | null;
  createdAt: number;
};

type ListItem = {
  externalId: string;
  title: string;
  mimeType?: string;
  modifiedAt?: number;
};

export default function Connections() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [browserConn, setBrowserConn] = useState<Connection | null>(null);
  const [keyType, setKeyType] = useState<ConnectorType | null>(null);

  const { data: types = [] } = useQuery<ConnectorType[]>({
    queryKey: ["/api/connections/types"],
  });
  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: [`/api/workspaces/${current?.id}/connections`],
    enabled: !!current,
  });

  // Listen for OAuth popup completion
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "rf:oauth") {
        queryClient.invalidateQueries({
          queryKey: [`/api/workspaces/${current?.id}/connections`],
        });
        if (e.data.ok) toast({ title: "Connection added" });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [current?.id, toast]);

  const removeMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/workspaces/${current?.id}/connections`],
      });
    },
  });

  const syncMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/connections/${id}/sync`);
    },
    onSuccess: () => {
      toast({ title: "Synced" });
      queryClient.invalidateQueries({
        queryKey: [`/api/workspaces/${current?.id}/sources`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/workspaces/${current?.id}/connections`],
      });
    },
  });

  function startOAuth(typeId: string) {
    if (!current) return;
    const url = apiUrl(`/api/connections/${typeId}/start?workspaceId=${current.id}`);
    const popup = window.open(url, "rf-oauth", "width=520,height=640");
    if (!popup) toast({ title: "Popup blocked", description: "Allow popups to connect." });
  }

  if (!current) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Pick a workspace to manage connections.</div>
    );
  }

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center">
          <Plug className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external sources. ReportForge pulls content into <strong>{current.name}</strong>.
          </p>
        </div>
      </div>

      {/* Add new */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Add a connection
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {types.map((t) => (
            <button
              key={t.id}
              disabled={!t.available}
              onClick={() => {
                if (!t.available) return;
                if (t.authMode === "oauth") startOAuth(t.id);
                else setKeyType(t);
              }}
              className="text-left rounded-lg border border-border p-4 hover-elevate disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid={`add-${t.id}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{t.label}</div>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-xs text-muted-foreground">
                {t.authMode === "oauth" ? "OAuth" : "API key"}
                {!t.available && " · env not configured"}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Existing */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Connected ({connections.length})
        </h2>
        {connections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No connections yet. Add one above.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {connections.map((c) => (
              <li key={c.id} className="flex items-center gap-4 p-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.type} · {c.accountEmail ?? "—"} ·{" "}
                    {c.lastSyncedAt
                      ? `synced ${new Date(c.lastSyncedAt).toLocaleString()}`
                      : "never synced"}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBrowserConn(c)}
                  data-testid={`browse-${c.id}`}
                >
                  <FolderOpen className="h-4 w-4 mr-1.5" />
                  Browse
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => syncMut.mutate(c.id)}
                  disabled={syncMut.isPending}
                  data-testid={`sync-${c.id}`}
                >
                  <RefreshCcw className="h-4 w-4 mr-1.5" />
                  Sync
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMut.mutate(c.id)}
                  data-testid={`remove-${c.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BrowseDialog conn={browserConn} onClose={() => setBrowserConn(null)} />
      <KeyDialog type={keyType} onClose={() => setKeyType(null)} />
    </div>
  );
}

function KeyDialog({
  type,
  onClose,
}: {
  type: ConnectorType | null;
  onClose: () => void;
}) {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [baseId, setBaseId] = useState("");
  const [urls, setUrls] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (type) {
      setApiKey("");
      setBaseId("");
      setUrls("");
      setName("");
    }
  }, [type]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!type || !current) return;
      const body: Record<string, unknown> = { workspaceId: current.id };
      if (type.id === "airtable") {
        body.apiKey = apiKey;
        if (baseId) body.baseId = baseId;
      } else if (type.id === "url") {
        body.urls = urls;
        if (name) body.name = name;
      }
      await apiRequest("POST", `/api/connections/${type.id}/key`, body);
    },
    onSuccess: () => {
      toast({ title: "Connection added" });
      queryClient.invalidateQueries({
        queryKey: [`/api/workspaces/${current?.id}/connections`],
      });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Failed to connect", description: e?.message ?? "" });
    },
  });

  return (
    <Dialog open={!!type} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {type?.label}</DialogTitle>
        </DialogHeader>
        {type?.id === "airtable" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="airtable-key">Personal Access Token</Label>
              <Input
                id="airtable-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="patXXXXXXXXXXXXXX..."
                data-testid="input-airtable-key"
              />
              <p className="text-xs text-muted-foreground">
                Generate at airtable.com/create/tokens with{" "}
                <code>data.records:read</code> + <code>schema.bases:read</code>.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="airtable-base">Base ID (optional)</Label>
              <Input
                id="airtable-base"
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
                placeholder="appXXXXXXXXXXXXXX"
                data-testid="input-airtable-base"
              />
            </div>
          </div>
        )}
        {type?.id === "url" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="url-name">Name (optional)</Label>
              <Input
                id="url-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Industry blogs"
                data-testid="input-url-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url-list">URLs</Label>
              <Textarea
                id="url-list"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={"https://example.com/post-1\nhttps://example.com/post-2"}
                rows={6}
                data-testid="input-url-list"
              />
              <p className="text-xs text-muted-foreground">One URL per line.</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            data-testid="button-connect"
          >
            {createMut.isPending ? "Connecting…" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrowseDialog({
  conn,
  onClose,
}: {
  conn: Connection | null;
  onClose: () => void;
}) {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ items: ListItem[]; nextCursor?: string }>({
    queryKey: conn ? [`/api/connections/${conn.id}/list`] : [""],
    enabled: !!conn,
  });

  const importMut = useMutation({
    mutationFn: async () => {
      if (!conn) return;
      const externalIds = Array.from(picked);
      await apiRequest("POST", `/api/connections/${conn.id}/import`, { externalIds });
    },
    onSuccess: () => {
      toast({ title: "Imported as sources" });
      queryClient.invalidateQueries({
        queryKey: [`/api/workspaces/${current?.id}/sources`],
      });
      setPicked(new Set());
      onClose();
    },
  });

  const items = (data?.items ?? []).filter((it) =>
    query ? it.title.toLowerCase().includes(query.toLowerCase()) : true
  );

  return (
    <Dialog open={!!conn} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Browse {conn?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Filter by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="input-browse-filter"
          />
          <div className="max-h-80 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
            {!isLoading &&
              items.map((it) => {
                const checked = picked.has(it.externalId);
                return (
                  <label
                    key={it.externalId}
                    className="flex items-center gap-3 p-3 hover-elevate cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = new Set(picked);
                        if (v) next.add(it.externalId);
                        else next.delete(it.externalId);
                        setPicked(next);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{it.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.mimeType ?? "—"}
                        {it.modifiedAt
                          ? ` · ${new Date(it.modifiedAt).toLocaleDateString()}`
                          : ""}
                      </div>
                    </div>
                  </label>
                );
              })}
            {!isLoading && items.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No items.</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <div className="flex-1 text-xs text-muted-foreground">
            {picked.size} selected
          </div>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => importMut.mutate()}
            disabled={picked.size === 0 || importMut.isPending}
            data-testid="button-import"
          >
            {importMut.isPending ? "Importing…" : `Import ${picked.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
