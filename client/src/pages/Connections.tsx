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
            Connect external sources. BYOR pulls content into <strong>{current.name}</strong>.
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

  // ----- MCP-specific state -----
  type McpPreset = {
    id: string;
    label: string;
    description: string;
    status: "official" | "community-mature" | "community-fragile";
    transport: "stdio" | "http";
    command?: string;
    args?: string[];
    url?: string;
    envFields?: Array<{ key: string; label: string; placeholder?: string; required?: boolean }>;
    homepage: string;
  };
  const [mcpPresetId, setMcpPresetId] = useState<string>("colab");
  const [mcpEnv, setMcpEnv] = useState<Record<string, string>>({});
  const [mcpCustomCommand, setMcpCustomCommand] = useState("");
  const [mcpCustomArgs, setMcpCustomArgs] = useState("");
  const [mcpCustomUrl, setMcpCustomUrl] = useState("");
  const [mcpCustomTransport, setMcpCustomTransport] = useState<"stdio" | "http">("stdio");

  const { data: mcpPresets = [] } = useQuery<McpPreset[]>({
    queryKey: ["/api/connections/mcp/presets"],
    enabled: type?.id === "mcp",
  });
  const activePreset = mcpPresets.find((p) => p.id === mcpPresetId);

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
      } else if (type.id === "mcp") {
        if (mcpPresetId === "custom") {
          body.transport = mcpCustomTransport;
          if (mcpCustomTransport === "stdio") {
            body.command = mcpCustomCommand;
            body.args = mcpCustomArgs;
          } else {
            body.url = mcpCustomUrl;
          }
        } else if (activePreset) {
          body.transport = activePreset.transport;
          if (activePreset.transport === "stdio") {
            body.command = activePreset.command;
            body.args = activePreset.args;
          } else if (activePreset.url) {
            body.url = activePreset.url;
          }
        }
        const env = Object.fromEntries(
          Object.entries(mcpEnv).filter(([, v]) => v !== "")
        );
        if (Object.keys(env).length) body.env = env;
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
        {type?.id === "mcp" && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>MCP server</Label>
              <div className="grid grid-cols-1 gap-1.5">
                {mcpPresets.map((p) => {
                  const active = mcpPresetId === p.id;
                  const badgeColor =
                    p.status === "official"
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : p.status === "community-mature"
                        ? "bg-sky-100 text-sky-700 border-sky-200"
                        : "bg-amber-100 text-amber-700 border-amber-200";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setMcpPresetId(p.id);
                        setMcpEnv({});
                      }}
                      className={`text-left rounded-md border p-2.5 hover-elevate ${
                        active ? "border-primary bg-primary/5" : "border-border"
                      }`}
                      data-testid={`mcp-preset-${p.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium flex-1">{p.label}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeColor}`}>
                          {p.status === "official"
                            ? "official"
                            : p.status === "community-mature"
                              ? "community"
                              : "fragile"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {mcpPresetId === "custom" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Transport</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMcpCustomTransport("stdio")}
                      className={`px-3 py-1.5 rounded-md border text-sm ${
                        mcpCustomTransport === "stdio" ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      stdio (subprocess)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMcpCustomTransport("http")}
                      className={`px-3 py-1.5 rounded-md border text-sm ${
                        mcpCustomTransport === "http" ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      http (SSE)
                    </button>
                  </div>
                </div>
                {mcpCustomTransport === "stdio" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="mcp-cmd">Command</Label>
                      <Input
                        id="mcp-cmd"
                        value={mcpCustomCommand}
                        onChange={(e) => setMcpCustomCommand(e.target.value)}
                        placeholder="npx"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mcp-args">Args</Label>
                      <Input
                        id="mcp-args"
                        value={mcpCustomArgs}
                        onChange={(e) => setMcpCustomArgs(e.target.value)}
                        placeholder="-y my-mcp-server"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="mcp-url">SSE URL</Label>
                    <Input
                      id="mcp-url"
                      value={mcpCustomUrl}
                      onChange={(e) => setMcpCustomUrl(e.target.value)}
                      placeholder="https://mcp.example.com/sse"
                    />
                  </div>
                )}
              </>
            ) : (
              activePreset && (
                <>
                  {activePreset.transport === "stdio" && activePreset.command && (
                    <div className="rounded-md bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground">
                      {activePreset.command} {(activePreset.args || []).join(" ")}
                    </div>
                  )}
                  {(activePreset.envFields || []).map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label htmlFor={`mcp-env-${f.key}`}>
                        {f.label}
                        {f.required ? <span className="text-destructive ml-0.5">*</span> : null}
                      </Label>
                      <Input
                        id={`mcp-env-${f.key}`}
                        type={f.key.toLowerCase().includes("password") || f.key.toLowerCase().includes("token") || f.key.toLowerCase().includes("key") ? "password" : "text"}
                        value={mcpEnv[f.key] ?? ""}
                        onChange={(e) =>
                          setMcpEnv((p) => ({ ...p, [f.key]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        data-testid={`mcp-env-${f.key}`}
                      />
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground">
                    Docs:{" "}
                    <a
                      href={activePreset.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-foreground"
                    >
                      {activePreset.homepage}
                    </a>
                  </div>
                </>
              )
            )}

            <div className="space-y-1.5">
              <Label htmlFor="mcp-name">Connection name (optional)</Label>
              <Input
                id="mcp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="auto-derived from server"
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
