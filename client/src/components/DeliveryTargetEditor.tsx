// Friendly editor for a schedule's delivery targets.
// Replaces the raw-JSON textarea with type-aware forms so users can wire
// vault + substack + webhook delivery without writing JSON by hand.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  FolderInput,
  Send,
  Webhook,
  Plus,
  X,
  Pencil,
} from "lucide-react";
import type { Connection } from "@shared/schema";

export type EmailRecipient = {
  email: string;
  name?: string;
  firstName?: string;
};

export type DeliveryTarget =
  | { type: "email"; recipients: string; recipientList?: EmailRecipient[] }
  | { type: "vault"; connectionId: number; toolName: string; pathTemplate?: string; format?: "markdown" | "html" }
  | { type: "substack"; connectionId: number; toolName: string; action?: "draft" | "publish" }
  | { type: "webhook"; url: string; headers?: Record<string, string> };

const TYPE_META: Record<DeliveryTarget["type"], { label: string; icon: any; color: string }> = {
  email: { label: "Email", icon: Mail, color: "text-fuchsia-500" },
  vault: { label: "Vault (MCP)", icon: FolderInput, color: "text-emerald-500" },
  substack: { label: "Substack", icon: Send, color: "text-amber-500" },
  webhook: { label: "Webhook", icon: Webhook, color: "text-sky-500" },
};

export function DeliveryTargetEditor({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: number | undefined;
  value: DeliveryTarget[];
  onChange: (next: DeliveryTarget[]) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState<DeliveryTarget["type"] | null>(null);

  function add(t: DeliveryTarget) {
    onChange([...value, t]);
  }
  function update(idx: number, t: DeliveryTarget) {
    const next = value.slice();
    next[idx] = t;
    onChange(next);
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2.5">
      {value.length === 0 && !adding && (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground text-center">
          No delivery targets yet. Schedules without targets generate the asset but don't deliver it.
        </div>
      )}

      {value.map((t, i) => {
        const meta = TYPE_META[t.type];
        const Icon = meta.icon;
        if (editingIdx === i) {
          return (
            <TargetForm
              key={i}
              workspaceId={workspaceId}
              initial={t}
              onCancel={() => setEditingIdx(null)}
              onSave={(next) => {
                update(i, next);
                setEditingIdx(null);
              }}
            />
          );
        }
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
          >
            <div className="h-7 w-7 rounded-md bg-muted grid place-items-center shrink-0">
              <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="font-medium">{meta.label}</div>
              <div className="text-muted-foreground truncate">{summary(t)}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setEditingIdx(i)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(i)}>
              <X className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        );
      })}

      {adding ? (
        <TargetForm
          workspaceId={workspaceId}
          initial={defaultForType(adding)}
          onCancel={() => setAdding(null)}
          onSave={(t) => {
            add(t);
            setAdding(null);
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          {(Object.keys(TYPE_META) as DeliveryTarget["type"][]).map((typ) => {
            const meta = TYPE_META[typ];
            const Icon = meta.icon;
            return (
              <Button
                key={typ}
                size="sm"
                variant="outline"
                onClick={() => setAdding(typ)}
                data-testid={`add-target-${typ}`}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                <Icon className={`h-3.5 w-3.5 mr-1 ${meta.color}`} />
                {meta.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function summary(t: DeliveryTarget): string {
  if (t.type === "email") {
    if (t.recipientList && t.recipientList.length > 0) {
      return `${t.recipientList.length} personalized recipient${t.recipientList.length > 1 ? "s" : ""}`;
    }
    return t.recipients || "(no recipients)";
  }
  if (t.type === "vault") return `${t.toolName} → ${t.pathTemplate ?? "06-Content-Drafts/{date}-{slug}.md"}`;
  if (t.type === "substack") return `${t.toolName} (${t.action ?? "draft"})`;
  if (t.type === "webhook") return t.url;
  return "";
}

function defaultForType(typ: DeliveryTarget["type"]): DeliveryTarget {
  if (typ === "email") return { type: "email", recipients: "" };
  if (typ === "vault")
    return {
      type: "vault",
      connectionId: 0,
      toolName: "",
      pathTemplate: "06-Content-Drafts/{date}-{slug}.md",
      format: "markdown",
    };
  if (typ === "substack")
    return { type: "substack", connectionId: 0, toolName: "create_draft_post", action: "draft" };
  return { type: "webhook", url: "" };
}

// ----- Per-type form -----

type ToolDef = { name: string; description?: string };

function TargetForm({
  workspaceId,
  initial,
  onCancel,
  onSave,
}: {
  workspaceId: number | undefined;
  initial: DeliveryTarget;
  onCancel: () => void;
  onSave: (t: DeliveryTarget) => void;
}) {
  const [draft, setDraft] = useState<DeliveryTarget>(initial);

  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: [`/api/workspaces/${workspaceId}/connections`],
    enabled: !!workspaceId && (draft.type === "vault" || draft.type === "substack"),
  });
  const mcpConnections = connections.filter((c) => c.type === "mcp");

  const activeConnId =
    draft.type === "vault" || draft.type === "substack" ? draft.connectionId : null;
  const { data: toolsData } = useQuery<{ tools: ToolDef[] }>({
    queryKey: [`/api/connections/${activeConnId}/tools`],
    enabled: !!activeConnId && activeConnId > 0,
  });
  const tools = toolsData?.tools ?? [];

  const meta = TYPE_META[draft.type];
  const Icon = meta.icon;

  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium">
        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
        {meta.label}
      </div>

      {draft.type === "email" && (
        <EmailFields
          draft={draft as Extract<DeliveryTarget, { type: "email" }>}
          onChange={(d) => setDraft(d)}
        />
      )}

      {(draft.type === "vault" || draft.type === "substack") && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">MCP connection</Label>
            <Select
              value={draft.connectionId ? String(draft.connectionId) : ""}
              onValueChange={(v) =>
                setDraft({ ...draft, connectionId: Number(v) } as DeliveryTarget)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick connection…" />
              </SelectTrigger>
              <SelectContent>
                {mcpConnections.length === 0 && (
                  <SelectItem value="0" disabled>
                    No MCP connections — add one on Connections page
                  </SelectItem>
                )}
                {mcpConnections.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tool</Label>
            <Select
              value={draft.toolName}
              onValueChange={(v) => setDraft({ ...draft, toolName: v } as DeliveryTarget)}
            >
              <SelectTrigger>
                <SelectValue placeholder={tools.length ? "Pick tool…" : "Connect first to list tools"} />
              </SelectTrigger>
              <SelectContent>
                {tools.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {draft.type === "vault" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Vault path template</Label>
            <Input
              value={draft.pathTemplate ?? ""}
              onChange={(e) => setDraft({ ...draft, pathTemplate: e.target.value })}
              placeholder="06-Content-Drafts/{date}-{slug}.md"
              data-testid="target-vault-path"
            />
            <p className="text-[11px] text-muted-foreground">
              Variables: <code>{"{date}"}</code>, <code>{"{slug}"}</code>, <code>{"{title}"}</code>, <code>{"{kind}"}</code>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <Select
              value={draft.format ?? "markdown"}
              onValueChange={(v) => setDraft({ ...draft, format: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown (recommended for Obsidian)</SelectItem>
                <SelectItem value="html">HTML (preserves citations + styling)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {draft.type === "substack" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Select
            value={draft.action ?? "draft"}
            onValueChange={(v) => setDraft({ ...draft, action: v as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Create draft (review in Substack)</SelectItem>
              <SelectItem value="publish">Publish (most servers ignore — drafts only)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {draft.type === "webhook" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Webhook URL</Label>
          <Input
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            placeholder="https://hooks.slack.com/services/..."
            data-testid="target-webhook-url"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave(draft)}
          disabled={!isValid(draft)}
          data-testid="target-save"
        >
          Save target
        </Button>
      </div>
    </div>
  );
}

function isValid(t: DeliveryTarget): boolean {
  if (t.type === "email") {
    if (Array.isArray(t.recipientList) && t.recipientList.length > 0) return true;
    return !!t.recipients?.trim();
  }
  if (t.type === "vault") return t.connectionId > 0 && !!t.toolName.trim();
  if (t.type === "substack") return t.connectionId > 0 && !!t.toolName.trim();
  if (t.type === "webhook") return /^https?:\/\//i.test(t.url);
  return false;
}

// Email-specific form. Toggles between simple (comma-separated) and
// personalized (one recipient per line: 'email,firstName,name').
type EmailDraft = Extract<DeliveryTarget, { type: "email" }>;

function EmailFields({
  draft,
  onChange,
}: {
  draft: EmailDraft;
  onChange: (next: EmailDraft) => void;
}) {
  const [mode, setMode] = useState<"simple" | "personalized">(
    draft.recipientList && draft.recipientList.length > 0 ? "personalized" : "simple"
  );
  const [csv, setCsv] = useState<string>(() =>
    draft.recipientList
      ? draft.recipientList
          .map((r) =>
            [r.email, r.firstName ?? "", r.name ?? ""].filter(Boolean).join(",")
          )
          .join("\n")
      : ""
  );

  function commitCsv(text: string) {
    setCsv(text);
    const list: EmailRecipient[] = text
      .split(/\r?\n/)
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\s*,\s*/);
        const [email, firstName, name] = [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
        return {
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          name: name.trim() || undefined,
        };
      })
      .filter((r) => /@/.test(r.email));
    onChange({ ...draft, recipientList: list });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("simple");
            onChange({ ...draft, recipientList: undefined });
          }}
          className={`px-3 py-1.5 rounded-md border text-xs ${
            mode === "simple" ? "border-primary bg-primary/10" : "border-border"
          }`}
        >
          Simple
        </button>
        <button
          type="button"
          onClick={() => setMode("personalized")}
          className={`px-3 py-1.5 rounded-md border text-xs ${
            mode === "personalized" ? "border-primary bg-primary/10" : "border-border"
          }`}
        >
          Personalized
        </button>
      </div>

      {mode === "simple" ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Recipients</Label>
          <Input
            value={draft.recipients}
            onChange={(e) =>
              onChange({ ...draft, recipients: e.target.value, recipientList: undefined })
            }
            placeholder="team@company.com, lp@company.com"
            data-testid="target-email-recipients"
          />
          <p className="text-[11px] text-muted-foreground">
            Comma-separated. One email goes to all addresses.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs">Recipients (one per line)</Label>
          <textarea
            value={csv}
            onChange={(e) => commitCsv(e.target.value)}
            placeholder={`shibil@speciale.invest,Shibil,Shibil Ahammad
john@example.com,John
sarah@example.com,Sarah,Dr. Sarah Lin`}
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
            data-testid="target-email-recipientList"
          />
          <p className="text-[11px] text-muted-foreground">
            Format: <code>email,firstName,name</code> — last two optional. Subject + body get{" "}
            <code>{`{{firstName}}`}</code>, <code>{`{{name}}`}</code>, <code>{`{{email}}`}</code> substitution per recipient.
          </p>
        </div>
      )}
    </div>
  );
}
